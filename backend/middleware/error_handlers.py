"""
Middleware para manejo centralizado de errores en la API.

Este módulo proporciona manejadores de errores para diferentes tipos de excepciones
que pueden ocurrir durante el procesamiento de solicitudes HTTP.
"""

import logging
import traceback
from flask import jsonify
from werkzeug.exceptions import HTTPException
from sqlalchemy.exc import SQLAlchemyError

# Configurar logger
logger = logging.getLogger(__name__)

def register_error_handlers(app):
    """
    Registra manejadores de errores para diferentes tipos de excepciones.
    
    Args:
        app: Instancia de Flask
    """
    @app.errorhandler(404)
    def not_found_error(error):
        """Maneja errores 404 - Recurso no encontrado"""
        logger.info(f"Recurso no encontrado: {error}")
        return jsonify({
            "success": False,
            "error": "Recurso no encontrado",
            "message": str(error)
        }), 404
    
    @app.errorhandler(400)
    def bad_request_error(error):
        """Maneja errores 400 - Solicitud incorrecta"""
        logger.warning(f"Solicitud incorrecta: {error}")
        return jsonify({
            "success": False,
            "error": "Solicitud incorrecta",
            "message": str(error)
        }), 400
    
    @app.errorhandler(401)
    def unauthorized_error(error):
        """Maneja errores 401 - No autorizado"""
        logger.warning(f"Acceso no autorizado: {error}")
        return jsonify({
            "success": False,
            "error": "No autorizado",
            "message": "Se requiere autenticación para acceder a este recurso"
        }), 401
    
    @app.errorhandler(403)
    def forbidden_error(error):
        """Maneja errores 403 - Prohibido"""
        logger.warning(f"Acceso prohibido: {error}")
        return jsonify({
            "success": False,
            "error": "Acceso prohibido",
            "message": "No tienes permisos para acceder a este recurso"
        }), 403
    
    @app.errorhandler(405)
    def method_not_allowed_error(error):
        """Maneja errores 405 - Método no permitido"""
        logger.warning(f"Método no permitido: {error}")
        return jsonify({
            "success": False,
            "error": "Método no permitido",
            "message": f"El método {error.valid_methods[0] if error.valid_methods else 'solicitado'} no está permitido para este recurso"
        }), 405
    
    @app.errorhandler(429)
    def too_many_requests_error(error):
        """Maneja errores 429 - Demasiadas solicitudes"""
        logger.warning(f"Límite de tasa excedido: {error}")
        return jsonify({
            "success": False,
            "error": "Demasiadas solicitudes",
            "message": "Has excedido el límite de solicitudes. Por favor, intenta más tarde."
        }), 429
    
    @app.errorhandler(SQLAlchemyError)
    def database_error(error):
        """Maneja errores de base de datos"""
        logger.error(f"Error de base de datos: {error}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Error de base de datos",
            "message": "Ha ocurrido un error al procesar la solicitud en la base de datos"
        }), 500
    
    @app.errorhandler(Exception)
    def unhandled_exception(error):
        """Maneja excepciones no capturadas"""
        logger.error(f"Error no manejado: {error}", exc_info=True)
        
        # En producción, no devolver detalles del error
        if app.config.get('ENV') == 'production':
            message = "Ha ocurrido un error interno en el servidor"
        else:
            # En desarrollo, incluir detalles para depuración
            message = f"{str(error)}\n{traceback.format_exc()}"
            
        return jsonify({
            "success": False,
            "error": "Error interno del servidor",
            "message": message
        }), 500
    
    @app.errorhandler(HTTPException)
    def handle_http_exception(error):
        """Maneja excepciones HTTP genéricas"""
        logger.warning(f"Excepción HTTP: {error}")
        return jsonify({
            "success": False,
            "error": error.name,
            "message": error.description
        }), error.code
