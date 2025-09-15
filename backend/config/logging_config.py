"""
Configuración centralizada de logging para la aplicación.

Este módulo proporciona funciones para configurar el sistema de logging
con diferentes formateadores y manejadores según el entorno.
"""

import os
import logging
import logging.config
import structlog
from flask import request, g

def request_context_processor(_, __, event_dict):
    """
    Añade información de contexto de la solicitud HTTP al log.
    
    Args:
        event_dict: Diccionario del evento de log
        
    Returns:
        dict: Diccionario del evento con información adicional
    """
    # Añadir ID de solicitud si está disponible
    if hasattr(g, 'request_id'):
        event_dict['request_id'] = g.request_id
    
    # Añadir información de la solicitud si está disponible
    if request:
        event_dict['remote_addr'] = request.remote_addr
        event_dict['method'] = request.method
        event_dict['path'] = request.path
        
        # Añadir ID de usuario si está autenticado
        if hasattr(g, 'user_id'):
            event_dict['user_id'] = g.user_id
    
    return event_dict

def setup_logging(app=None):
    """
    Configura el sistema de logging para la aplicación.
    
    Args:
        app: Instancia de Flask (opcional)
    """
    log_level = os.environ.get('LOG_LEVEL', 'INFO').upper()
    
    # Configuración básica para logging estándar
    logging.basicConfig(
        level=getattr(logging, log_level),
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    )
    
    # Configuración para structlog (logs estructurados)
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            request_context_processor,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    # Configuración específica para Flask
    if app:
        # Configurar nivel de log para Flask
        app.logger.setLevel(getattr(logging, log_level))
        
        # Configurar manejadores según el entorno
        if app.config.get('ENV') == 'production':
            # En producción, configurar para enviar logs a archivos o servicios externos
            configure_production_logging(app)
        else:
            # En desarrollo, configurar para mostrar logs detallados en consola
            configure_development_logging(app)
            
        app.logger.info(f"Logging configurado en nivel {log_level} para entorno {app.config.get('ENV')}")

def configure_production_logging(app):
    """
    Configura logging para entorno de producción.
    
    Args:
        app: Instancia de Flask
    """
    
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
    ))
    app.logger.addHandler(handler)
    
    # Reducir verbosidad de algunos loggers
    logging.getLogger('werkzeug').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

def configure_development_logging(app):
    """
    Configura logging para entorno de desarrollo.
    
    Args:
        app: Instancia de Flask
    """
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
    ))
    app.logger.addHandler(handler)
    
    # En desarrollo, podemos ser más verbosos con SQL
    if os.environ.get('SQL_ECHO', 'false').lower() == 'true':
        logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
