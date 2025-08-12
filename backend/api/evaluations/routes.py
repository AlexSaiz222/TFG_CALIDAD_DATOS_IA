from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

from extensions import db
from models.evaluation import Evaluation, Issue
from models.dataset import Dataset
from models.project import Project
from services.dataset_service import DatasetService
from services.evaluation_service import EvaluationService

evaluations_bp = Blueprint('evaluations', __name__, url_prefix='/evaluations')
dataset_service = DatasetService()
evaluation_service = EvaluationService()

@evaluations_bp.route('/', methods=['GET'])
@jwt_required()
def get_evaluations():
    """Get all evaluations for the current user's datasets"""
    current_user_id = get_jwt_identity()
    
    # Get projects owned by the current user
    projects = Project.query.filter_by(owner_id=current_user_id).all()
    project_ids = [project.id for project in projects]
    
    # Get datasets for these projects
    datasets = Dataset.query.filter(Dataset.project_id.in_(project_ids)).all()
    dataset_ids = [dataset.id for dataset in datasets]
    
    # Get evaluations for these datasets
    evaluations = Evaluation.query.filter(Evaluation.dataset_id.in_(dataset_ids)).all()
    
    return jsonify({
        "evaluations": [evaluation.to_dict() for evaluation in evaluations]
    }), 200

@evaluations_bp.route('/<int:evaluation_id>', methods=['GET'])
@jwt_required()
def get_evaluation(evaluation_id):
    """Get a specific evaluation by ID"""
    current_user_id = get_jwt_identity()
    
    # Get evaluation by ID
    evaluation = Evaluation.query.get(evaluation_id)
    
    # Check if evaluation exists
    if not evaluation:
        return jsonify({"error": "Evaluation not found"}), 404
    
    # Check if user has access to the evaluation's dataset
    dataset = Dataset.query.get(evaluation.dataset_id)
    project = Project.query.get(dataset.project_id)
    if project.owner_id != current_user_id:
        return jsonify({"error": "Unauthorized access to evaluation"}), 403
    
    return jsonify(evaluation.to_dict()), 200

@evaluations_bp.route('/', methods=['POST'])
@jwt_required()
def create_evaluation():
    """Create a new evaluation for a dataset"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    # Check if required fields are present
    if not data.get('dataset_id') or not data.get('metrics_config'):
        return jsonify({"error": "Dataset ID and metrics configuration are required"}), 400
    
    # Check if dataset exists and user has access
    dataset = Dataset.query.get(data['dataset_id'])
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404
    
    project = Project.query.get(dataset.project_id)
    if project.owner_id != current_user_id:
        return jsonify({"error": "Unauthorized access to dataset"}), 403
    
    # Create new evaluation
    new_evaluation = Evaluation(
        dataset_id=data['dataset_id'],
        status='pending',
        metrics_config=data['metrics_config'],
        started_at=datetime.utcnow()
    )
    
    # Save evaluation to database
    db.session.add(new_evaluation)
    db.session.commit()
    
    # Run evaluation asynchronously (for MVP, we'll run it synchronously)
    try:
        # Run evaluation
        evaluation_service.run_evaluation(new_evaluation.id)
        
        # Refresh evaluation from database
        db.session.refresh(new_evaluation)
        
        return jsonify(new_evaluation.to_dict()), 201
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@evaluations_bp.route('/<int:evaluation_id>/issues', methods=['GET'])
@jwt_required()
def get_evaluation_issues(evaluation_id):
    """Get issues for a specific evaluation"""
    current_user_id = get_jwt_identity()
    
    # Get evaluation by ID
    evaluation = Evaluation.query.get(evaluation_id)
    
    # Check if evaluation exists
    if not evaluation:
        return jsonify({"error": "Evaluation not found"}), 404
    
    # Check if user has access to the evaluation's dataset
    dataset = Dataset.query.get(evaluation.dataset_id)
    project = Project.query.get(dataset.project_id)
    if project.owner_id != current_user_id:
        return jsonify({"error": "Unauthorized access to evaluation"}), 403
    
    # Get issues for this evaluation
    issues = Issue.query.filter_by(evaluation_id=evaluation_id).all()
    
    return jsonify({
        "issues": [issue.to_dict() for issue in issues]
    }), 200

@evaluations_bp.route('/<int:evaluation_id>', methods=['DELETE'])
@jwt_required()
def delete_evaluation(evaluation_id):
    """Delete an existing evaluation"""
    current_user_id = get_jwt_identity()
    
    # Get evaluation by ID
    evaluation = Evaluation.query.get(evaluation_id)
    
    # Check if evaluation exists
    if not evaluation:
        return jsonify({"error": "Evaluation not found"}), 404
    
    # Check if user has access to the evaluation's dataset
    dataset = Dataset.query.get(evaluation.dataset_id)
    project = Project.query.get(dataset.project_id)
    if project.owner_id != current_user_id:
        return jsonify({"error": "Unauthorized access to evaluation"}), 403
    
    # Delete evaluation from database
    db.session.delete(evaluation)
    db.session.commit()
    
    return jsonify({"message": "Evaluation deleted successfully"}), 200
