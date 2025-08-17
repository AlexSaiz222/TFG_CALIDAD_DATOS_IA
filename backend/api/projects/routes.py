from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models.project import Project
from models.user import User

projects_bp = Blueprint('projects', __name__, url_prefix='/projects')

@projects_bp.route('/', methods=['GET'])
@jwt_required()
def get_projects():
    """Get all projects for the current user"""
    try:
        # Obtener y registrar encabezados para depuración
        from flask import current_app as app
        auth_header = request.headers.get('Authorization', None)
        app.logger.debug(f"Encabezado Authorization recibido: {auth_header}")
        
        # Obtener ID de usuario del token JWT (string) y convertir a int
        current_user_id = get_jwt_identity()
        app.logger.debug(f"ID de usuario obtenido del token (string): {current_user_id}")
        try:
            current_user_id_int = int(current_user_id)
        except (TypeError, ValueError):
            app.logger.error(f"ID de usuario inválido en token: {current_user_id}")
            return jsonify({"success": False, "error": "invalid_token_identity", "message": "Invalid token identity"}), 401
        
        # Get projects owned by the current user
        projects = Project.query.filter_by(owner_id=current_user_id_int).all()
        app.logger.debug(f"Proyectos encontrados: {len(projects)}")
        
        return jsonify({
            "success": True,
            "projects": [project.to_dict() for project in projects]
        }), 200
    except Exception as e:
        from flask import current_app as app
        app.logger.error(f"Error al obtener proyectos: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Error al obtener proyectos",
            "message": str(e)
        }), 500

@projects_bp.route('/<int:project_id>', methods=['GET'])
@jwt_required()
def get_project(project_id):
    """Get a specific project by ID"""
    # Obtener y convertir identidad del token a int
    current_user_id = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid token identity"}), 401
    
    # Get project by ID
    project = Project.query.get(project_id)
    
    # Check if project exists
    if not project:
        return jsonify({"error": "Project not found"}), 404
    
    # Check if user has access to the project
    if project.owner_id != current_user_id_int:
        return jsonify({"error": "Unauthorized access to project"}), 403
    
    return jsonify(project.to_dict()), 200

@projects_bp.route('/', methods=['POST'])
@jwt_required()
def create_project():
    """Create a new project"""
    # Obtener y convertir identidad del token a int
    current_user_id = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid token identity"}), 401
    data = request.get_json()
    
    # Check if required fields are present
    if not data.get('name'):
        return jsonify({"error": "Project name is required"}), 400
    
    # Create new project
    new_project = Project(
        name=data['name'],
        description=data.get('description', ''),
        owner_id=current_user_id_int
    )
    
    # Save project to database
    db.session.add(new_project)
    db.session.commit()
    
    return jsonify(new_project.to_dict()), 201

@projects_bp.route('/<int:project_id>', methods=['PUT'])
@jwt_required()
def update_project(project_id):
    """Update an existing project"""
    # Obtener y convertir identidad del token a int
    current_user_id = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid token identity"}), 401
    data = request.get_json()
    
    # Get project by ID
    project = Project.query.get(project_id)
    
    # Check if project exists
    if not project:
        return jsonify({"error": "Project not found"}), 404
    
    # Check if user has access to the project
    if project.owner_id != current_user_id_int:
        return jsonify({"error": "Unauthorized access to project"}), 403
    
    # Update project fields
    if 'name' in data:
        project.name = data['name']
    if 'description' in data:
        project.description = data['description']
    
    # Save changes to database
    db.session.commit()
    
    return jsonify(project.to_dict()), 200

@projects_bp.route('/<int:project_id>', methods=['DELETE'])
@jwt_required()
def delete_project(project_id):
    """Delete an existing project"""
    # Obtener y convertir identidad del token a int
    current_user_id = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid token identity"}), 401
    
    # Get project by ID
    project = Project.query.get(project_id)
    
    # Check if project exists
    if not project:
        return jsonify({"error": "Project not found"}), 404
    
    # Check if user has access to the project
    if project.owner_id != current_user_id_int:
        return jsonify({"error": "Unauthorized access to project"}), 403
    
    # Delete project from database
    db.session.delete(project)
    db.session.commit()
    
    return jsonify({"message": "Project deleted successfully"}), 200
