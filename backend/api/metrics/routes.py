from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import logging

from extensions import db
from models.metric import Metric, MetricTemplate

# Configurar logger
logger = logging.getLogger(__name__)

metrics_bp = Blueprint('metrics', __name__, url_prefix='/metrics')

@metrics_bp.route('/', methods=['GET'])
@jwt_required()
def get_metrics():
    """Get all available metrics"""
    try:
        metrics = Metric.query.all()
        
        # Manejar posibles errores de serialización
        metrics_data = []
        for metric in metrics:
            try:
                metrics_data.append(metric.to_dict())
            except Exception as e:
                logger.error(f"Error al serializar métrica {metric.id}: {str(e)}")
                # Incluir versión simplificada si hay error
                metrics_data.append({
                    "id": metric.id,
                    "name": metric.name,
                    "error": f"Error al serializar: {str(e)}"
                })
        
        return jsonify({
            "success": True,
            "metrics": metrics_data
        }), 200
    except Exception as e:
        logger.error(f"Error al obtener métricas: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Error al obtener métricas",
            "message": str(e)
        }), 500

@metrics_bp.route('/<int:metric_id>', methods=['GET'])
@jwt_required()
def get_metric(metric_id):
    """Get a specific metric by ID"""
    try:
        metric = Metric.query.get(metric_id)
        
        if not metric:
            return jsonify({
                "success": False,
                "error": "Métrica no encontrada",
                "message": f"No se encontró la métrica con ID {metric_id}"
            }), 404
        
        try:
            metric_data = metric.to_dict()
            return jsonify({
                "success": True,
                "data": metric_data
            }), 200
        except Exception as e:
            logger.error(f"Error al serializar métrica {metric_id}: {str(e)}")
            return jsonify({
                "success": False,
                "error": "Error al procesar la métrica",
                "message": str(e)
            }), 500
    except Exception as e:
        logger.error(f"Error al obtener métrica {metric_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Error al obtener la métrica",
            "message": str(e)
        }), 500

@metrics_bp.route('/templates', methods=['GET'])
@jwt_required()
def get_metric_templates():
    """Get all available metric templates"""
    try:
        templates = MetricTemplate.query.all()
        
        # Manejar posibles errores de serialización
        templates_data = []
        for template in templates:
            try:
                templates_data.append(template.to_dict())
            except Exception as e:
                logger.error(f"Error al serializar plantilla {template.id}: {str(e)}")
                # Incluir versión simplificada si hay error
                templates_data.append({
                    "id": template.id,
                    "name": template.name,
                    "error": f"Error al serializar: {str(e)}"
                })
        
        return jsonify({
            "success": True,
            "templates": templates_data
        }), 200
    except Exception as e:
        logger.error(f"Error al obtener plantillas de métricas: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Error al obtener plantillas de métricas",
            "message": str(e)
        }), 500

@metrics_bp.route('/templates/<int:template_id>', methods=['GET'])
@jwt_required()
def get_metric_template(template_id):
    """Get a specific metric template by ID"""
    try:
        template = MetricTemplate.query.get(template_id)
        
        if not template:
            return jsonify({
                "success": False,
                "error": "Plantilla de métrica no encontrada",
                "message": f"No se encontró la plantilla con ID {template_id}"
            }), 404
        
        try:
            template_data = template.to_dict()
            return jsonify({
                "success": True,
                "data": template_data
            }), 200
        except Exception as e:
            logger.error(f"Error al serializar plantilla {template_id}: {str(e)}")
            return jsonify({
                "success": False,
                "error": "Error al procesar la plantilla",
                "message": str(e)
            }), 500
    except Exception as e:
        logger.error(f"Error al obtener plantilla {template_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Error al obtener la plantilla",
            "message": str(e)
        }), 500

@metrics_bp.route('/templates', methods=['POST'])
@jwt_required()
def create_metric_template():
    """Create a new metric template"""
    try:
        data = request.get_json()
        
        # Check if required fields are present
        if not data.get('name') or not data.get('metrics'):
            return jsonify({
                "success": False,
                "error": "Datos incompletos",
                "message": "Los campos 'name' y 'metrics' son obligatorios"
            }), 400
        
        # Create new metric template
        new_template = MetricTemplate(
            name=data['name'],
            description=data.get('description', ''),
            metrics=data['metrics']
        )
        
        # Save template to database
        try:
            db.session.add(new_template)
            db.session.commit()
            
            # Serializar respuesta
            try:
                template_data = new_template.to_dict()
                return jsonify({
                    "success": True,
                    "data": template_data,
                    "message": "Plantilla de métrica creada correctamente"
                }), 201
            except Exception as e:
                logger.error(f"Error al serializar nueva plantilla: {str(e)}")
                return jsonify({
                    "success": True,
                    "data": {
                        "id": new_template.id,
                        "name": new_template.name
                    },
                    "message": "Plantilla creada pero con errores al serializar datos completos"
                }), 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error al guardar plantilla en la base de datos: {str(e)}")
            return jsonify({
                "success": False,
                "error": "Error al guardar plantilla",
                "message": str(e)
            }), 500
    except Exception as e:
        logger.error(f"Error al procesar solicitud de creación de plantilla: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Error al procesar solicitud",
            "message": str(e)
        }), 500

@metrics_bp.route('/templates/<int:template_id>', methods=['PUT'])
@jwt_required()
def update_metric_template(template_id):
    """Update an existing metric template"""
    try:
        data = request.get_json()
        template = MetricTemplate.query.get(template_id)
        
        if not template:
            return jsonify({
                "success": False,
                "error": "Plantilla no encontrada",
                "message": f"No se encontró la plantilla con ID {template_id}"
            }), 404
        
        # Update template fields
        if 'name' in data:
            template.name = data['name']
        if 'description' in data:
            template.description = data['description']
        if 'metrics' in data:
            template.metrics = data['metrics']
        
        # Save changes to database
        try:
            db.session.commit()
            
            # Serializar respuesta
            try:
                template_data = template.to_dict()
                return jsonify({
                    "success": True,
                    "data": template_data,
                    "message": "Plantilla actualizada correctamente"
                }), 200
            except Exception as e:
                logger.error(f"Error al serializar plantilla actualizada {template_id}: {str(e)}")
                return jsonify({
                    "success": True,
                    "data": {
                        "id": template.id,
                        "name": template.name
                    },
                    "message": "Plantilla actualizada pero con errores al serializar datos completos"
                }), 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error al guardar cambios en la plantilla {template_id}: {str(e)}")
            return jsonify({
                "success": False,
                "error": "Error al guardar cambios",
                "message": str(e)
            }), 500
    except Exception as e:
        logger.error(f"Error al procesar solicitud de actualización de plantilla {template_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Error al procesar solicitud",
            "message": str(e)
        }), 500

@metrics_bp.route('/templates/<int:template_id>', methods=['DELETE'])
@jwt_required()
def delete_metric_template(template_id):
    """Delete an existing metric template"""
    try:
        template = MetricTemplate.query.get(template_id)
        
        if not template:
            return jsonify({
                "success": False,
                "error": "Plantilla no encontrada",
                "message": f"No se encontró la plantilla con ID {template_id}"
            }), 404
        
        # Delete template from database
        try:
            db.session.delete(template)
            db.session.commit()
            
            return jsonify({
                "success": True,
                "message": "Plantilla eliminada correctamente"
            }), 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error al eliminar plantilla {template_id}: {str(e)}")
            return jsonify({
                "success": False,
                "error": "Error al eliminar plantilla",
                "message": str(e)
            }), 500
    except Exception as e:
        logger.error(f"Error al procesar solicitud de eliminación de plantilla {template_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Error al procesar solicitud",
            "message": str(e)
        }), 500
