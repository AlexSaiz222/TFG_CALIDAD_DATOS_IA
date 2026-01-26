from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
import logging
from marshmallow import ValidationError, Schema, fields

from schemas.evaluation_schema import create_evaluation_schema, evaluation_filter_schema, compare_evaluations_schema

# Configurar logger
logger = logging.getLogger(__name__)

from extensions import db
from models.evaluation import Evaluation, Issue
from models.analysis import AnalysisRun, AnalysisStatus, DataQualityIssue
import numpy as np
from models.dataset import Dataset
from models.project import Project
from services.dataset_service import DatasetService
from services.evaluation_service import EvaluationService
from services.export_service import ExportService

evaluations_bp = Blueprint('evaluations', __name__, url_prefix='/evaluations')
dataset_service = DatasetService()
evaluation_service = EvaluationService()
export_service = ExportService()

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
    
    # Convertir ID de usuario a entero para comparación correcta
    try:
        current_user_id_int = int(current_user_id)
    except (ValueError, TypeError):
        logger.error(f"ID de usuario inválido en token: {current_user_id}")
        return jsonify({
            "success": False,
            "error": "invalid_token_identity",
            "message": "ID de usuario inválido en el token"
        }), 401
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
        try:
            evaluations_data = []
            for evaluation in pagination.items:
                try:
                    # Convertir cada evaluación a diccionario con manejo de errores
                    eval_dict = evaluation.to_dict()
                    evaluations_data.append(eval_dict)
                except Exception as e:
                    logger.error(f"Error al convertir evaluación {evaluation.id} a diccionario: {str(e)}")
                    # Incluir versión simplificada si hay error
                    evaluations_data.append({
                        "id": evaluation.id,
                        "dataset_id": evaluation.dataset_id,
                        "status": evaluation.status,
                        "error": f"Error al serializar: {str(e)}"
                    })
            
            return jsonify({
                "success": True,
                "data": {
                    "evaluations": evaluations_data,
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
            logger.error(f"Error al construir respuesta de evaluaciones: {str(e)}")
            return jsonify({
                "success": False,
                "error": "Error al procesar evaluaciones",
                "message": str(e)
            }), 500
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
    
    # Convertir ID de usuario a entero para comparación correcta
    try:
        current_user_id_int = int(current_user_id)
    except (ValueError, TypeError):
        logger.error(f"ID de usuario inválido en token: {current_user_id}")
        return jsonify({
            "success": False,
            "error": "invalid_token_identity",
            "message": "ID de usuario inválido en el token"
        }), 401
    
    # Convertir ID de usuario a entero para comparación correcta
    try:
        current_user_id_int = int(current_user_id)
    except (ValueError, TypeError):
        logger.error(f"ID de usuario inválido en token: {current_user_id}")
        return jsonify({
            "success": False,
            "error": "invalid_token_identity",
            "message": "ID de usuario inválido en el token"
        }), 401
    
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
    if project.owner_id != current_user_id_int:
        return jsonify({
            "success": False,
            "error": "Acceso no autorizado",
            "message": "No tienes permisos para acceder a esta evaluación"
        }), 403
    
    try:
        eval_dict = evaluation.to_dict()
        return jsonify({
            "success": True,
            "data": {
                "evaluation": eval_dict
            },
            "message": "Evaluación obtenida correctamente"
        }), 200
    except Exception as e:
        logger.error(f"Error al serializar evaluación {evaluation_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Error al procesar la evaluación",
            "message": str(e)
        }), 500

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
    
    # Convertir ID de usuario a entero para comparación correcta
    try:
        current_user_id_int = int(current_user_id)
    except (ValueError, TypeError):
        logger.error(f"ID de usuario inválido en token: {current_user_id}")
        return jsonify({
            "success": False,
            "error": "invalid_token_identity",
            "message": "ID de usuario inválido en el token"
        }), 401
    
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
    if project.owner_id != current_user_id_int:
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
    """[DEPRECATED] Crea una nueva evaluación para un dataset.
    
    NOTA: Este endpoint está DEPRECATED. Use POST /api/evaluations/projects/<project_id>/analyze
    para la nueva API Sonar-Lite que devuelve analysis_run_id.
    
    Este endpoint se mantiene por compatibilidad con el frontend legacy.
    
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
    
    # Convertir ID de usuario a entero para comparación correcta
    try:
        current_user_id_int = int(current_user_id)
    except (ValueError, TypeError):
        logger.error(f"ID de usuario inválido en token: {current_user_id}")
        return jsonify({
            "success": False,
            "error": "invalid_token_identity",
            "message": "ID de usuario inválido en el token"
        }), 401
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
    if project.owner_id != current_user_id_int:
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
        try:
            eval_dict = new_evaluation.to_dict()
            return jsonify({
                "success": True,
                "data": {
                    "evaluation": eval_dict,
                    "task_id": task.id
                },
                "message": "Evaluación iniciada correctamente"
            }), 202  # 202 Accepted indica que la solicitud ha sido aceptada para procesamiento
        except Exception as e:
            logger.error(f"Error al serializar nueva evaluación {new_evaluation.id}: {str(e)}")
            # Devolver información básica si hay error de serialización
            return jsonify({
                "success": True,
                "data": {
                    "evaluation": {
                        "id": new_evaluation.id,
                        "dataset_id": new_evaluation.dataset_id,
                        "status": new_evaluation.status
                    },
                    "task_id": task.id
                },
                "message": "Evaluación iniciada correctamente, pero con errores al serializar datos completos"
            }), 202
    
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
    
    # Convertir ID de usuario a entero para comparación correcta
    try:
        current_user_id_int = int(current_user_id)
    except (ValueError, TypeError):
        logger.error(f"ID de usuario inválido en token: {current_user_id}")
        return jsonify({
            "success": False,
            "error": "invalid_token_identity",
            "message": "ID de usuario inválido en el token"
        }), 401
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
    if project.owner_id != current_user_id_int:
        logger.warning(f"Acceso no autorizado a evaluación {evaluation_id} por usuario {current_user_id}")
        return jsonify({
            "success": False,
            "error": "Acceso no autorizado",
            "message": "No tienes permisos para acceder a esta evaluación"
        }), 403
    
    # Get issues for this evaluation
    issues = Issue.query.filter_by(evaluation_id=evaluation_id).all()
    logger.debug(f"Se encontraron {len(issues)} issues para la evaluación {evaluation_id}")
    
    try:
        issues_data = []
        for issue in issues:
            try:
                issues_data.append(issue.to_dict())
            except Exception as e:
                logger.error(f"Error al serializar issue {issue.id}: {str(e)}")
                # Incluir versión simplificada si hay error
                issues_data.append({
                    "id": issue.id,
                    "evaluation_id": issue.evaluation_id,
                    "severity": issue.severity,
                    "description": issue.description,
                    "error": f"Error al serializar datos completos: {str(e)}"
                })
        
        return jsonify({
            "success": True,
            "data": {
                "issues": issues_data,
                "count": len(issues)
            },
            "message": "Issues obtenidos correctamente"
        }), 200
    except Exception as e:
        logger.error(f"Error al procesar lista de issues: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Error al procesar issues",
            "message": str(e)
        }), 500

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
    
    # Convertir ID de usuario a entero para comparación correcta
    try:
        current_user_id_int = int(current_user_id)
    except (ValueError, TypeError):
        logger.error(f"ID de usuario inválido en token: {current_user_id}")
        return jsonify({
            "success": False,
            "error": "invalid_token_identity",
            "message": "ID de usuario inválido en el token"
        }), 401
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
    if project.owner_id != current_user_id_int:
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

@evaluations_bp.route('/compare', methods=['GET'])
@jwt_required()
def compare_evaluations():
    """Compara los resultados de dos evaluaciones.
    
    Obtiene y compara los resultados de dos evaluaciones diferentes, mostrando
    las diferencias en métricas, categorías y puntuación general. Útil para
    analizar la evolución de la calidad de los datos a lo largo del tiempo.
    
    Query Parameters:
        evaluation_id_1 (int): ID de la primera evaluación
        evaluation_id_2 (int): ID de la segunda evaluación
    
    Returns:
        tuple: JSON con los datos de comparación y código HTTP:
            - 200: Si la comparación se realizó correctamente
            - 400: Si faltan parámetros o son inválidos
            - 403: Si el usuario no tiene permisos para acceder a las evaluaciones
            - 404: Si alguna evaluación no existe
    """
    current_user_id = get_jwt_identity()
    
    # Convertir ID de usuario a entero para comparación correcta
    try:
        current_user_id_int = int(current_user_id)
    except (ValueError, TypeError):
        logger.error(f"ID de usuario inválido en token: {current_user_id}")
        return jsonify({
            "success": False,
            "error": "invalid_token_identity",
            "message": "ID de usuario inválido en el token"
        }), 401
    logger.debug(f"Usuario {current_user_id} solicitando comparación de evaluaciones")
    
    try:
        # Validar parámetros
        args = compare_evaluations_schema.load(request.args)
        evaluation_id_1 = args.get('evaluation_id_1')
        evaluation_id_2 = args.get('evaluation_id_2')
        
        # Verificar que ambas evaluaciones existen
        evaluation1 = Evaluation.query.get(evaluation_id_1)
        evaluation2 = Evaluation.query.get(evaluation_id_2)
        
        if not evaluation1:
            return jsonify({
                "success": False,
                "error": "Evaluación no encontrada",
                "message": f"No se encontró la evaluación con ID {evaluation_id_1}"
            }), 404
            
        if not evaluation2:
            return jsonify({
                "success": False,
                "error": "Evaluación no encontrada",
                "message": f"No se encontró la evaluación con ID {evaluation_id_2}"
            }), 404
        
        # Verificar que el usuario tiene acceso a ambas evaluaciones
        dataset1 = Dataset.query.get(evaluation1.dataset_id)
        dataset2 = Dataset.query.get(evaluation2.dataset_id)
        
        project1 = Project.query.get(dataset1.project_id)
        project2 = Project.query.get(dataset2.project_id)
        
        if project1.owner_id != current_user_id or project2.owner_id != current_user_id:
            return jsonify({
                "success": False,
                "error": "Acceso no autorizado",
                "message": "No tienes permisos para acceder a estas evaluaciones"
            }), 403
        
        # Verificar que ambas evaluaciones están completadas
        if evaluation1.status != 'completed' or evaluation2.status != 'completed':
            return jsonify({
                "success": False,
                "error": "Evaluaciones no completadas",
                "message": "Solo se pueden comparar evaluaciones completadas"
            }), 400
        
        # Obtener información básica de las evaluaciones
        evaluations_info = [
            {
                "id": evaluation1.id,
                "dataset_id": evaluation1.dataset_id,
                "dataset_name": dataset1.name,
                "created_at": evaluation1.created_at.isoformat(),
                "quality_score": float(evaluation1.quality_score) if evaluation1.quality_score else None
            },
            {
                "id": evaluation2.id,
                "dataset_id": evaluation2.dataset_id,
                "dataset_name": dataset2.name,
                "created_at": evaluation2.created_at.isoformat(),
                "quality_score": float(evaluation2.quality_score) if evaluation2.quality_score else None
            }
        ]
        
        # Comparar métricas
        metrics_comparison = []
        categories_comparison = []
        
        # Obtener resultados de ambas evaluaciones
        results1 = evaluation1.results.get('overall', {}) if evaluation1.results else {}
        results2 = evaluation2.results.get('overall', {}) if evaluation2.results else {}
        
        # Métricas comunes
        common_metrics = set()
        metrics1 = set(results1.keys()) - {'quality_score', 'metrics_processed'}
        metrics2 = set(results2.keys()) - {'quality_score', 'metrics_processed'}
        common_metrics = metrics1.intersection(metrics2)
        
        # Comparar métricas comunes
        for metric in common_metrics:
            if metric in ['quality_score', 'metrics_processed']:
                continue
                
            value1 = results1.get(metric)
            value2 = results2.get(metric)
            
            if value1 is not None and value2 is not None:
                try:
                    value1 = float(value1)
                    value2 = float(value2)
                    difference = value1 - value2
                    trend = "improvement" if difference > 0 else "decline" if difference < 0 else "unchanged"
                    
                    metrics_comparison.append({
                        "metric_id": metric,
                        "name": metric.capitalize(),
                        "scores": [value1, value2],
                        "difference": abs(difference),
                        "trend": trend
                    })
                except (TypeError, ValueError):
                    # Skip metrics that can't be compared numerically
                    pass
        
        # Categorías de métricas (agrupación simplificada)
        category_mapping = {
            'completeness': 'completeness',
            'uniqueness': 'uniqueness',
            'consistency_pattern': 'consistency',
            'outliers': 'accuracy'
        }
        
        # Agrupar métricas por categoría
        category_scores = {}
        
        for metric_comp in metrics_comparison:
            metric_id = metric_comp['metric_id']
            # Determinar categoría basada en el ID de la métrica
            category = None
            for key, value in category_mapping.items():
                if metric_id.startswith(key):
                    category = value
                    break
            
            if category:
                if category not in category_scores:
                    category_scores[category] = {
                        "scores": [0, 0],
                        "count": 0
                    }
                
                category_scores[category]["scores"][0] += metric_comp["scores"][0]
                category_scores[category]["scores"][1] += metric_comp["scores"][1]
                category_scores[category]["count"] += 1
        
        # Calcular promedios por categoría
        for category, data in category_scores.items():
            if data["count"] > 0:
                avg_score1 = data["scores"][0] / data["count"]
                avg_score2 = data["scores"][1] / data["count"]
                difference = avg_score1 - avg_score2
                trend = "improvement" if difference > 0 else "decline" if difference < 0 else "unchanged"
                
                categories_comparison.append({
                    "category": category,
                    "name": category.capitalize(),
                    "scores": [avg_score1, avg_score2],
                    "difference": abs(difference),
                    "trend": trend
                })
        
        # Calcular diferencia general
        overall_score1 = float(evaluation1.quality_score) if evaluation1.quality_score else 0
        overall_score2 = float(evaluation2.quality_score) if evaluation2.quality_score else 0
        overall_difference = overall_score1 - overall_score2
        overall_trend = "improvement" if overall_difference > 0 else "decline" if overall_difference < 0 else "unchanged"
        
        # Construir respuesta
        comparison_data = {
            "evaluations": evaluations_info,
            "metrics_comparison": metrics_comparison,
            "categories_comparison": categories_comparison,
            "overall_difference": abs(overall_difference),
            "overall_trend": overall_trend
        }
        
        return jsonify({
            "success": True,
            "data": {
                "comparison": comparison_data
            },
            "message": "Comparación de evaluaciones obtenida correctamente"
        }), 200
        
    except ValidationError as err:
        logger.warning(f"Error de validación en solicitud de comparación: {err.messages}")
        return jsonify({
            "success": False,
            "error": "Parámetros inválidos",
            "message": "Los parámetros de comparación son inválidos",
            "details": err.messages
        }), 400
    except Exception as e:
        logger.error(f"Error al comparar evaluaciones: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Error al comparar evaluaciones",
            "message": str(e)
        }), 500

@evaluations_bp.route('/<int:evaluation_id>/export', methods=['GET'])
@jwt_required()
def export_evaluation(evaluation_id):
    """Exporta los resultados de una evaluación en diferentes formatos.
    
    Permite exportar los resultados de una evaluación en formatos como JSON, CSV o HTML
    para su análisis o presentación fuera de la plataforma.
    
    Args:
        evaluation_id (int): ID de la evaluación a exportar
    
    Query Parameters:
        format (str): Formato de exportación (json, csv, html). Por defecto: json
    
    Returns:
        tuple: Archivo descargable en el formato solicitado o respuesta de error
    """
    current_user_id = get_jwt_identity()
    
    # Convertir ID de usuario a entero para comparación correcta
    try:
        current_user_id_int = int(current_user_id)
    except (ValueError, TypeError):
        logger.error(f"ID de usuario inválido en token: {current_user_id}")
        return jsonify({
            "success": False,
            "error": "invalid_token_identity",
            "message": "ID de usuario inválido en el token"
        }), 401
    logger.info(f"Usuario {current_user_id} solicitando exportar evaluación {evaluation_id}")
    
    # Get evaluation by ID
    evaluation = Evaluation.query.get(evaluation_id)
    
    # Check if evaluation exists
    if not evaluation:
        logger.warning(f"Evaluación {evaluation_id} no encontrada para exportar")
        return jsonify({
            "success": False,
            "error": "Evaluación no encontrada",
            "message": f"No se encontró la evaluación con ID {evaluation_id}"
        }), 404
    
    # Check if evaluation is completed
    if evaluation.status != 'completed':
        logger.warning(f"Intento de exportar evaluación {evaluation_id} con estado {evaluation.status}")
        return jsonify({
            "success": False,
            "error": "Evaluación no completada",
            "message": "Solo se pueden exportar evaluaciones completadas"
        }), 400
    
    # Check if user has access to the evaluation's dataset
    dataset = Dataset.query.get(evaluation.dataset_id)
    project = Project.query.get(dataset.project_id)
    if project.owner_id != current_user_id_int:
        logger.warning(f"Acceso no autorizado para exportar evaluación {evaluation_id} por usuario {current_user_id}")
        return jsonify({
            "success": False,
            "error": "Acceso no autorizado",
            "message": "No tienes permisos para exportar esta evaluación"
        }), 403
    
    # Get export format
    export_format = request.args.get('format', 'json').lower()
    
    # Validate export format
    valid_formats = ['json', 'csv', 'html']
    if export_format not in valid_formats:
        logger.warning(f"Formato de exportación inválido: {export_format}")
        return jsonify({
            "success": False,
            "error": "Formato inválido",
            "message": f"Formato de exportación no válido. Opciones disponibles: {', '.join(valid_formats)}"
        }), 400
    
    try:
        # Export evaluation
        logger.info(f"Exportando evaluación {evaluation_id} en formato {export_format}")
        return export_service.export_evaluation(evaluation_id, export_format)
    
    except Exception as e:
        logger.error(f"Error al exportar evaluación {evaluation_id}: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Error al exportar evaluación",
            "message": str(e)
        }), 500


# =============================================================================
# SONAR-LITE API ENDPOINTS (AnalysisRun)
# =============================================================================

@evaluations_bp.route('/projects/<int:project_id>/analyze', methods=['POST'])
@jwt_required()
def start_analysis(project_id):
    """Inicia un nuevo análisis de calidad para un proyecto (Sonar-Lite).
    
    Crea un AnalysisRun en estado PENDING y lanza la tarea asíncrona.
    Devuelve inmediatamente el ID del análisis sin esperar a Celery.
    
    Args:
        project_id (int): ID del proyecto a analizar
    
    Request Body:
        dataset_id (int): ID del dataset a analizar
        metrics (list): Lista de métricas a evaluar
        options (dict, opcional): Opciones adicionales
    
    Returns:
        tuple: JSON con analysis_run_id y status PENDING, código HTTP 202
    """
    current_user_id = get_jwt_identity()
    
    try:
        current_user_id_int = int(current_user_id)
    except (ValueError, TypeError):
        logger.error(f"ID de usuario inválido en token: {current_user_id}")
        return jsonify({
            "success": False,
            "error": "invalid_token_identity",
            "message": "ID de usuario inválido en el token"
        }), 401
    
    logger.info(f"[SONAR-LITE] Usuario {current_user_id} iniciando análisis para proyecto {project_id}")
    
    # Verificar que el proyecto existe y el usuario tiene acceso
    project = Project.query.get(project_id)
    if not project:
        return jsonify({
            "success": False,
            "error": "project_not_found",
            "message": f"No se encontró el proyecto con ID {project_id}"
        }), 404
    
    if project.owner_id != current_user_id_int:
        return jsonify({
            "success": False,
            "error": "unauthorized_access",
            "message": "No tienes permisos para analizar este proyecto"
        }), 403
    
    # Obtener datos de entrada
    data = request.get_json() or {}
    dataset_id = data.get('dataset_id')
    
    if not dataset_id:
        return jsonify({
            "success": False,
            "error": "missing_dataset_id",
            "message": "Se requiere el ID del dataset a analizar"
        }), 400
    
    # Verificar que el dataset existe y pertenece al proyecto
    dataset = Dataset.query.get(dataset_id)
    if not dataset:
        return jsonify({
            "success": False,
            "error": "dataset_not_found",
            "message": f"No se encontró el dataset con ID {dataset_id}"
        }), 404
    
    if dataset.project_id != project_id:
        return jsonify({
            "success": False,
            "error": "dataset_mismatch",
            "message": "El dataset no pertenece a este proyecto"
        }), 400
    
    try:
        # Validar configuración de métricas
        validated_data = create_evaluation_schema.load(data)
        metrics = validated_data['metrics']
        options = validated_data.get('options', {})
    except ValidationError as err:
        return jsonify({
            "success": False,
            "error": "invalid_config",
            "message": "Configuración de métricas inválida",
            "details": err.messages
        }), 400
    
    try:
        # Crear AnalysisRun en estado PENDING
        analysis_run = AnalysisRun(
            project_id=project_id,
            dataset_id=dataset_id,
            status=AnalysisStatus.PENDING,
            metrics_config={'metrics': metrics, 'options': options},
            progress=0,
            current_step="Análisis en cola"
        )
        db.session.add(analysis_run)
        db.session.commit()
        
        logger.info(f"[SONAR-LITE] AnalysisRun {analysis_run.id} creado con estado PENDING")
        
        # Crear evaluación legacy para compatibilidad
        new_evaluation = Evaluation(
            dataset_id=dataset_id,
            status='pending',
            metrics_config={'metrics': metrics, 'options': options},
            progress=0,
            current_step="Inicializando evaluación",
            created_at=datetime.utcnow()
        )
        db.session.add(new_evaluation)
        db.session.commit()
        
        # Actualizar AnalysisRun con referencia a la evaluación legacy (si es necesario)
        logger.debug(f"[SONAR-LITE] Evaluación legacy {new_evaluation.id} creada para compatibilidad")
        
        # Importar y lanzar tarea asíncrona
        from tasks.evaluation_tasks import run_evaluation
        task = run_evaluation.delay(new_evaluation.id)
        
        # Actualizar task_id en ambos modelos
        new_evaluation.task_id = task.id
        new_evaluation.started_at = datetime.utcnow()
        analysis_run.task_id = task.id
        db.session.commit()
        
        logger.info(f"[SONAR-LITE] Tarea {task.id} lanzada para AnalysisRun {analysis_run.id}")
        
        # Devolver respuesta inmediata (no bloqueante)
        return jsonify({
            "success": True,
            "data": {
                "analysis_run_id": analysis_run.id,
                "status": analysis_run.status.value,
                "evaluation_id": new_evaluation.id,  # Para compatibilidad
                "task_id": task.id
            },
            "message": "Análisis iniciado correctamente"
        }), 202  # 202 Accepted
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"[SONAR-LITE] Error al iniciar análisis: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "analysis_start_failed",
            "message": f"Error al iniciar el análisis: {str(e)}"
        }), 500


@evaluations_bp.route('/analysis/<int:run_id>', methods=['GET'])
@jwt_required()
def get_analysis_run(run_id):
    """Obtiene el estado y resultados de un AnalysisRun específico.
    
    Devuelve información completa del análisis incluyendo:
    - Estado actual (PENDING, RUNNING, COMPLETED, FAILED)
    - Quality Gate status (PASSED, FAILED, WARNING)
    - Métricas y resultados (si completado)
    - Resumen de issues
    
    Args:
        run_id (int): ID del AnalysisRun
    
    Returns:
        tuple: JSON con datos del AnalysisRun, código HTTP 200
    """
    current_user_id = get_jwt_identity()
    
    try:
        current_user_id_int = int(current_user_id)
    except (ValueError, TypeError):
        return jsonify({
            "success": False,
            "error": "invalid_token_identity",
            "message": "ID de usuario inválido en el token"
        }), 401
    
    # Obtener AnalysisRun
    analysis_run = AnalysisRun.query.get(run_id)
    
    if not analysis_run:
        return jsonify({
            "success": False,
            "error": "analysis_not_found",
            "message": f"No se encontró el análisis con ID {run_id}"
        }), 404
    
    # Verificar permisos
    project = Project.query.get(analysis_run.project_id)
    if not project or project.owner_id != current_user_id_int:
        return jsonify({
            "success": False,
            "error": "unauthorized_access",
            "message": "No tienes permisos para acceder a este análisis"
        }), 403
    
    try:
        # Construir respuesta con datos del análisis
        response_data = analysis_run.to_dict(include_issues=False)
        
        # Añadir información adicional del dataset si existe
        if analysis_run.dataset_id:
            dataset = Dataset.query.get(analysis_run.dataset_id)
            if dataset:
                response_data['dataset_name'] = dataset.name
        
        # Añadir resumen de issues por severidad
        if analysis_run.status == AnalysisStatus.COMPLETED:
            issues_summary = db.session.query(
                DataQualityIssue.severity,
                db.func.count(DataQualityIssue.id)
            ).filter(
                DataQualityIssue.analysis_run_id == run_id
            ).group_by(DataQualityIssue.severity).all()
            
            response_data['issues_by_severity'] = {
                severity: count for severity, count in issues_summary
            }
        
        return jsonify({
            "success": True,
            "data": {
                "analysis_run": response_data
            },
            "message": "Análisis obtenido correctamente"
        }), 200
        
    except Exception as e:
        logger.error(f"[SONAR-LITE] Error al obtener AnalysisRun {run_id}: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "serialization_error",
            "message": f"Error al procesar los datos del análisis: {str(e)}"
        }), 500


@evaluations_bp.route('/analysis/<int:run_id>/status', methods=['GET'])
@jwt_required()
def get_analysis_run_status(run_id):
    """Obtiene solo el estado actual de un AnalysisRun (endpoint ligero para polling).
    
    Endpoint optimizado para consultas frecuentes de estado durante el procesamiento.
    
    Args:
        run_id (int): ID del AnalysisRun
    
    Returns:
        tuple: JSON con estado, progreso y quality_gate_status
    """
    current_user_id = get_jwt_identity()
    
    try:
        current_user_id_int = int(current_user_id)
    except (ValueError, TypeError):
        return jsonify({
            "success": False,
            "error": "invalid_token_identity"
        }), 401
    
    analysis_run = AnalysisRun.query.get(run_id)
    
    if not analysis_run:
        return jsonify({
            "success": False,
            "error": "analysis_not_found"
        }), 404
    
    # Verificar permisos
    project = Project.query.get(analysis_run.project_id)
    if not project or project.owner_id != current_user_id_int:
        return jsonify({
            "success": False,
            "error": "unauthorized_access"
        }), 403
    
    # Calcular tiempo estimado si está en proceso
    estimated_completion = None
    if analysis_run.status == AnalysisStatus.RUNNING and analysis_run.started_at and analysis_run.progress > 0:
        elapsed_time = (datetime.utcnow() - analysis_run.started_at).total_seconds()
        if analysis_run.progress > 0:
            total_estimated_time = (elapsed_time / analysis_run.progress) * 100
            estimated_completion = (analysis_run.started_at + 
                                   timedelta(seconds=total_estimated_time)).isoformat()
    
    return jsonify({
        "success": True,
        "data": {
            "analysis_run_id": analysis_run.id,
            "status": analysis_run.status.value if analysis_run.status else None,
            "quality_gate_status": analysis_run.quality_gate_status.value if analysis_run.quality_gate_status else None,
            "progress": analysis_run.progress or 0,
            "current_step": analysis_run.current_step,
            "quality_score": float(analysis_run.quality_score) if analysis_run.quality_score else None,
            "total_issues_count": analysis_run.total_issues_count or 0,
            "critical_issues_count": analysis_run.critical_issues_count or 0,
            "error_message": analysis_run.error_message,
            "started_at": analysis_run.started_at.isoformat() if analysis_run.started_at else None,
            "completed_at": analysis_run.completed_at.isoformat() if analysis_run.completed_at else None,
            "estimated_completion": estimated_completion
        }
    }), 200


@evaluations_bp.route('/analysis/<int:run_id>/issues', methods=['GET'])
@jwt_required()
def get_analysis_run_issues(run_id):
    """Obtiene los issues de calidad detectados en un AnalysisRun.
    
    Args:
        run_id (int): ID del AnalysisRun
    
    Query Parameters:
        severity (str, opcional): Filtrar por severidad (critical, major, minor, info)
        issue_type (str, opcional): Filtrar por tipo (completeness, uniqueness, etc.)
        page (int): Página (default: 1)
        per_page (int): Items por página (default: 50)
    
    Returns:
        tuple: JSON con lista de issues paginada
    """
    current_user_id = get_jwt_identity()
    
    try:
        current_user_id_int = int(current_user_id)
    except (ValueError, TypeError):
        return jsonify({
            "success": False,
            "error": "invalid_token_identity"
        }), 401
    
    analysis_run = AnalysisRun.query.get(run_id)
    
    if not analysis_run:
        return jsonify({
            "success": False,
            "error": "analysis_not_found",
            "message": f"No se encontró el análisis con ID {run_id}"
        }), 404
    
    # Verificar permisos
    project = Project.query.get(analysis_run.project_id)
    if not project or project.owner_id != current_user_id_int:
        return jsonify({
            "success": False,
            "error": "unauthorized_access"
        }), 403
    
    # Parámetros de filtro y paginación
    severity_filter = request.args.get('severity')
    issue_type_filter = request.args.get('issue_type')
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 100)
    
    # Construir query
    query = DataQualityIssue.query.filter_by(analysis_run_id=run_id)
    
    if severity_filter:
        query = query.filter(DataQualityIssue.severity == severity_filter)
    if issue_type_filter:
        query = query.filter(DataQualityIssue.issue_type == issue_type_filter)
    
    # Ordenar por severidad (critical primero) y luego por ID
    severity_order = db.case(
        (DataQualityIssue.severity == 'critical', 1),
        (DataQualityIssue.severity == 'major', 2),
        (DataQualityIssue.severity == 'minor', 3),
        else_=4
    )
    query = query.order_by(severity_order, DataQualityIssue.id)
    
    # Paginar
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    try:
        issues_data = [issue.to_dict() for issue in pagination.items]
        
        return jsonify({
            "success": True,
            "data": {
                "issues": issues_data,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": pagination.total,
                    "pages": pagination.pages,
                    "has_next": pagination.has_next,
                    "has_prev": pagination.has_prev
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"[SONAR-LITE] Error al obtener issues de AnalysisRun {run_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "serialization_error",
            "message": str(e)
        }), 500


@evaluations_bp.route('/projects/<int:project_id>/analysis_runs', methods=['GET'])
@jwt_required()
def get_project_analysis_runs(project_id):
    """Obtiene el historial de análisis de un proyecto.
    
    Lista todos los AnalysisRuns de un proyecto ordenados por fecha de creación
    (más recientes primero).
    
    Args:
        project_id (int): ID del proyecto
    
    Query Parameters:
        page (int): Página (default: 1)
        per_page (int): Items por página (default: 20)
        status (str, opcional): Filtrar por estado (PENDING, RUNNING, COMPLETED, FAILED)
    
    Returns:
        tuple: JSON con lista de AnalysisRuns paginada
    """
    current_user_id = get_jwt_identity()
    
    try:
        current_user_id_int = int(current_user_id)
    except (ValueError, TypeError):
        return jsonify({
            "success": False,
            "error": "invalid_token_identity"
        }), 401
    
    # Verificar proyecto y permisos
    project = Project.query.get(project_id)
    if not project:
        return jsonify({
            "success": False,
            "error": "project_not_found",
            "message": f"No se encontró el proyecto con ID {project_id}"
        }), 404
    
    if project.owner_id != current_user_id_int:
        return jsonify({
            "success": False,
            "error": "unauthorized_access"
        }), 403
    
    # Parámetros de paginación y filtro
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)
    status_filter = request.args.get('status')
    
    # Construir query
    query = AnalysisRun.query.filter_by(project_id=project_id)
    
    if status_filter:
        try:
            status_enum = AnalysisStatus(status_filter.upper())
            query = query.filter(AnalysisRun.status == status_enum)
        except ValueError:
            pass  # Ignorar filtro inválido
    
    # Ordenar por fecha de creación (más recientes primero)
    query = query.order_by(AnalysisRun.created_at.desc())
    
    # Paginar
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    try:
        runs_data = [run.to_summary_dict() for run in pagination.items]
        
        return jsonify({
            "success": True,
            "data": {
                "analysis_runs": runs_data,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": pagination.total,
                    "pages": pagination.pages,
                    "has_next": pagination.has_next,
                    "has_prev": pagination.has_prev
                }
            },
            "message": "Historial de análisis obtenido correctamente"
        }), 200
        
    except Exception as e:
        logger.error(f"[SONAR-LITE] Error al obtener historial de proyecto {project_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "serialization_error",
            "message": str(e)
        }), 500


@evaluations_bp.route('/projects/<int:project_id>/latest_analysis', methods=['GET'])
@jwt_required()
def get_latest_analysis(project_id):
    """Obtiene el análisis más reciente completado de un proyecto.
    
    Útil para mostrar el estado actual de calidad del proyecto en el dashboard.
    
    Args:
        project_id (int): ID del proyecto
    
    Returns:
        tuple: JSON con el AnalysisRun más reciente completado
    """
    current_user_id = get_jwt_identity()
    
    try:
        current_user_id_int = int(current_user_id)
    except (ValueError, TypeError):
        return jsonify({
            "success": False,
            "error": "invalid_token_identity"
        }), 401
    
    # Verificar proyecto y permisos
    project = Project.query.get(project_id)
    if not project:
        return jsonify({
            "success": False,
            "error": "project_not_found"
        }), 404
    
    if project.owner_id != current_user_id_int:
        return jsonify({
            "success": False,
            "error": "unauthorized_access"
        }), 403
    
    # Obtener el análisis más reciente completado
    latest_run = AnalysisRun.query.filter_by(
        project_id=project_id,
        status=AnalysisStatus.COMPLETED
    ).order_by(AnalysisRun.completed_at.desc()).first()
    
    if not latest_run:
        return jsonify({
            "success": True,
            "data": {
                "analysis_run": None
            },
            "message": "No hay análisis completados para este proyecto"
        }), 200
    
    try:
        return jsonify({
            "success": True,
            "data": {
                "analysis_run": latest_run.to_dict(include_issues=False)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"[SONAR-LITE] Error al obtener último análisis de proyecto {project_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "serialization_error",
            "message": str(e)
        }), 500
