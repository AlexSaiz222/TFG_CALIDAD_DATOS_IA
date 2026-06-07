from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import logging

from extensions import db
from models.project import Project
from models.user import User
from models.analysis import QualityGate

# Configurar logger
logger = logging.getLogger(__name__)

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
    try:
        # Obtener y convertir identidad del token a int
        current_user_id = get_jwt_identity()
        try:
            current_user_id_int = int(current_user_id)
        except (TypeError, ValueError):
            logger.error(f"ID de usuario inválido en token: {current_user_id}")
            return jsonify({
                "success": False,
                "error": "invalid_token_identity",
                "message": "ID de usuario inválido en el token"
            }), 401
        
        # Get project by ID
        project = Project.query.get(project_id)
        
        # Check if project exists
        if not project:
            return jsonify({
                "success": False,
                "error": "project_not_found",
                "message": f"No se encontró el proyecto con ID {project_id}"
            }), 404
        
        # Check if user has access to the project
        if project.owner_id != current_user_id_int:
            return jsonify({
                "success": False,
                "error": "unauthorized_access",
                "message": "No tiene permiso para acceder a este proyecto"
            }), 403
        
        try:
            project_data = project.to_dict()
            return jsonify({
                "success": True,
                "data": project_data
            }), 200
        except Exception as e:
            logger.error(f"Error al serializar proyecto {project_id}: {str(e)}")
            return jsonify({
                "success": False,
                "error": "serialization_error",
                "message": f"Error al procesar los datos del proyecto: {str(e)}"
            }), 500
    except Exception as e:
        logger.error(f"Error al obtener proyecto {project_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": f"Error del servidor: {str(e)}"
        }), 500

@projects_bp.route('/', methods=['POST'])
@jwt_required()
def create_project():
    """Create a new project"""
    try:
        # Obtener y convertir identidad del token a int
        current_user_id = get_jwt_identity()
        try:
            current_user_id_int = int(current_user_id)
        except (TypeError, ValueError):
            logger.error(f"ID de usuario inválido en token: {current_user_id}")
            return jsonify({
                "success": False,
                "error": "invalid_token_identity",
                "message": "ID de usuario inválido en el token"
            }), 401
            
        try:
            data = request.get_json()
        except Exception as e:
            logger.error(f"Error al parsear JSON: {str(e)}")
            return jsonify({
                "success": False,
                "error": "invalid_json",
                "message": "Formato JSON inválido en la solicitud"
            }), 400
        
        # Check if required fields are present
        if not data.get('name'):
            return jsonify({
                "success": False,
                "error": "missing_required_field",
                "message": "El nombre del proyecto es obligatorio"
            }), 400
        
        # Métricas por defecto para nuevos proyectos (las que no requieren
        # configuración por columna). Los valores atípicos (outliers) se
        # calculan en el perfilado de datos y no se asignan como métrica.
        default_metrics = [
            {
                "id": "completeness",
                "parameters": {}
            },
            {
                "id": "uniqueness",
                "parameters": {}
            }
        ]
        
        # Si se proporcionó un template_id, cargar métricas de la plantilla
        template_id = data.get('template_id')
        if template_id:
            from models.metric import MetricTemplate
            template = MetricTemplate.query.get(template_id)
            if template and template.metrics:
                metrics_config = template.metrics
            else:
                metrics_config = data.get('metrics_config', default_metrics)
        else:
            # Usar métricas proporcionadas o las por defecto
            metrics_config = data.get('metrics_config', default_metrics)
        
        # Create new project
        new_project = Project(
            name=data['name'],
            description=data.get('description', ''),
            owner_id=current_user_id_int,
            metrics_config=metrics_config
        )
        
        # Save project to database
        try:
            db.session.add(new_project)
            db.session.commit()
            
            # Serializar respuesta
            try:
                project_data = new_project.to_dict()
                return jsonify({
                    "success": True,
                    "data": project_data,
                    "message": "Proyecto creado correctamente"
                }), 201
            except Exception as e:
                logger.error(f"Error al serializar nuevo proyecto: {str(e)}")
                return jsonify({
                    "success": True,
                    "data": {
                        "id": new_project.id,
                        "name": new_project.name
                    },
                    "message": "Proyecto creado pero con errores al serializar datos completos"
                }), 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error al guardar proyecto en la base de datos: {str(e)}")
            return jsonify({
                "success": False,
                "error": "database_error",
                "message": f"Error al guardar el proyecto: {str(e)}"
            }), 500
    except Exception as e:
        logger.error(f"Error al crear proyecto: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": f"Error del servidor: {str(e)}"
        }), 500

@projects_bp.route('/<int:project_id>', methods=['PUT'])
@jwt_required()
def update_project(project_id):
    """Update an existing project"""
    try:
        # Obtener y convertir identidad del token a int
        current_user_id = get_jwt_identity()
        try:
            current_user_id_int = int(current_user_id)
        except (TypeError, ValueError):
            logger.error(f"ID de usuario inválido en token: {current_user_id}")
            return jsonify({
                "success": False,
                "error": "invalid_token_identity",
                "message": "ID de usuario inválido en el token"
            }), 401
            
        try:
            data = request.get_json()
        except Exception as e:
            logger.error(f"Error al parsear JSON: {str(e)}")
            return jsonify({
                "success": False,
                "error": "invalid_json",
                "message": "Formato JSON inválido en la solicitud"
            }), 400
        
        # Get project by ID
        project = Project.query.get(project_id)
        
        # Check if project exists
        if not project:
            return jsonify({
                "success": False,
                "error": "project_not_found",
                "message": f"No se encontró el proyecto con ID {project_id}"
            }), 404
        
        # Check if user has access to the project
        if project.owner_id != current_user_id_int:
            return jsonify({
                "success": False,
                "error": "unauthorized_access",
                "message": "No tiene permiso para modificar este proyecto"
            }), 403
        
        # Update project fields
        if 'name' in data:
            project.name = data['name']
        if 'description' in data:
            project.description = data['description']
        if 'metrics_config' in data:
            project.metrics_config = data['metrics_config']
        
        # Save changes to database
        try:
            db.session.commit()
            
            # Serializar respuesta
            try:
                project_data = project.to_dict()
                return jsonify({
                    "success": True,
                    "data": project_data,
                    "message": "Proyecto actualizado correctamente"
                }), 200
            except Exception as e:
                logger.error(f"Error al serializar proyecto actualizado {project_id}: {str(e)}")
                return jsonify({
                    "success": True,
                    "data": {
                        "id": project.id,
                        "name": project.name
                    },
                    "message": "Proyecto actualizado pero con errores al serializar datos completos"
                }), 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error al guardar cambios en el proyecto {project_id}: {str(e)}")
            return jsonify({
                "success": False,
                "error": "database_error",
                "message": f"Error al guardar los cambios: {str(e)}"
            }), 500
    except Exception as e:
        logger.error(f"Error al actualizar proyecto {project_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": f"Error del servidor: {str(e)}"
        }), 500

@projects_bp.route('/<int:project_id>', methods=['DELETE'])
@jwt_required()
def delete_project(project_id):
    """Delete an existing project"""
    try:
        # Obtener y convertir identidad del token a int
        current_user_id = get_jwt_identity()
        try:
            current_user_id_int = int(current_user_id)
        except (TypeError, ValueError):
            logger.error(f"ID de usuario inválido en token: {current_user_id}")
            return jsonify({
                "success": False,
                "error": "invalid_token_identity",
                "message": "ID de usuario inválido en el token"
            }), 401
        
        # Get project by ID
        project = Project.query.get(project_id)
        
        # Check if project exists
        if not project:
            return jsonify({
                "success": False,
                "error": "project_not_found",
                "message": f"No se encontró el proyecto con ID {project_id}"
            }), 404
        
        # Check if user has access to the project
        if project.owner_id != current_user_id_int:
            return jsonify({
                "success": False,
                "error": "unauthorized_access",
                "message": "No tiene permiso para eliminar este proyecto"
            }), 403
        
        # Guardar nombre del proyecto para mensaje de éxito
        project_name = project.name
        
        # Delete project from database
        try:
            db.session.delete(project)
            db.session.commit()
            
            return jsonify({
                "success": True,
                "message": f"Proyecto '{project_name}' eliminado correctamente"
            }), 200
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error al eliminar proyecto {project_id}: {str(e)}")
            return jsonify({
                "success": False,
                "error": "database_error",
                "message": f"Error al eliminar el proyecto: {str(e)}"
            }), 500
    except Exception as e:
        logger.error(f"Error al procesar solicitud de eliminación de proyecto {project_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": f"Error del servidor: {str(e)}"
        }), 500

@projects_bp.route('/<int:project_id>/quality-gate', methods=['GET'])
@jwt_required()
def get_quality_gate(project_id):
    """Get Quality Gate configuration for a project.
    Creates a default QualityGate if none exists (lazy initialization).
    """
    try:
        current_user_id = get_jwt_identity()
        try:
            current_user_id_int = int(current_user_id)
        except (TypeError, ValueError):
            return jsonify({"success": False, "error": "invalid_token_identity",
                            "message": "ID de usuario inválido en el token"}), 401

        # Verify project exists and user has access
        project = Project.query.get(project_id)
        if not project:
            return jsonify({"success": False, "error": "project_not_found",
                            "message": f"No se encontró el proyecto con ID {project_id}"}), 404
        if project.owner_id != current_user_id_int:
            return jsonify({"success": False, "error": "unauthorized_access",
                            "message": "No tiene permiso para acceder a este proyecto"}), 403

        # Get or create QualityGate for this project
        quality_gate = QualityGate.query.filter_by(project_id=project_id).first()
        if not quality_gate:
            # Lazy initialization: create with default thresholds
            quality_gate = QualityGate(
                project_id=project_id,
                name='Default Quality Gate',
                thresholds=QualityGate.get_default_thresholds(),
                is_active=True,
            )
            db.session.add(quality_gate)
            db.session.commit()
            logger.info(f"Created default QualityGate for project {project_id}")

        return jsonify({
            "success": True,
            "data": quality_gate.to_dict()
        }), 200

    except Exception as e:
        logger.error(f"Error al obtener Quality Gate del proyecto {project_id}: {str(e)}")
        return jsonify({"success": False, "error": "server_error",
                        "message": f"Error del servidor: {str(e)}"}), 500


@projects_bp.route('/<int:project_id>/quality-gate', methods=['PUT'])
@jwt_required()
def update_quality_gate(project_id):
    """Update Quality Gate thresholds for a project."""
    try:
        current_user_id = get_jwt_identity()
        try:
            current_user_id_int = int(current_user_id)
        except (TypeError, ValueError):
            return jsonify({"success": False, "error": "invalid_token_identity",
                            "message": "ID de usuario inválido en el token"}), 401

        # Verify project exists and user has access
        project = Project.query.get(project_id)
        if not project:
            return jsonify({"success": False, "error": "project_not_found",
                            "message": f"No se encontró el proyecto con ID {project_id}"}), 404
        if project.owner_id != current_user_id_int:
            return jsonify({"success": False, "error": "unauthorized_access",
                            "message": "No tiene permiso para modificar este proyecto"}), 403

        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "invalid_json",
                            "message": "Se requiere un cuerpo JSON"}), 400

        thresholds = data.get('thresholds')
        if thresholds is None:
            return jsonify({"success": False, "error": "missing_field",
                            "message": "El campo 'thresholds' es obligatorio"}), 400

        # Validate threshold values
        defaults = QualityGate.get_default_thresholds()
        valid_keys = set(defaults.keys())
        errors = []
        for key, value in thresholds.items():
            if key not in valid_keys:
                errors.append(f"Clave desconocida: '{key}'")
                continue
            if not isinstance(value, (int, float)):
                errors.append(f"'{key}' debe ser un número")
                continue
            if key.startswith('min_') and (value < 0 or value > 100):
                errors.append(f"'{key}' debe estar entre 0 y 100")
            if key.startswith('max_') and value < 0:
                errors.append(f"'{key}' no puede ser negativo")

        if errors:
            return jsonify({"success": False, "error": "validation_error",
                            "message": "Errores de validación", "details": errors}), 400

        # Get or create QualityGate
        quality_gate = QualityGate.query.filter_by(project_id=project_id).first()
        if not quality_gate:
            quality_gate = QualityGate(
                project_id=project_id,
                name=data.get('name', 'Default Quality Gate'),
                thresholds=thresholds,
                is_active=data.get('is_active', True),
            )
            db.session.add(quality_gate)
        else:
            # Merge: keep existing keys, update provided ones
            merged = {**quality_gate.thresholds, **thresholds}
            quality_gate.thresholds = merged
            if 'name' in data:
                quality_gate.name = data['name']
            if 'is_active' in data:
                quality_gate.is_active = data['is_active']

        db.session.commit()
        logger.info(f"Updated QualityGate for project {project_id}: {quality_gate.thresholds}")

        return jsonify({
            "success": True,
            "data": quality_gate.to_dict(),
            "message": "Quality Gate actualizado correctamente"
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al actualizar Quality Gate del proyecto {project_id}: {str(e)}")
        return jsonify({"success": False, "error": "server_error",
                        "message": f"Error del servidor: {str(e)}"}), 500
