"""
Rutas administrativas para monitoreo y gestión del sistema.

Este módulo proporciona endpoints para administradores del sistema,
incluyendo monitoreo de rendimiento, gestión de usuarios y configuración.
"""

import logging
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from middleware.performance_monitor import get_performance_stats, reset_metrics
from models.user import User

# Configurar logger
logger = logging.getLogger(__name__)

# Crear blueprint
admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

@admin_bp.route('/performance', methods=['GET'])
@jwt_required()
def get_performance_metrics():
    """
    Obtiene métricas de rendimiento del sistema.
    
    Requiere autenticación y permisos de administrador.
    
    Returns:
        tuple: JSON con métricas de rendimiento y código HTTP:
            - 200: Si se obtienen las métricas correctamente
            - 403: Si el usuario no tiene permisos de administrador
    """
    current_user_id = get_jwt_identity()
    
    # Verificar si el usuario es administrador
    user = User.query.get(current_user_id)
    if not user or not user.is_admin:
        logger.warning(f"Usuario {current_user_id} intentó acceder a métricas de rendimiento sin permisos")
        return jsonify({
            "success": False,
            "error": "Acceso no autorizado",
            "message": "Se requieren permisos de administrador para acceder a esta funcionalidad"
        }), 403
    
    # Obtener estadísticas de rendimiento
    stats = get_performance_stats()
    
    # Opcionalmente reiniciar métricas si se solicita
    if request.args.get('reset', '').lower() == 'true':
        reset_metrics()
        logger.info(f"Métricas de rendimiento reiniciadas por usuario {current_user_id}")
    
    return jsonify({
        "success": True,
        "data": stats,
        "message": "Métricas de rendimiento obtenidas correctamente"
    }), 200

@admin_bp.route('/health', methods=['GET'])
def health_check():
    """
    Endpoint de verificación de salud del sistema.
    
    No requiere autenticación para permitir monitoreo externo.
    
    Returns:
        tuple: JSON con estado del sistema y código HTTP 200
    """
    # Aquí se podrían añadir verificaciones adicionales (base de datos, redis, etc.)
    return jsonify({
        "success": True,
        "status": "ok",
        "version": "1.0.0",
        "message": "Sistema funcionando correctamente"
    }), 200
