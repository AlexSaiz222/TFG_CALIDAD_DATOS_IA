"""
Middleware para monitoreo de rendimiento de la API.

Este módulo proporciona funciones para medir y registrar el tiempo de ejecución
de las solicitudes HTTP, identificar cuellos de botella y generar métricas
de rendimiento para análisis posterior.
"""

import time
import logging
from functools import wraps
from flask import request, g, current_app
from collections import defaultdict

# Configurar logger
logger = logging.getLogger(__name__)

# Almacenamiento de métricas en memoria
_request_metrics = defaultdict(list)
_endpoint_metrics = defaultdict(list)

def register_performance_middleware(app):
    """
    Registra middleware para monitoreo de rendimiento.
    
    Args:
        app: Instancia de Flask
    """
    @app.before_request
    def start_timer():
        """Registra el tiempo de inicio de la solicitud"""
        g.start_time = time.time()
    
    @app.after_request
    def log_request_info(response):
        """
        Registra información de rendimiento después de cada solicitud.
        
        Args:
            response: Objeto de respuesta Flask
            
        Returns:
            response: Objeto de respuesta sin modificar
        """
        if hasattr(g, 'start_time'):
            # Calcular duración
            duration = time.time() - g.start_time
            duration_ms = round(duration * 1000, 2)
            
            # Obtener información de la ruta
            endpoint = request.endpoint
            method = request.method
            status_code = response.status_code
            path = request.path
            
            # Registrar métricas
            _request_metrics[endpoint].append(duration_ms)
            _endpoint_metrics[(method, path)].append(duration_ms)
            
            # Registrar en log si la duración excede el umbral
            threshold_ms = current_app.config.get('SLOW_REQUEST_THRESHOLD_MS', 500)
            if duration_ms > threshold_ms:
                logger.warning(
                    f"Solicitud lenta detectada: {method} {path} - {duration_ms}ms",
                    extra={
                        "duration_ms": duration_ms,
                        "endpoint": endpoint,
                        "method": method,
                        "path": path,
                        "status_code": status_code
                    }
                )
            
            # Añadir header con tiempo de respuesta
            response.headers['X-Response-Time'] = f"{duration_ms}ms"
        
        return response

def get_performance_stats():
    """
    Obtiene estadísticas de rendimiento acumuladas.
    
    Returns:
        dict: Estadísticas de rendimiento por endpoint y ruta
    """
    stats = {
        "endpoints": {},
        "routes": {}
    }
    
    # Calcular estadísticas por endpoint
    for endpoint, times in _request_metrics.items():
        if times:
            stats["endpoints"][endpoint] = {
                "count": len(times),
                "avg_ms": round(sum(times) / len(times), 2),
                "min_ms": round(min(times), 2),
                "max_ms": round(max(times), 2)
            }
    
    # Calcular estadísticas por ruta
    for (method, path), times in _endpoint_metrics.items():
        if times:
            key = f"{method} {path}"
            stats["routes"][key] = {
                "count": len(times),
                "avg_ms": round(sum(times) / len(times), 2),
                "min_ms": round(min(times), 2),
                "max_ms": round(max(times), 2)
            }
    
    return stats

def reset_metrics():
    """Reinicia todas las métricas acumuladas"""
    _request_metrics.clear()
    _endpoint_metrics.clear()

def performance_monitor(func):
    """
    Decorador para monitorear el rendimiento de funciones específicas.
    
    Args:
        func: Función a monitorear
        
    Returns:
        function: Función decorada con monitoreo de rendimiento
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        duration = time.time() - start_time
        duration_ms = round(duration * 1000, 2)
        
        # Registrar en log si la duración excede el umbral
        threshold_ms = current_app.config.get('SLOW_FUNCTION_THRESHOLD_MS', 200)
        if duration_ms > threshold_ms:
            logger.warning(
                f"Función lenta detectada: {func.__module__}.{func.__name__} - {duration_ms}ms"
            )
        
        return result
    
    return wrapper
