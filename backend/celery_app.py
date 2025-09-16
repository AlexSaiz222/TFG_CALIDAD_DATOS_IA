from celery import Celery
import os
from dotenv import load_dotenv
from flask import Flask

# Cargar variables de entorno
load_dotenv()

def make_celery(app=None):
    """
    Crea y configura una instancia de Celery integrada con Flask
    
    Args:
        app: Instancia de Flask (opcional)
        
    Returns:
        Celery: Instancia configurada de Celery
    """
    redis_url = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
    
    celery = Celery(
        'dataquality',
        broker=redis_url,
        backend=redis_url,
        include=['tasks.evaluation_tasks']
    )
    
    # Configuración de Celery
    celery.conf.update(
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        timezone='Europe/Madrid',
        enable_utc=True,
        task_track_started=True,
        task_time_limit=3600,  # 1 hora máximo por tarea
        worker_max_tasks_per_child=200,
        worker_prefetch_multiplier=1,  # Evitar que un worker tome demasiadas tareas
        broker_connection_retry_on_startup=True,  # Reintentar conexión al broker al iniciar
        broker_connection_max_retries=10,  # Número máximo de reintentos
        broker_pool_limit=10,  # Límite de conexiones en el pool
        broker_heartbeat=10,  # Heartbeat para mantener la conexión activa
        broker_connection_timeout=30,  # Timeout para conexiones al broker
        result_expires=3600,  # Resultados expiran después de 1 hora
        worker_concurrency=4,  # Número de procesos worker
        worker_send_task_events=True,  # Enviar eventos de tareas
        task_send_sent_event=True,  # Enviar evento cuando la tarea es enviada
        task_acks_late=True,  # Confirmar tareas después de procesarlas
    )
    
    # Si se proporciona una aplicación Flask, configurar Celery para usar su contexto
    if app:
        TaskBase = celery.Task
        
        class ContextTask(TaskBase):
            abstract = True
            
            def __call__(self, *args, **kwargs):
                with app.app_context():
                    return TaskBase.__call__(self, *args, **kwargs)
        
        celery.Task = ContextTask
    
    return celery

# Crear instancia de Celery sin Flask inicialmente
celery = make_celery()

# Esta función será llamada desde app.py para configurar Celery con la app Flask
def configure_celery(app):
    celery_instance = make_celery(app)
    return celery_instance

if __name__ == '__main__':
    celery.start()
