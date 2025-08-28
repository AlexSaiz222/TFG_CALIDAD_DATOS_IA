from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import logging

from extensions import db
from models.project import Project
from models.metric import Metric

# Configurar logger
logger = logging.getLogger(__name__)

project_metrics_bp = Blueprint('project_metrics', __name__, url_prefix='/projects/<int:project_id>/metrics')

@project_metrics_bp.route('/config', methods=['GET'])
@jwt_required()
def get_project_metrics_config(project_id):
    """Get metrics configuration for a specific project"""
    try:
        # Verificar que el proyecto existe
        project = Project.query.get(project_id)
        
        if not project:
            return jsonify({
                "success": False,
                "error": "Proyecto no encontrado",
                "message": f"No se encontró el proyecto con ID {project_id}"
            }), 404
        
        # Verificar que el usuario actual es el propietario del proyecto
        current_user_id = get_jwt_identity()
        if str(project.owner_id) != str(current_user_id):
            return jsonify({
                "success": False,
                "error": "Acceso denegado",
                "message": "No tienes permiso para acceder a este proyecto"
            }), 403
        
        # Obtener la configuración de métricas del proyecto
        metrics_config = project.metrics_config or []
        
        return jsonify({
            "success": True,
            "metrics_config": metrics_config
        }), 200
    except Exception as e:
        logger.error(f"Error al obtener configuración de métricas del proyecto {project_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Error al obtener configuración de métricas",
            "message": str(e)
        }), 500

@project_metrics_bp.route('/config', methods=['POST'])
@jwt_required()
def save_project_metrics_config(project_id):
    """Save metrics configuration for a specific project"""
    try:
        # Verificar que el proyecto existe
        project = Project.query.get(project_id)
        
        if not project:
            return jsonify({
                "success": False,
                "error": "Proyecto no encontrado",
                "message": f"No se encontró el proyecto con ID {project_id}"
            }), 404
        
        # Verificar que el usuario actual es el propietario del proyecto
        current_user_id = get_jwt_identity()
        if str(project.owner_id) != str(current_user_id):
            return jsonify({
                "success": False,
                "error": "Acceso denegado",
                "message": "No tienes permiso para modificar este proyecto"
            }), 403
        
        # Obtener datos de la solicitud
        data = request.get_json()
        
        if not data or 'metrics_config' not in data:
            return jsonify({
                "success": False,
                "error": "Datos incompletos",
                "message": "Se requiere el campo 'metrics_config'"
            }), 400
        
        metrics_config = data['metrics_config']
        
        # Validar que metrics_config es una lista
        if not isinstance(metrics_config, list):
            return jsonify({
                "success": False,
                "error": "Formato inválido",
                "message": "El campo 'metrics_config' debe ser una lista"
            }), 400
        
        # Validar que cada elemento de la lista tiene los campos requeridos
        for config in metrics_config:
            if not isinstance(config, dict) or 'metric_id' not in config:
                return jsonify({
                    "success": False,
                    "error": "Formato inválido",
                    "message": "Cada elemento de 'metrics_config' debe tener un campo 'metric_id'"
                }), 400
            
            # Verificar que la métrica existe
            metric = Metric.query.get(config['metric_id'])
            if not metric:
                return jsonify({
                    "success": False,
                    "error": "Métrica no encontrada",
                    "message": f"No se encontró la métrica con ID {config['metric_id']}"
                }), 404
        
        # Guardar la configuración de métricas en el proyecto
        project.metrics_config = metrics_config
        
        # Guardar cambios en la base de datos
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Configuración de métricas guardada correctamente",
            "metrics_config": metrics_config
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al guardar configuración de métricas del proyecto {project_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Error al guardar configuración de métricas",
            "message": str(e)
        }), 500
