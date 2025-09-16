"""
Middleware para monitorear y resolver evaluaciones estancadas automáticamente.
Este middleware se ejecuta periódicamente para detectar y resolver evaluaciones
que se han quedado estancadas en estado 'pending' o 'processing'.
"""

import logging
import threading
import time
from datetime import datetime, timedelta
from sqlalchemy import text

from extensions import db
from models.evaluation import Evaluation
from services.evaluation_service import EvaluationService

# Configurar logger
logger = logging.getLogger(__name__)

class EvaluationWatchdog:
    """
    Clase para monitorear y resolver evaluaciones estancadas.
    """
    
    def __init__(self, app=None, check_interval=60, stall_threshold=300):
        """
        Inicializa el watchdog de evaluaciones.
        
        Args:
            app: Aplicación Flask
            check_interval: Intervalo en segundos entre verificaciones
            stall_threshold: Tiempo en segundos después del cual una evaluación se considera estancada
        """
        self.app = app
        self.check_interval = check_interval
        self.stall_threshold = stall_threshold
        self.thread = None
        self.running = False
        
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """
        Inicializa el watchdog con una aplicación Flask.
        
        Args:
            app: Aplicación Flask
        """
        self.app = app
        
        # Registrar función para iniciar el watchdog cuando la aplicación esté lista
        @app.before_first_request
        def start_watchdog():
            self.start()
    
    def start(self):
        """
        Inicia el watchdog en un hilo separado.
        """
        if self.thread is not None and self.thread.is_alive():
            logger.info("El watchdog de evaluaciones ya está en ejecución")
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._run)
        self.thread.daemon = True
        self.thread.start()
        logger.info(f"Watchdog de evaluaciones iniciado (intervalo: {self.check_interval}s, umbral: {self.stall_threshold}s)")
    
    def stop(self):
        """
        Detiene el watchdog.
        """
        self.running = False
        if self.thread is not None:
            self.thread.join(timeout=5)
            logger.info("Watchdog de evaluaciones detenido")
    
    def _run(self):
        """
        Función principal del watchdog que se ejecuta en un hilo separado.
        """
        while self.running:
            try:
                with self.app.app_context():
                    self._check_stalled_evaluations()
            except Exception as e:
                logger.error(f"Error en watchdog de evaluaciones: {str(e)}")
            
            # Esperar hasta la próxima verificación
            time.sleep(self.check_interval)
    
    def _check_stalled_evaluations(self):
        """
        Verifica y resuelve evaluaciones estancadas.
        """
        cutoff_time = datetime.utcnow() - timedelta(seconds=self.stall_threshold)
        
        # Buscar evaluaciones estancadas
        stalled_evaluations = Evaluation.query.filter(
            Evaluation.status.in_(['pending', 'processing']),
            Evaluation.updated_at < cutoff_time
        ).all()
        
        if stalled_evaluations:
            logger.warning(f"Se encontraron {len(stalled_evaluations)} evaluaciones estancadas")
            
            for evaluation in stalled_evaluations:
                self._resolve_stalled_evaluation(evaluation)
    
    def _resolve_stalled_evaluation(self, evaluation):
        """
        Intenta resolver una evaluación estancada.
        
        Args:
            evaluation: Objeto de evaluación estancada
        """
        evaluation_id = evaluation.id
        logger.info(f"Intentando resolver evaluación estancada #{evaluation_id} (estado: {evaluation.status})")
        
        try:
            # Crear servicio de evaluación
            service = EvaluationService()
            
            # Ejecutar evaluación directamente
            result = service.run_evaluation(evaluation_id)
            
            if result.get('success', False):
                logger.info(f"Evaluación #{evaluation_id} resuelta exitosamente")
            else:
                logger.warning(f"No se pudo resolver la evaluación #{evaluation_id}: {result.get('error', 'Error desconocido')}")
                
                # Si no se pudo resolver, marcar como fallida
                self._mark_as_failed(evaluation_id, f"Resolución automática fallida: {result.get('error', 'Error desconocido')}")
        
        except Exception as e:
            logger.error(f"Error al resolver evaluación #{evaluation_id}: {str(e)}")
            self._mark_as_failed(evaluation_id, f"Error en resolución automática: {str(e)}")
    
    def _mark_as_failed(self, evaluation_id, error_message):
        """
        Marca una evaluación como fallida.
        
        Args:
            evaluation_id: ID de la evaluación
            error_message: Mensaje de error
        """
        try:
            now = datetime.utcnow()
            sql = text("""
                UPDATE evaluations 
                SET status = 'failed', 
                    error = :error,
                    completed_at = :completed_at,
                    updated_at = :updated_at
                WHERE id = :id
            """)
            
            db.session.execute(sql, {
                'id': evaluation_id,
                'error': error_message,
                'completed_at': now,
                'updated_at': now
            })
            db.session.commit()
            
            logger.info(f"Evaluación #{evaluation_id} marcada como fallida")
        
        except Exception as e:
            logger.error(f"Error al marcar evaluación #{evaluation_id} como fallida: {str(e)}")
            db.session.rollback()

# Crear instancia global
watchdog = EvaluationWatchdog()
