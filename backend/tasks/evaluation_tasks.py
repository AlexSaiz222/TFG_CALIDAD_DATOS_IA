import logging
import time
from datetime import datetime
from celery import shared_task
from celery.utils.log import get_task_logger
from sqlalchemy.exc import SQLAlchemyError

from extensions import db
from models.evaluation import Evaluation, Issue
from models.analysis import AnalysisRun, AnalysisStatus
from models.dataset import Dataset
from services.evaluation_service import EvaluationService

# Configurar logger específico para tareas
logger = get_task_logger(__name__)

def get_flask_app():
    """Obtener la instancia de la aplicación Flask para el contexto"""
    import os
    import sys
    
    # Asegurar que el directorio backend está en el path
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    
    from flask import Flask
    from config import get_config
    from extensions import db
    
    # Crear una aplicación Flask mínima para el contexto
    app = Flask(__name__)
    config_object = get_config()
    app.config.from_object(config_object)
    
    # Inicializar extensiones
    db.init_app(app)
    
    return app

@shared_task(bind=True, name='tasks.run_evaluation', max_retries=3, default_retry_delay=60, acks_late=True, reject_on_worker_lost=True)
def run_evaluation(self, evaluation_id):
    """
    Tarea asíncrona para ejecutar una evaluación de calidad de datos
    
    Args:
        self: Instancia de la tarea (proporcionada por Celery)
        evaluation_id: ID de la evaluación a ejecutar
    
    Returns:
        dict: Resultado de la evaluación
    """
    logger.info(f"Iniciando evaluación asíncrona ID: {evaluation_id}")
    
    # Obtener contexto de la aplicación Flask
    app = get_flask_app()
    
    with app.app_context():
        return _run_evaluation_impl(self, evaluation_id)

def _run_evaluation_impl(task_self, evaluation_id):
    """Implementación real de la evaluación dentro del contexto de Flask
    
    Esta función implementa el ciclo de vida completo de AnalysisRun (Sonar-Lite):
    1. PENDING -> Crea AnalysisRun al inicio
    2. PROCESSING -> Durante la ejecución
    3. COMPLETED/FAILED -> Al finalizar
    """
    analysis_run_id = None
    
    try:
        logger.info(f"Iniciando procesamiento de evaluación {evaluation_id} con task_id {task_self.request.id}")
        
        # Actualizar estado de la evaluación legacy a "processing" y guardar task_id
        _update_evaluation_status(evaluation_id, "processing", progress=0, 
                                current_step="Iniciando evaluación", task_id=task_self.request.id)
        
        # Obtener evaluación para verificar métricas configuradas
        logger.debug(f"Obteniendo datos de evaluación {evaluation_id}")
        evaluation = Evaluation.query.get(evaluation_id)
        if not evaluation:
            error_msg = f"Evaluación no encontrada: {evaluation_id}"
            logger.error(error_msg)
            _update_evaluation_status(evaluation_id, "failed", error=error_msg)
            return {"success": False, "error": error_msg}
        
        # Verificar que existe el dataset
        dataset = Dataset.query.get(evaluation.dataset_id)
        if not dataset:
            error_msg = f"Dataset no encontrado: {evaluation.dataset_id}"
            logger.error(error_msg)
            _update_evaluation_status(evaluation_id, "failed", error=error_msg)
            return {"success": False, "error": error_msg}
        
        # ============================================================
        # SONAR-LITE: Crear AnalysisRun con estado PENDING
        # ============================================================
        analysis_run = AnalysisRun(
            project_id=dataset.project_id,
            dataset_id=dataset.id,
            status=AnalysisStatus.PENDING,
            metrics_config=evaluation.metrics_config,
            task_id=task_self.request.id,
            progress=0,
            current_step="Iniciando análisis"
        )
        db.session.add(analysis_run)
        db.session.commit()
        analysis_run_id = analysis_run.id
        logger.info(f"[SONAR-LITE] AnalysisRun {analysis_run_id} creado con estado PENDING para evaluación {evaluation_id}")
        
        # Actualizar progreso
        _update_evaluation_status(evaluation_id, "processing", progress=10, 
                                current_step="Preparando datos para evaluación")
        _update_analysis_run_status(analysis_run_id, AnalysisStatus.RUNNING, progress=10,
                                   current_step="Preparando datos para evaluación")
        
        # Extraer información de métricas para mostrar progreso
        metrics = evaluation.metrics_config.get('metrics', [])
        total_metrics = len(metrics)
        
        if total_metrics == 0:
            logger.warning(f"No se encontraron métricas configuradas para la evaluación {evaluation_id}")
            _update_evaluation_status(
                evaluation_id,
                "processing",
                progress=50,
                current_step="No hay métricas configuradas, continuando con evaluación básica"
            )
        else:
            # Actualizar progreso antes de iniciar el procesamiento real
            _update_evaluation_status(
                evaluation_id, 
                "processing", 
                progress=20,
                current_step=f"Cargando dataset para evaluación"
            )
        
        # Crear servicio de evaluación
        logger.debug(f"Creando servicio de evaluación para {evaluation_id}")
        evaluation_service = EvaluationService()
        
        # Ejecutar evaluación real con el analysis_run_id
        result = evaluation_service.run_evaluation(evaluation_id, analysis_run_id=analysis_run_id)
        
        # Verificar resultado
        if result.get('success', False):
            quality_score = result.get('quality_score', 0.0)
            issues_count = result.get('issues_count', 0)
            
            # La evaluación ya está marcada como completada por el servicio
            # Solo actualizamos el mensaje de progreso para mayor claridad
            _update_evaluation_status(
                evaluation_id, 
                "completed", 
                progress=100,
                current_step=f"Evaluación completada con puntuación {quality_score:.2f}"
            )
            
            logger.info(f"Evaluación {evaluation_id} completada con éxito. Puntuación: {quality_score:.2f}, Issues: {issues_count}")
            logger.info(f"[SONAR-LITE] AnalysisRun {analysis_run_id} completado exitosamente")
            
            return {
                "success": True, 
                "evaluation_id": evaluation_id,
                "analysis_run_id": analysis_run_id,
                "quality_score": quality_score,
                "issues_count": issues_count
            }
        else:
            # La evaluación ya está marcada como fallida por el servicio
            error_msg = result.get('error', 'Error desconocido durante la evaluación')
            logger.error(f"Error en evaluación {evaluation_id}: {error_msg}")
            
            # Asegurar que AnalysisRun quede en FAILED
            _update_analysis_run_status(analysis_run_id, AnalysisStatus.FAILED, error_message=error_msg)
            
            return {"success": False, "error": error_msg, "analysis_run_id": analysis_run_id}
            
    except SQLAlchemyError as e:
        db.session.rollback()
        error_msg = f"Error de base de datos: {str(e)}"
        logger.error(error_msg, exc_info=True)
        _update_evaluation_status(evaluation_id, "failed", error=error_msg)
        
        # Marcar AnalysisRun como FAILED
        if analysis_run_id:
            _update_analysis_run_status(analysis_run_id, AnalysisStatus.FAILED, error_message=error_msg)
        
        return {"success": False, "error": error_msg, "analysis_run_id": analysis_run_id}
    except Exception as e:
        error_msg = f"Error inesperado: {str(e)}"
        logger.error(error_msg, exc_info=True)
        _update_evaluation_status(evaluation_id, "failed", error=error_msg)
        
        # Marcar AnalysisRun como FAILED
        if analysis_run_id:
            _update_analysis_run_status(analysis_run_id, AnalysisStatus.FAILED, error_message=error_msg)
        
        return {"success": False, "error": error_msg, "analysis_run_id": analysis_run_id}


def _update_evaluation_status(evaluation_id, status, progress=None, current_step=None, error=None, task_id=None):
    """
    Actualiza el estado de una evaluación en la base de datos de forma segura.
    
    Esta función maneja la actualización atómica del estado de una evaluación,
    incluyendo su progreso, paso actual, mensajes de error y timestamps.
    Implementa manejo de errores para garantizar que las excepciones no
    interrumpan el flujo de la tarea principal.
    
    Args:
        evaluation_id (int): ID de la evaluación a actualizar
        status (str): Estado de la evaluación ('pending', 'processing', 'completed', 'failed')
        progress (int, opcional): Porcentaje de progreso (0-100)
        current_step (str, opcional): Descripción del paso actual de procesamiento
        error (str, opcional): Mensaje de error si la evaluación ha fallado
    
    Returns:
        bool: True si la actualización fue exitosa, False en caso contrario
    """
    if not evaluation_id:
        logger.error("Se intentó actualizar una evaluación sin proporcionar ID")
        return False
        
    if not status or status not in ('pending', 'processing', 'completed', 'failed'):
        logger.error(f"Estado inválido para evaluación {evaluation_id}: {status}")
        return False
        
    # Validar progreso si se proporciona
    if progress is not None and (not isinstance(progress, int) or progress < 0 or progress > 100):
        logger.warning(f"Valor de progreso inválido para evaluación {evaluation_id}: {progress}. Debe ser un entero entre 0 y 100.")
        # Corregir el valor si está fuera de rango
        progress = max(0, min(100, int(progress) if isinstance(progress, (int, float)) else 0))
    
    try:
        evaluation = Evaluation.query.get(evaluation_id)
        if not evaluation:
            logger.error(f"No se pudo actualizar el estado: Evaluación {evaluation_id} no encontrada")
            return False
        
        # Registrar cambio de estado
        old_status = evaluation.status
        evaluation.status = status
        
        # Actualizar campos adicionales si se proporcionan
        if progress is not None:
            evaluation.progress = progress
            
        if current_step is not None:
            evaluation.current_step = current_step
            
        if error is not None:
            evaluation.error = error
            
        if task_id is not None:
            evaluation.task_id = task_id
            logger.debug(f"Actualizado task_id para evaluación {evaluation_id}: {task_id}")
        
        # Actualizar timestamps según el estado
        now = datetime.utcnow()
        
        if status == "processing" and old_status == "pending" and not evaluation.started_at:
            evaluation.started_at = now
            
        if status == "completed":
            evaluation.completed_at = now
            # Asegurar que el progreso sea 100% al completar
            evaluation.progress = 100
            
        # Guardar cambios
        db.session.commit()
        logger.debug(f"Estado de evaluación {evaluation_id} actualizado: {old_status} -> {status}, progreso: {progress}%")
        return True
        
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"Error de base de datos al actualizar estado de evaluación {evaluation_id}: {str(e)}", exc_info=True)
        return False
        
    except Exception as e:
        logger.error(f"Error inesperado al actualizar estado: {str(e)}")


def _update_analysis_run_status(analysis_run_id, status, progress=None, current_step=None, error_message=None):
    """
    Actualiza el estado de un AnalysisRun (Sonar-Lite) en la base de datos de forma segura.
    
    Esta función maneja la actualización atómica del estado de un AnalysisRun,
    incluyendo su progreso, paso actual, mensajes de error y timestamps.
    Implementa manejo de errores para garantizar que las excepciones no
    interrumpan el flujo de la tarea principal.
    
    Args:
        analysis_run_id (int): ID del AnalysisRun a actualizar
        status (AnalysisStatus): Estado del análisis (PENDING, PROCESSING, COMPLETED, FAILED)
        progress (int, opcional): Porcentaje de progreso (0-100)
        current_step (str, opcional): Descripción del paso actual de procesamiento
        error_message (str, opcional): Mensaje de error si el análisis ha fallado
    
    Returns:
        bool: True si la actualización fue exitosa, False en caso contrario
    """
    if not analysis_run_id:
        logger.error("[SONAR-LITE] Se intentó actualizar un AnalysisRun sin proporcionar ID")
        return False
    
    # Validar progreso si se proporciona
    if progress is not None and (not isinstance(progress, int) or progress < 0 or progress > 100):
        logger.warning(f"[SONAR-LITE] Valor de progreso inválido para AnalysisRun {analysis_run_id}: {progress}")
        progress = max(0, min(100, int(progress) if isinstance(progress, (int, float)) else 0))
    
    try:
        analysis_run = AnalysisRun.query.get(analysis_run_id)
        if not analysis_run:
            logger.error(f"[SONAR-LITE] No se pudo actualizar: AnalysisRun {analysis_run_id} no encontrado")
            return False
        
        # Registrar cambio de estado
        old_status = analysis_run.status
        analysis_run.status = status
        
        # Actualizar campos adicionales si se proporcionan
        if progress is not None:
            analysis_run.progress = progress
            
        if current_step is not None:
            analysis_run.current_step = current_step
            
        if error_message is not None:
            analysis_run.error_message = error_message
        
        # Actualizar timestamps según el estado
        now = datetime.utcnow()
        
        if status == AnalysisStatus.RUNNING and old_status == AnalysisStatus.PENDING:
            analysis_run.started_at = now
            
        if status == AnalysisStatus.COMPLETED:
            analysis_run.completed_at = now
            analysis_run.progress = 100
            
        if status == AnalysisStatus.FAILED:
            analysis_run.completed_at = now
            
        # Guardar cambios
        db.session.commit()
        logger.debug(f"[SONAR-LITE] Estado de AnalysisRun {analysis_run_id} actualizado: {old_status} -> {status}")
        return True
        
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error(f"[SONAR-LITE] Error de BD al actualizar AnalysisRun {analysis_run_id}: {str(e)}", exc_info=True)
        return False
        
    except Exception as e:
        logger.error(f"[SONAR-LITE] Error inesperado al actualizar AnalysisRun: {str(e)}")
