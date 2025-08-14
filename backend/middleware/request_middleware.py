"""
Middleware para procesamiento de solicitudes HTTP.

Este módulo proporciona funciones middleware para procesar solicitudes
antes y después de que sean manejadas por las rutas de la aplicación.
"""

import uuid
import time
from flask import g, request, current_app

def register_request_middleware(app):
    """
    Registra middleware para procesar solicitudes HTTP.
    
    Args:
        app: Instancia de Flask
    """
    
    # Middleware para manejar solicitudes OPTIONS (preflight CORS)
    @app.before_request
    def handle_preflight():
        """
        Maneja solicitudes preflight OPTIONS para CORS.
        Responde inmediatamente a las solicitudes OPTIONS sin autenticación.
        """
        if request.method == 'OPTIONS':
            # Crear respuesta para solicitud preflight
            from flask import Response
            response = Response('')
            return response
    @app.before_request
    def before_request():
        """
        Se ejecuta antes de procesar cada solicitud.
        
        - Asigna un ID único a cada solicitud
        - Registra el tiempo de inicio para medir duración
        - Registra información básica de la solicitud
        """
        # Generar ID único para la solicitud
        g.request_id = str(uuid.uuid4())
        
        # Registrar tiempo de inicio para medir duración
        g.start_time = time.time()
        
        # Extraer ID de usuario del token JWT si está disponible
        from flask_jwt_extended import get_jwt_identity
        try:
            g.user_id = get_jwt_identity()
        except:
            g.user_id = None
        
        # Registrar información de la solicitud entrante
        current_app.logger.debug(
            f"Solicitud iniciada: {request.method} {request.path}",
            extra={
                "request_id": g.request_id,
                "remote_addr": request.remote_addr,
                "user_agent": request.user_agent.string,
                "user_id": g.user_id
            }
        )
    
    @app.after_request
    def after_request(response):
        """
        Se ejecuta después de procesar cada solicitud.
        
        - Calcula y registra la duración de la solicitud
        - Añade headers de seguridad y correlación
        
        Args:
            response: Objeto de respuesta Flask
            
        Returns:
            response: Objeto de respuesta modificado
        """
        # Calcular duración de la solicitud
        if hasattr(g, 'start_time'):
            duration = time.time() - g.start_time
            
            # Registrar información de la respuesta
            current_app.logger.debug(
                f"Solicitud completada: {request.method} {request.path} - {response.status_code}",
                extra={
                    "request_id": getattr(g, 'request_id', 'unknown'),
                    "duration_ms": round(duration * 1000, 2),
                    "status_code": response.status_code
                }
            )
        
        # Añadir headers de seguridad
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        # Añadir ID de solicitud para correlación
        if hasattr(g, 'request_id'):
            response.headers['X-Request-ID'] = g.request_id
        
        return response
