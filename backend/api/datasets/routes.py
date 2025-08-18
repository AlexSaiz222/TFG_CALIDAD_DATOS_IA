from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
import pandas as pd

from extensions import db
from models.dataset import Dataset
from models.project import Project
from services.minio_service import MinioService
from services.dataset_service import DatasetService

datasets_bp = Blueprint('datasets', __name__, url_prefix='/datasets')
minio_service = MinioService()
dataset_service = DatasetService()

# Register this blueprint with a different URL prefix for project-related endpoints
project_datasets_bp = Blueprint('project_datasets', __name__, url_prefix='/projects/<int:project_id>/datasets')

@project_datasets_bp.route('/', methods=['GET'])
@jwt_required()
def get_project_datasets(project_id):
    """Get all datasets for a specific project"""
    current_user_id = get_jwt_identity()
    
    try:
        # Convert string ID from JWT to integer for database comparison
        current_user_id_int = int(current_user_id)
    except (ValueError, TypeError):
        return jsonify({
            "success": False,
            "error": "Invalid token",
            "message": "Invalid user identification"
        }), 401
    
    # Check if project exists
    project = Project.query.get(project_id)
    if not project:
        return jsonify({
            "success": False,
            "error": "Recurso no encontrado",
            "message": "Project not found"
        }), 404
    
    # Check if user has access to the project
    if project.owner_id != current_user_id_int:
        return jsonify({
            "success": False,
            "error": "Unauthorized",
            "message": "You don't have access to this project"
        }), 403
    
    # Get datasets for this project
    datasets = Dataset.query.filter_by(project_id=project_id).all()
    
    return jsonify({
        "success": True,
        "data": [dataset.to_dict() for dataset in datasets]
    }), 200

@project_datasets_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_project_dataset(project_id):
    """Upload a new dataset to a specific project"""
    current_user_id = get_jwt_identity()
    
    try:
        # Convert string ID from JWT to integer for database comparison
        current_user_id_int = int(current_user_id)
    except (ValueError, TypeError):
        return jsonify({
            "success": False,
            "error": "Invalid token",
            "message": "Invalid user identification"
        }), 401
    
    # Check if project exists
    project = Project.query.get(project_id)
    if not project:
        return jsonify({
            "success": False,
            "error": "Recurso no encontrado",
            "message": "Project not found"
        }), 404
    
    # Check if user has access to the project
    if project.owner_id != current_user_id_int:
        return jsonify({
            "success": False,
            "error": "Unauthorized",
            "message": "You don't have access to this project"
        }), 403
    
    # Check if file is provided
    if 'file' not in request.files:
        return jsonify({
            "success": False,
            "error": "Bad Request",
            "message": "No file provided"
        }), 400
    
    file = request.files['file']
    
    # Check if filename is valid
    if file.filename == '':
        return jsonify({
            "success": False,
            "error": "Bad Request",
            "message": "No file selected"
        }), 400
    
    # Check file extension
    if not file.filename.endswith('.csv'):
        return jsonify({
            "success": False,
            "error": "Bad Request",
            "message": "Only CSV files are supported"
        }), 400
    
    try:
        # Process and upload dataset
        dataset_info = dataset_service.process_dataset(file, project_id)
        
        # Create new dataset record
        new_dataset = Dataset(
            name=request.form.get('name', file.filename),
            description=request.form.get('description', ''),
            project_id=project_id,
            file_path=dataset_info['file_path'],
            file_size=dataset_info['file_size'],
            row_count=dataset_info['row_count'],
            column_count=dataset_info['column_count'],
            schema=dataset_info['schema']
        )
        
        # Save dataset to database
        db.session.add(new_dataset)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "data": new_dataset.to_dict()
        }), 201
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Server Error",
            "message": str(e)
        }), 500

@datasets_bp.route('/', methods=['GET'])
@jwt_required()
def get_datasets():
    """Get all datasets for the current user"""
    current_user_id = get_jwt_identity()
    
    # Get projects owned by the current user
    projects = Project.query.filter_by(owner_id=current_user_id).all()
    project_ids = [project.id for project in projects]
    
    # Get datasets for these projects
    datasets = Dataset.query.filter(Dataset.project_id.in_(project_ids)).all()
    
    return jsonify({
        "datasets": [dataset.to_dict() for dataset in datasets]
    }), 200

@datasets_bp.route('/<int:dataset_id>', methods=['GET'])
@jwt_required()
def get_dataset(dataset_id):
    """Get a specific dataset by ID"""
    current_user_id = get_jwt_identity()
    
    # Get dataset by ID
    dataset = Dataset.query.get(dataset_id)
    
    # Check if dataset exists
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404
    
    # Check if user has access to the dataset's project
    project = Project.query.get(dataset.project_id)
    if project.owner_id != current_user_id:
        return jsonify({"error": "Unauthorized access to dataset"}), 403
    
    return jsonify(dataset.to_dict()), 200

@datasets_bp.route('/', methods=['POST'])
@jwt_required()
def upload_dataset():
    """Upload a new dataset"""
    current_user_id = get_jwt_identity()
    
    # Check if project_id is provided
    project_id = request.form.get('project_id')
    if not project_id:
        return jsonify({"error": "Project ID is required"}), 400
    
    # Check if project exists and user has access
    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
    if project.owner_id != current_user_id:
        return jsonify({"error": "Unauthorized access to project"}), 403
    
    # Check if file is provided
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    
    # Check if filename is valid
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    # Check file extension
    if not file.filename.endswith('.csv'):
        return jsonify({"error": "Only CSV files are supported"}), 400
    
    try:
        # Process and upload dataset
        dataset_info = dataset_service.process_dataset(file, project_id)
        
        # Create new dataset record
        new_dataset = Dataset(
            name=request.form.get('name', file.filename),
            description=request.form.get('description', ''),
            project_id=project_id,
            file_path=dataset_info['file_path'],
            file_size=dataset_info['file_size'],
            row_count=dataset_info['row_count'],
            column_count=dataset_info['column_count'],
            schema=dataset_info['schema']
        )
        
        # Save dataset to database
        db.session.add(new_dataset)
        db.session.commit()
        
        return jsonify(new_dataset.to_dict()), 201
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@datasets_bp.route('/<int:dataset_id>/preview', methods=['GET'])
@jwt_required()
def preview_dataset(dataset_id):
    """Get a preview of the dataset (first 100 rows)"""
    current_user_id = get_jwt_identity()
    
    # Get dataset by ID
    dataset = Dataset.query.get(dataset_id)
    
    # Check if dataset exists
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404
    
    # Check if user has access to the dataset's project
    project = Project.query.get(dataset.project_id)
    if project.owner_id != current_user_id:
        return jsonify({"error": "Unauthorized access to dataset"}), 403
    
    try:
        # Get dataset preview
        preview_data = dataset_service.get_dataset_preview(dataset.file_path)
        
        return jsonify({
            "preview": preview_data,
            "schema": dataset.schema
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@datasets_bp.route('/<int:dataset_id>', methods=['DELETE'])
@jwt_required()
def delete_dataset(dataset_id):
    """Delete an existing dataset"""
    current_user_id = get_jwt_identity()
    
    # Get dataset by ID
    dataset = Dataset.query.get(dataset_id)
    
    # Check if dataset exists
    if not dataset:
        return jsonify({"error": "Dataset not found"}), 404
    
    # Check if user has access to the dataset's project
    project = Project.query.get(dataset.project_id)
    if project.owner_id != current_user_id:
        return jsonify({"error": "Unauthorized access to dataset"}), 403
    
    try:
        # Delete dataset file from storage
        minio_service.delete_file(dataset.file_path)
        
        # Delete dataset from database
        db.session.delete(dataset)
        db.session.commit()
        
        return jsonify({"message": "Dataset deleted successfully"}), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
