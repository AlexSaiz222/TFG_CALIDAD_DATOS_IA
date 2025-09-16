"""
Servicio híbrido para ejecutar evaluaciones combinando procesamiento asíncrono y directo.
Este servicio garantiza que las evaluaciones se completen incluso si hay problemas con Celery.
"""

import logging
import threading
import time
from datetime import datetime
from sqlalchemy import text

from extensions import db
from models.evaluation import Evaluation
from services.evaluation_service import EvaluationService

# Configurar logger
logger = logging.getLogger(__name__)

class HybridEvaluationService:
    """
    Servicio híbrido para ejecutar evaluaciones que combina Celery con procesamiento directo.
    Implementa un sistema de fallback para garantizar que las evaluaciones se completen.
    """
    
    def __init__(self):
        self.evaluation_service = EvaluationService()
    
    def start_evaluation(self, evaluation_id, use_celery=True):
        """
        Inicia una evaluación utilizando Celery y configura un fallback directo.
        
        Args:
            evaluation_id: ID de la evaluación a ejecutar
            use_celery: Si es True, intenta usar Celery primero
            
        Returns:
            dict: Información sobre la evaluación iniciada
        """
        logger.info(f"Iniciando evaluación híbrida para ID: {evaluation_id}")
        
        try:
            # Verificar que la evaluación existe
            evaluation = Evaluation.query.get(evaluation_id)
            if not evaluation:
                logger.error(f"Evaluación no encontrada: {evaluation_id}")
                return {
                    "success": False,
                    "error": "Evaluación no encontrada"
                }
            
            if use_celery:
                # Intentar iniciar la evaluación con Celery
                try:
                    from tasks.evaluation_tasks import run_evaluation
                    logger.info(f"Iniciando evaluación con Celery para {evaluation_id}")
                    task = run_evaluation.delay(evaluation_id)
                    
                    # Actualizar ID de tarea en la evaluación
                    self._update_task_id(evaluation_id, task.id)
                    
                    # Configurar fallback en un hilo separado
                    self._setup_fallback(evaluation_id, task.id)
                    
                    return {
                        "success": True,
                        "message": "Evaluación iniciada con Celery y fallback configurado",
                        "task_id": task.id,
                        "evaluation_id": evaluation_id
                    }
                    
                except Exception as e:
                    logger.error(f"Error al iniciar evaluación con Celery: {str(e)}")
                    logger.info(f"Utilizando procesamiento directo como fallback para {evaluation_id}")
                    return self._run_direct_evaluation(evaluation_id)
            else:
                # Usar procesamiento directo directamente
                logger.info(f"Iniciando evaluación directa para {evaluation_id}")
                return self._run_direct_evaluation(evaluation_id)
        
        except Exception as e:
            logger.error(f"Error en HybridEvaluationService.start_evaluation: {str(e)}")
            return {
                "success": False,
                "error": f"Error al iniciar evaluación: {str(e)}"
            }
    
    def _update_task_id(self, evaluation_id, task_id):
        """
        Actualiza el ID de tarea en la evaluación.
        
        Args:
            evaluation_id: ID de la evaluación
            task_id: ID de la tarea de Celery
        """
        try:
            update_sql = text("""
                UPDATE evaluations 
                SET task_id = :task_id
                WHERE id = :id
            """)
            
            db.session.execute(update_sql, {'task_id': task_id, 'id': evaluation_id})
            db.session.commit()
            logger.debug(f"Task ID actualizado para evaluación {evaluation_id}: {task_id}")
        except Exception as e:
            logger.error(f"Error al actualizar task_id: {str(e)}")
            db.session.rollback()
    
    def _setup_fallback(self, evaluation_id, task_id, timeout=60):
        """
        Configura un fallback que verifica si la evaluación se ha completado en un tiempo determinado.
        Si no se completa, ejecuta la evaluación directamente.
        
        Args:
            evaluation_id: ID de la evaluación
            task_id: ID de la tarea de Celery
            timeout: Tiempo en segundos antes de activar el fallback
        """
        def check_and_run():
            logger.info(f"Configurando fallback para evaluación {evaluation_id} con timeout de {timeout} segundos")
            
            # Esperar el tiempo especificado
            time.sleep(timeout)
            
            # Verificar el estado de la evaluación
            try:
                evaluation = Evaluation.query.get(evaluation_id)
                if not evaluation:
                    logger.error(f"Evaluación no encontrada en fallback: {evaluation_id}")
                    return
                
                # Si la evaluación sigue en estado pending o processing, ejecutarla directamente
                if evaluation.status in ['pending', 'processing']:
                    logger.warning(f"Activando fallback para evaluación {evaluation_id} que sigue en estado {evaluation.status} después de {timeout} segundos")
                    self._run_direct_evaluation(evaluation_id)
                else:
                    logger.info(f"No es necesario activar fallback para evaluación {evaluation_id}, estado actual: {evaluation.status}")
            
            except Exception as e:
                logger.error(f"Error en fallback para evaluación {evaluation_id}: {str(e)}")
        
        # Iniciar el hilo de fallback
        fallback_thread = threading.Thread(target=check_and_run)
        fallback_thread.daemon = True  # El hilo se cerrará cuando el programa principal termine
        fallback_thread.start()
        logger.debug(f"Hilo de fallback iniciado para evaluación {evaluation_id}")
    
    def _run_direct_evaluation(self, evaluation_id):
        """
        Ejecuta una evaluación directamente (sin Celery).
        
        Args:
            evaluation_id: ID de la evaluación a ejecutar
            
        Returns:
            dict: Resultado de la evaluación
        """
        logger.info(f"Ejecutando evaluación directa para ID: {evaluation_id}")
        
        try:
            # Actualizar estado a "processing"
            self._update_evaluation_status(evaluation_id, "processing", progress=0, 
                                        current_step="Iniciando evaluación directa")
            
            # Ejecutar la evaluación utilizando el servicio de evaluación
            result = self.evaluation_service.run_evaluation(evaluation_id)
            
            logger.info(f"Evaluación directa completada para {evaluation_id}: {result}")
            return {
                "success": True,
                "message": "Evaluación directa completada",
                "evaluation_id": evaluation_id,
                "result": result
            }
            
        except Exception as e:
            logger.error(f"Error en evaluación directa {evaluation_id}: {str(e)}")
            self._update_evaluation_status(evaluation_id, "failed", error=str(e))
            return {
                "success": False,
                "error": f"Error en evaluación directa: {str(e)}"
            }
    
    def _update_evaluation_status(self, evaluation_id, status, progress=None, current_step=None, error=None):
        """
        Actualiza el estado de una evaluación en la base de datos.
        
        Args:
            evaluation_id: ID de la evaluación
            status: Estado de la evaluación ('pending', 'processing', 'completed', 'failed')
            progress: Porcentaje de progreso (opcional)
            current_step: Descripción del paso actual (opcional)
            error: Mensaje de error (opcional)
        """
        try:
            # Construir SQL de actualización dinámicamente
            update_fields = ["status = :status"]
            params = {'id': evaluation_id, 'status': status}
            
            if progress is not None:
                update_fields.append("progress = :progress")
                params['progress'] = progress
            
            if current_step is not None:
                update_fields.append("current_step = :current_step")
                params['current_step'] = current_step
            
            if error is not None:
                update_fields.append("error = :error")
                params['error'] = error
            
            # Actualizar timestamps según el estado
            now = datetime.utcnow()
            
            if status == "processing":
                update_fields.append("started_at = :started_at")
                params['started_at'] = now
            
            if status == "completed" or status == "failed":
                update_fields.append("completed_at = :completed_at")
                params['completed_at'] = now
                
                if status == "completed":
                    update_fields.append("progress = 100")
            
            # Construir SQL completo
            sql = text(f"""
                UPDATE evaluations 
                SET {', '.join(update_fields)}
                WHERE id = :id
            """)
            
            db.session.execute(sql, params)
            db.session.commit()
            logger.debug(f"Estado de evaluación {evaluation_id} actualizado a {status}")
            
        except Exception as e:
            logger.error(f"Error al actualizar estado de evaluación {evaluation_id}: {str(e)}")
            db.session.rollback()
