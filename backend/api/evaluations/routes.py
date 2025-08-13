from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
import logging
from marshmallow import ValidationError

from schemas.evaluation_schema import create_evaluation_schema, evaluation_filter_schema

# Configurar logger
logger = logging.getLogger(__name__)

from extensions import db
from models.evaluation import Evaluation, Issue
from models.dataset import Dataset
from models.project import Project
from services.dataset_service import DatasetService
from services.evaluation_service import EvaluationService

evaluations_bp = Blueprint('evaluations', __name__, url_prefix='/evaluations')
dataset_service = DatasetService()
evaluation_service = EvaluationService()

@evaluations_bp.route('/', methods=['GET'])
@jwt_required()
def get_evaluations():
    """Obtiene todas las evaluaciones para los datasets del usuario actual con paginación.
    
    Permite filtrar por estado y dataset_id, y ordena los resultados por fecha de creación
    (más recientes primero). Implementa paginación para mejorar el rendimiento.
    
    Query Parameters:
        page (int): Número de página a mostrar (por defecto: 1)
        per_page (int): Número de elementos por página (por defecto: 20)
        status (str, opcional): Filtrar por estado ('pending', 'processing', 'completed', 'failed')
        dataset_id (int, opcional): Filtrar por ID de dataset
    
    Returns:
        tuple: JSON con las evaluaciones y metadatos de paginación, código HTTP 200 si éxito
              o código HTTP 500 si error
    """
    current_user_id = get_jwt_identity()
    logger.debug(f"Usuario {current_user_id} solicitando lista de evaluaciones")
    
    try:
        # Validar parámetros de filtro y paginación
        filter_args = evaluation_filter_schema.load(request.args)
        
        # Extraer parámetros validados
        page = filter_args.get('page', 1)
        per_page = filter_args.get('per_page', 20)
        status_filter = filter_args.get('status')
        dataset_id = filter_args.get('dataset_id')
        
        # Consulta optimizada con joins
        query = (Evaluation.query
            .join(Dataset, Evaluation.dataset_id == Dataset.id)
            .join(Project, Dataset.project_id == Project.id)
            .filter(Project.owner_id == current_user_id))
        
        # Aplicar filtros adicionales si existen
        if status_filter:
            query = query.filter(Evaluation.status == status_filter)
        if dataset_id:
            query = query.filter(Evaluation.dataset_id == dataset_id)
        
        # Ordenar por fecha de creación (más recientes primero)
        query = query.order_by(Evaluation.created_at.desc())
        
        # Ejecutar consulta paginada
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Construir respuesta
        return jsonify({
            "success": True,
            "data": {
                "evaluations": [evaluation.to_dict() for evaluation in pagination.items],
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": pagination.total,
                    "pages": pagination.pages,
                    "has_next": pagination.has_next,
                    "has_prev": pagination.has_prev
                }
            },
            "message": "Evaluaciones obtenidas correctamente"
        }), 200
    except Exception as e:
        logger.error(f"Error al obtener evaluaciones: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Error al obtener evaluaciones",
            "message": str(e)
        }), 500

@evaluations_bp.route('/<int:evaluation_id>', methods=['GET'])
@jwt_required()
def get_evaluation(evaluation_id):
    """Obtiene una evaluación específica por su ID.
    
    Verifica que el usuario tenga acceso a la evaluación solicitada comprobando
    la propiedad del proyecto asociado al dataset de la evaluación.
    
    Args:
        evaluation_id (int): ID de la evaluación a obtener
    
    Returns:
        tuple: JSON con los datos de la evaluación y código HTTP:
            - 200: Si la evaluación existe y el usuario tiene acceso
            - 404: Si la evaluación no existe
            - 403: Si el usuario no tiene permisos para acceder
    """
    current_user_id = get_jwt_identity()
    
    # Get evaluation by ID
    evaluation = Evaluation.query.get(evaluation_id)
    
    # Check if evaluation exists
    if not evaluation:
        return jsonify({
            "success": False,
            "error": "Evaluación no encontrada",
            "message": f"No se encontró la evaluación con ID {evaluation_id}"
        }), 404
    
    # Check if user has access to the evaluation's dataset
    dataset = Dataset.query.get(evaluation.dataset_id)
    project = Project.query.get(dataset.project_id)
    if project.owner_id != current_user_id:
        return jsonify({
            "success": False,
            "error": "Acceso no autorizado",
            "message": "No tienes permisos para acceder a esta evaluación"
        }), 403
    
    return jsonify({
        "success": True,
        "data": {
            "evaluation": evaluation.to_dict()
        },
        "message": "Evaluación obtenida correctamente"
    }), 200

@evaluations_bp.route('/<int:evaluation_id>/status', methods=['GET'])
@jwt_required()
def get_evaluation_status(evaluation_id):
    """Obtiene el estado actual de una evaluación en proceso.
    
    Proporciona información detallada sobre el progreso, paso actual, errores y
    estimación de tiempo de finalización para evaluaciones en proceso.
    
    Args:
        evaluation_id (int): ID de la evaluación a consultar
    
    Returns:
        tuple: JSON con información de estado y código HTTP:
            - 200: Si la evaluación existe y el usuario tiene acceso
            - 404: Si la evaluación no existe
            - 403: Si el usuario no tiene permisos para acceder
    """
    current_user_id = get_jwt_identity()
    
    # Get evaluation by ID
    evaluation = Evaluation.query.get(evaluation_id)
    
    # Check if evaluation exists
    if not evaluation:
        return jsonify({
            "success": False,
            "error": "Evaluación no encontrada",
            "message": f"No se encontró la evaluación con ID {evaluation_id}"
        }), 404
    
    # Check if user has access to the evaluation's dataset
    dataset = Dataset.query.get(evaluation.dataset_id)
    project = Project.query.get(dataset.project_id)
    if project.owner_id != current_user_id:
        return jsonify({
            "success": False,
            "error": "Acceso no autorizado",
            "message": "No tienes permisos para acceder a esta evaluación"
        }), 403
    
    # Calcular tiempo estimado de finalización si está en proceso
    estimated_completion = None
    if evaluation.status == 'processing' and evaluation.started_at and evaluation.progress > 0:
        # Estimar tiempo restante basado en el progreso actual
        elapsed_time = (datetime.utcnow() - evaluation.started_at).total_seconds()
        if evaluation.progress > 0:
            total_estimated_time = (elapsed_time / evaluation.progress) * 100
            remaining_seconds = total_estimated_time - elapsed_time
            estimated_completion = (evaluation.started_at + 
                                   timedelta(seconds=total_estimated_time)).isoformat()
    
    # Construir respuesta con información de estado
    status_info = {
        "evaluation_id": evaluation.id,
        "status": evaluation.status,
        "progress": evaluation.progress,
        "current_step": evaluation.current_step,
        "error": evaluation.error,
        "started_at": evaluation.started_at.isoformat() if evaluation.started_at else None,
        "completed_at": evaluation.completed_at.isoformat() if evaluation.completed_at else None,
        "estimated_completion": estimated_completion
    }
    
    return jsonify({
        "success": True,
        "data": {
            "status": status_info
        },
        "message": "Estado de evaluación obtenido correctamente"
    }), 200

@evaluations_bp.route('/datasets/<int:dataset_id>', methods=['POST'])
@jwt_required()
def create_evaluation(dataset_id):
    """Crea una nueva evaluación para un dataset y la ejecuta de forma asíncrona.
    
    Valida que el usuario tenga acceso al dataset, crea un registro de evaluación
    en estado 'pending' y lanza una tarea asíncrona con Celery para procesarla.
    
    Args:
        dataset_id (int): ID del dataset a evaluar
    
    Request Body:
        metrics (list): Lista de métricas a evaluar, cada una con su configuración
        options (dict, opcional): Opciones adicionales para la evaluación
    
    Returns:
        tuple: JSON con información de la evaluación creada y código HTTP:
            - 202: Si la evaluación se ha iniciado correctamente (Accepted)
            - 404: Si el dataset no existe
            - 403: Si el usuario no tiene permisos para acceder al dataset
            - 400: Si la configuración de métricas es inválida
            - 500: Si ocurre un error al iniciar la evaluación
    """
    current_user_id = get_jwt_identity()
    logger.info(f"Usuario {current_user_id} solicitando nueva evaluación para dataset {dataset_id}")
    
    # Verificar que el dataset existe y el usuario tiene acceso
    dataset = Dataset.query.get(dataset_id)
    if not dataset:
        logger.warning(f"Dataset {dataset_id} no encontrado")
        return jsonify({
            "success": False,
            "error": "Dataset no encontrado",
            "message": f"No se encontró el dataset con ID {dataset_id}"
        }), 404
    
    # Verificar permisos de acceso
    project = Project.query.get(dataset.project_id)
    if project.owner_id != current_user_id:
        logger.warning(f"Usuario {current_user_id} intentó acceder al dataset {dataset_id} sin permisos")
        return jsonify({
            "success": False,
            "error": "Acceso no autorizado",
            "message": "No tienes permisos para evaluar este dataset"
        }), 403
    
    # Obtener y validar datos de entrada
    data = request.get_json() or {}
    
    try:
        # Validar datos con el esquema
        validated_data = create_evaluation_schema.load(data)
        metrics = validated_data['metrics']
        options = validated_data.get('options', {})
        
        logger.debug(f"Configuración de evaluación validada: {len(metrics)} métricas")
        
    except ValidationError as err:
        logger.warning(f"Error de validación en solicitud de evaluación: {err.messages}")
        return jsonify({
            "success": False,
            "error": "Configuración inválida",
            "message": "La configuración de la evaluación contiene errores",
            "details": err.messages
        }), 400
    
    # Crear nueva evaluación
    new_evaluation = Evaluation(
        dataset_id=dataset_id,
        status='pending',
        metrics_config={
            'metrics': metrics,
            'options': options
        },
        progress=0,
        current_step="Inicializando evaluación",
        created_at=datetime.utcnow()
    )
    
    # Guardar evaluación en la base de datos
    db.session.add(new_evaluation)
    db.session.commit()
    logger.debug(f"Nueva evaluación creada con ID {new_evaluation.id}")
    
    try:
        # Importar tarea asíncrona
        from tasks.evaluation_tasks import run_evaluation
        
        # Iniciar tarea asíncrona con Celery
        task = run_evaluation.delay(new_evaluation.id)
        
        # Actualizar ID de tarea en la evaluación
        new_evaluation.task_id = task.id
        new_evaluation.started_at = datetime.utcnow()
        db.session.commit()
        
        # Devolver respuesta con información de la evaluación creada
        return jsonify({
            "success": True,
            "data": {
                "evaluation": new_evaluation.to_dict(),
                "task_id": task.id
            },
            "message": "Evaluación iniciada correctamente"
        }), 202  # 202 Accepted indica que la solicitud ha sido aceptada para procesamiento
    
    except Exception as e:
        # Registrar error y actualizar estado de la evaluación
        db.session.rollback()
        new_evaluation.status = 'failed'
        new_evaluation.error = str(e)
        db.session.add(new_evaluation)
        db.session.commit()
        
        return jsonify({
            "success": False,
            "error": "Error al iniciar evaluación",
            "message": str(e)
        }), 500

@evaluations_bp.route('/<int:evaluation_id>/issues', methods=['GET'])
@jwt_required()
def get_evaluation_issues(evaluation_id):
    """Obtiene los problemas (issues) detectados en una evaluación específica.
    
    Verifica que el usuario tenga acceso a la evaluación solicitada y devuelve
    todos los issues asociados a ella.
    
    Args:
        evaluation_id (int): ID de la evaluación
    
    Returns:
        tuple: JSON con la lista de issues y código HTTP:
            - 200: Si la evaluación existe y el usuario tiene acceso
            - 404: Si la evaluación no existe
            - 403: Si el usuario no tiene permisos para acceder
    """
    current_user_id = get_jwt_identity()
    logger.debug(f"Usuario {current_user_id} solicitando issues para evaluación {evaluation_id}")
    
    # Get evaluation by ID
    evaluation = Evaluation.query.get(evaluation_id)
    
    # Check if evaluation exists
    if not evaluation:
        logger.warning(f"Evaluación {evaluation_id} no encontrada")
        return jsonify({
            "success": False,
            "error": "Evaluación no encontrada",
            "message": f"No se encontró la evaluación con ID {evaluation_id}"
        }), 404
    
    # Check if user has access to the evaluation's dataset
    dataset = Dataset.query.get(evaluation.dataset_id)
    project = Project.query.get(dataset.project_id)
    if project.owner_id != current_user_id:
        logger.warning(f"Acceso no autorizado a evaluación {evaluation_id} por usuario {current_user_id}")
        return jsonify({
            "success": False,
            "error": "Acceso no autorizado",
            "message": "No tienes permisos para acceder a esta evaluación"
        }), 403
    
    # Get issues for this evaluation
    issues = Issue.query.filter_by(evaluation_id=evaluation_id).all()
    logger.debug(f"Se encontraron {len(issues)} issues para la evaluación {evaluation_id}")
    
    return jsonify({
        "success": True,
        "data": {
            "issues": [issue.to_dict() for issue in issues],
            "count": len(issues)
        },
        "message": "Issues obtenidos correctamente"
    }), 200

@evaluations_bp.route('/<int:evaluation_id>', methods=['DELETE'])
@jwt_required()
def delete_evaluation(evaluation_id):
    """Elimina una evaluación existente.
    
    Verifica que el usuario tenga acceso a la evaluación y la elimina de la base de datos.
    Si la evaluación tiene una tarea en ejecución, registra que podría requerir cancelación.
    
    Args:
        evaluation_id (int): ID de la evaluación a eliminar
    
    Returns:
        tuple: JSON con mensaje de confirmación y código HTTP:
            - 200: Si la evaluación se eliminó correctamente
            - 404: Si la evaluación no existe
            - 403: Si el usuario no tiene permisos para eliminar
            - 500: Si ocurre un error durante la eliminación
    """
    current_user_id = get_jwt_identity()
    logger.info(f"Usuario {current_user_id} solicitando eliminar evaluación {evaluation_id}")
    
    # Get evaluation by ID
    evaluation = Evaluation.query.get(evaluation_id)
    
    # Check if evaluation exists
    if not evaluation:
        logger.warning(f"Evaluación {evaluation_id} no encontrada para eliminar")
        return jsonify({
            "success": False,
            "error": "Evaluación no encontrada",
            "message": f"No se encontró la evaluación con ID {evaluation_id}"
        }), 404
    
    # Check if user has access to the evaluation's dataset
    dataset = Dataset.query.get(evaluation.dataset_id)
    project = Project.query.get(dataset.project_id)
    if project.owner_id != current_user_id:
        logger.warning(f"Acceso no autorizado para eliminar evaluación {evaluation_id} por usuario {current_user_id}")
        return jsonify({
            "success": False,
            "error": "Acceso no autorizado",
            "message": "No tienes permisos para eliminar esta evaluación"
        }), 403
    
    try:
        # Verificar si hay una tarea en ejecución
        if evaluation.status == 'processing' and evaluation.task_id:
            # Aquí podríamos cancelar la tarea de Celery si está en ejecución
            # from celery_app import celery
            # celery.control.revoke(evaluation.task_id, terminate=True)
            logger.info(f"Tarea {evaluation.task_id} asociada a la evaluación {evaluation_id} podría requerir cancelación")
        
        # Delete evaluation from database
        db.session.delete(evaluation)
        db.session.commit()
        logger.info(f"Evaluación {evaluation_id} eliminada correctamente")
        
        return jsonify({
            "success": True,
            "message": "Evaluación eliminada correctamente"
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al eliminar evaluación {evaluation_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Error al eliminar evaluación",
            "message": str(e)
        }), 500
