from celery import Celery
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

def make_celery(app_name=__name__):
    """
    Crea y configura una instancia de Celery
    """
    redis_url = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
    
    celery = Celery(
        app_name,
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
    )
    
    return celery

# Crear instancia de Celery
celery = make_celery()

if __name__ == '__main__':
    celery.start()
