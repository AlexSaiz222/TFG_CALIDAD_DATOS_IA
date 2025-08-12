from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models.metric import Metric, MetricTemplate

metrics_bp = Blueprint('metrics', __name__, url_prefix='/metrics')

@metrics_bp.route('/', methods=['GET'])
@jwt_required()
def get_metrics():
    """Get all available metrics"""
    metrics = Metric.query.all()
    
    return jsonify({
        "metrics": [metric.to_dict() for metric in metrics]
    }), 200

@metrics_bp.route('/<int:metric_id>', methods=['GET'])
@jwt_required()
def get_metric(metric_id):
    """Get a specific metric by ID"""
    metric = Metric.query.get(metric_id)
    
    if not metric:
        return jsonify({"error": "Metric not found"}), 404
    
    return jsonify(metric.to_dict()), 200

@metrics_bp.route('/templates', methods=['GET'])
@jwt_required()
def get_metric_templates():
    """Get all available metric templates"""
    templates = MetricTemplate.query.all()
    
    return jsonify({
        "templates": [template.to_dict() for template in templates]
    }), 200

@metrics_bp.route('/templates/<int:template_id>', methods=['GET'])
@jwt_required()
def get_metric_template(template_id):
    """Get a specific metric template by ID"""
    template = MetricTemplate.query.get(template_id)
    
    if not template:
        return jsonify({"error": "Metric template not found"}), 404
    
    return jsonify(template.to_dict()), 200

@metrics_bp.route('/templates', methods=['POST'])
@jwt_required()
def create_metric_template():
    """Create a new metric template"""
    data = request.get_json()
    
    # Check if required fields are present
    if not data.get('name') or not data.get('metrics'):
        return jsonify({"error": "Name and metrics are required"}), 400
    
    # Create new metric template
    new_template = MetricTemplate(
        name=data['name'],
        description=data.get('description', ''),
        metrics=data['metrics']
    )
    
    # Save template to database
    db.session.add(new_template)
    db.session.commit()
    
    return jsonify(new_template.to_dict()), 201

@metrics_bp.route('/templates/<int:template_id>', methods=['PUT'])
@jwt_required()
def update_metric_template(template_id):
    """Update an existing metric template"""
    data = request.get_json()
    template = MetricTemplate.query.get(template_id)
    
    if not template:
        return jsonify({"error": "Metric template not found"}), 404
    
    # Update template fields
    if 'name' in data:
        template.name = data['name']
    if 'description' in data:
        template.description = data['description']
    if 'metrics' in data:
        template.metrics = data['metrics']
    
    # Save changes to database
    db.session.commit()
    
    return jsonify(template.to_dict()), 200

@metrics_bp.route('/templates/<int:template_id>', methods=['DELETE'])
@jwt_required()
def delete_metric_template(template_id):
    """Delete an existing metric template"""
    template = MetricTemplate.query.get(template_id)
    
    if not template:
        return jsonify({"error": "Metric template not found"}), 404
    
    # Delete template from database
    db.session.delete(template)
    db.session.commit()
    
    return jsonify({"message": "Metric template deleted successfully"}), 200
