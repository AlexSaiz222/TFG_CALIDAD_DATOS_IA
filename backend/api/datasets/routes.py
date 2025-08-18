from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
import pandas as pd
import logging

from extensions import db
from models.dataset import Dataset
from models.project import Project
from services.minio_service import MinioService
from services.dataset_service import DatasetService

# Configurar logger
logger = logging.getLogger(__name__)

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
    
    try:
        # Convert any potential NumPy types to Python native types
        dataset_list = []
        for dataset in datasets:
            dataset_dict = dataset.to_dict()
            # Ensure row_count and column_count are Python int
            if dataset_dict['row_count'] is not None:
                dataset_dict['row_count'] = int(dataset_dict['row_count'])
            if dataset_dict['column_count'] is not None:
                dataset_dict['column_count'] = int(dataset_dict['column_count'])
            # Add to list
            dataset_list.append(dataset_dict)
        
        return jsonify({
            "success": True,
            "data": dataset_list
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Server Error",
            "message": f"Error serializing dataset data: {str(e)}"
        }), 500

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
        
        try:
            # Save dataset to database
            db.session.add(new_dataset)
            db.session.commit()
            
            # Intentar convertir a diccionario de manera segura
            try:
                dataset_dict = new_dataset.to_dict()
            except Exception as dict_error:
                # Si falla la conversión a diccionario, crear uno manualmente
                dataset_dict = {
                    'id': new_dataset.id,
                    'name': new_dataset.name,
                    'description': new_dataset.description,
                    'project_id': new_dataset.project_id,
                    'file_path': new_dataset.file_path,
                    'file_size': int(new_dataset.file_size) if new_dataset.file_size is not None else None,
                    'row_count': int(new_dataset.row_count) if new_dataset.row_count is not None else None,
                    'column_count': int(new_dataset.column_count) if new_dataset.column_count is not None else None,
                    'created_at': new_dataset.created_at.isoformat(),
                    'updated_at': new_dataset.updated_at.isoformat(),
                    'evaluation_count': 0
                }
                
            return jsonify({
                "success": True,
                "data": dataset_dict
            }), 201
            
        except Exception as db_error:
            # Rollback en caso de error
            db.session.rollback()
            return jsonify({
                "success": False,
                "error": "Database Error",
                "message": f"Error al guardar el dataset: {str(db_error)}"
            }), 500
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Server Error",
            "message": f"Error al procesar el dataset: {str(e)}"
        }), 500

@datasets_bp.route('/', methods=['GET'])
@jwt_required()
def get_datasets():
    """Get all datasets for the current user"""
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
            # Get projects owned by the current user
            projects = Project.query.filter_by(owner_id=current_user_id_int).all()
            project_ids = [project.id for project in projects]
            
            # Get datasets for these projects
            datasets = Dataset.query.filter(Dataset.project_id.in_(project_ids)).all()
            
            try:
                # Convertir datasets a diccionarios de manera segura
                dataset_list = []
                for dataset in datasets:
                    try:
                        dataset_dict = dataset.to_dict()
                        dataset_list.append(dataset_dict)
                    except Exception as dict_error:
                        logger.warning(f"Error al serializar dataset {dataset.id}: {str(dict_error)}")
                        # Crear un diccionario mínimo con la información básica
                        dataset_list.append({
                            'id': dataset.id,
                            'name': dataset.name,
                            'project_id': dataset.project_id,
                            'error': "Error al serializar datos completos"
                        })
                
                return jsonify({
                    "success": True,
                    "data": dataset_list
                }), 200
            except Exception as e:
                logger.error(f"Error al serializar lista de datasets: {str(e)}")
                return jsonify({
                    "success": False,
                    "error": "serialization_error",
                    "message": f"Error al procesar datos de datasets: {str(e)}"
                }), 500
        except Exception as e:
            logger.error(f"Error al consultar datasets en la base de datos: {str(e)}")
            return jsonify({
                "success": False,
                "error": "database_error",
                "message": f"Error al obtener datasets: {str(e)}"
            }), 500
    except Exception as e:
        logger.error(f"Error inesperado al obtener datasets: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": f"Error del servidor: {str(e)}"
        }), 500

@datasets_bp.route('/<int:dataset_id>', methods=['GET'])
@jwt_required()
def get_dataset(dataset_id):
    """Get a specific dataset by ID"""
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
        
        # Get dataset by ID
        dataset = Dataset.query.get(dataset_id)
        
        # Check if dataset exists
        if not dataset:
            logger.warning(f"Dataset no encontrado: {dataset_id}")
            return jsonify({
                "success": False,
                "error": "dataset_not_found",
                "message": f"No se encontró el dataset con ID {dataset_id}"
            }), 404
        
        # Check if user has access to the dataset's project
        try:
            project = Project.query.get(dataset.project_id)
            if not project:
                logger.error(f"Proyecto no encontrado para dataset {dataset_id}: {dataset.project_id}")
                return jsonify({
                    "success": False,
                    "error": "project_not_found",
                    "message": f"No se encontró el proyecto asociado al dataset"
                }), 404
                
            if project.owner_id != current_user_id_int:
                logger.warning(f"Acceso no autorizado al dataset {dataset_id} por usuario {current_user_id}")
                return jsonify({
                    "success": False,
                    "error": "unauthorized_access",
                    "message": "No tiene permiso para acceder a este dataset"
                }), 403
        except Exception as e:
            logger.error(f"Error al verificar permisos para dataset {dataset_id}: {str(e)}")
            return jsonify({
                "success": False,
                "error": "permission_error",
                "message": f"Error al verificar permisos: {str(e)}"
            }), 500
        
        # Serializar dataset
        try:
            dataset_data = dataset.to_dict()
            return jsonify({
                "success": True,
                "data": dataset_data
            }), 200
        except Exception as e:
            logger.error(f"Error al serializar dataset {dataset_id}: {str(e)}")
            return jsonify({
                "success": False,
                "error": "serialization_error",
                "message": f"Error al procesar datos del dataset: {str(e)}"
            }), 500
    except Exception as e:
        logger.error(f"Error inesperado al obtener dataset {dataset_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": f"Error del servidor: {str(e)}"
        }), 500

@datasets_bp.route('/', methods=['POST'])
@jwt_required()
def upload_dataset():
    """Upload a new dataset"""
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
        
        # Check if project_id is provided
        project_id = request.form.get('project_id')
        if not project_id:
            logger.warning("Intento de carga de dataset sin ID de proyecto")
            return jsonify({
                "success": False,
                "error": "missing_project_id",
                "message": "El ID del proyecto es obligatorio"
            }), 400
        
        try:
            project_id = int(project_id)
        except (ValueError, TypeError):
            logger.warning(f"ID de proyecto inválido: {project_id}")
            return jsonify({
                "success": False,
                "error": "invalid_project_id",
                "message": "El ID del proyecto debe ser un número entero"
            }), 400
        
        # Check if project exists and user has access
        try:
            project = Project.query.get(project_id)
            if not project:
                logger.warning(f"Proyecto no encontrado: {project_id}")
                return jsonify({
                    "success": False,
                    "error": "project_not_found",
                    "message": f"No se encontró el proyecto con ID {project_id}"
                }), 404
                
            if project.owner_id != current_user_id_int:
                logger.warning(f"Acceso no autorizado al proyecto {project_id} por usuario {current_user_id}")
                return jsonify({
                    "success": False,
                    "error": "unauthorized_access",
                    "message": "No tiene permiso para acceder a este proyecto"
                }), 403
        except Exception as e:
            logger.error(f"Error al verificar proyecto {project_id}: {str(e)}")
            return jsonify({
                "success": False,
                "error": "project_verification_error",
                "message": f"Error al verificar el proyecto: {str(e)}"
            }), 500
        
        # Check if file is provided
        if 'file' not in request.files:
            logger.warning("Intento de carga de dataset sin archivo")
            return jsonify({
                "success": False,
                "error": "missing_file",
                "message": "No se proporcionó ningún archivo"
            }), 400
        
        file = request.files['file']
        
        # Check if filename is valid
        if file.filename == '':
            logger.warning("Intento de carga de dataset con nombre de archivo vacío")
            return jsonify({
                "success": False,
                "error": "empty_filename",
                "message": "No se seleccionó ningún archivo"
            }), 400
        
        # Check file extension
        if not file.filename.endswith('.csv'):
            logger.warning(f"Intento de carga de archivo no soportado: {file.filename}")
            return jsonify({
                "success": False,
                "error": "unsupported_file_type",
                "message": "Solo se admiten archivos CSV"
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
            try:
                db.session.add(new_dataset)
                db.session.commit()
                
                # Intentar serializar la respuesta
                try:
                    dataset_dict = new_dataset.to_dict()
                    return jsonify({
                        "success": True,
                        "data": dataset_dict,
                        "message": "Dataset cargado correctamente"
                    }), 201
                except Exception as dict_error:
                    logger.error(f"Error al serializar nuevo dataset: {str(dict_error)}")
                    return jsonify({
                        "success": True,
                        "data": {
                            "id": new_dataset.id,
                            "name": new_dataset.name,
                            "project_id": new_dataset.project_id
                        },
                        "message": "Dataset cargado pero con errores al serializar datos completos"
                    }), 201
            except Exception as db_error:
                db.session.rollback()
                logger.error(f"Error al guardar dataset en la base de datos: {str(db_error)}")
                return jsonify({
                    "success": False,
                    "error": "database_error",
                    "message": f"Error al guardar el dataset: {str(db_error)}"
                }), 500
        except Exception as e:
            logger.error(f"Error al procesar dataset: {str(e)}")
            return jsonify({
                "success": False,
                "error": "processing_error",
                "message": f"Error al procesar el dataset: {str(e)}"
            }), 500
    except Exception as e:
        logger.error(f"Error inesperado al cargar dataset: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": f"Error del servidor: {str(e)}"
        }), 500

@datasets_bp.route('/<int:dataset_id>/preview', methods=['GET'])
@jwt_required()
def preview_dataset(dataset_id):
    """Get a preview of the dataset (first 100 rows)"""
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
        
        # Get dataset by ID
        dataset = Dataset.query.get(dataset_id)
        
        # Check if dataset exists
        if not dataset:
            logger.warning(f"Dataset no encontrado para vista previa: {dataset_id}")
            return jsonify({
                "success": False,
                "error": "dataset_not_found",
                "message": f"No se encontró el dataset con ID {dataset_id}"
            }), 404
        
        # Check if user has access to the dataset's project
        try:
            project = Project.query.get(dataset.project_id)
            if not project:
                logger.error(f"Proyecto no encontrado para dataset {dataset_id}: {dataset.project_id}")
                return jsonify({
                    "success": False,
                    "error": "project_not_found",
                    "message": "No se encontró el proyecto asociado al dataset"
                }), 404
                
            if project.owner_id != current_user_id_int:
                logger.warning(f"Acceso no autorizado a la vista previa del dataset {dataset_id} por usuario {current_user_id}")
                return jsonify({
                    "success": False,
                    "error": "unauthorized_access",
                    "message": "No tiene permiso para acceder a este dataset"
                }), 403
        except Exception as e:
            logger.error(f"Error al verificar permisos para vista previa del dataset {dataset_id}: {str(e)}")
            return jsonify({
                "success": False,
                "error": "permission_error",
                "message": f"Error al verificar permisos: {str(e)}"
            }), 500
        
        try:
            # Get dataset preview
            preview_data = dataset_service.get_dataset_preview(dataset.file_path)
            
            # Asegurar que el esquema sea serializable
            schema = dataset.schema
            if schema is None:
                schema = {}
            
            return jsonify({
                "success": True,
                "data": {
                    "preview": preview_data,
                    "schema": schema
                }
            }), 200
        except FileNotFoundError:
            logger.error(f"Archivo no encontrado para dataset {dataset_id}: {dataset.file_path}")
            return jsonify({
                "success": False,
                "error": "file_not_found",
                "message": "El archivo del dataset no se encuentra en el almacenamiento"
            }), 404
        except Exception as e:
            logger.error(f"Error al obtener vista previa del dataset {dataset_id}: {str(e)}")
            return jsonify({
                "success": False,
                "error": "preview_error",
                "message": f"Error al obtener vista previa: {str(e)}"
            }), 500
    except Exception as e:
        logger.error(f"Error inesperado al obtener vista previa del dataset {dataset_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": f"Error del servidor: {str(e)}"
        }), 500

@datasets_bp.route('/<int:dataset_id>', methods=['DELETE'])
@jwt_required()
def delete_dataset(dataset_id):
    """Delete an existing dataset"""
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
        
        # Get dataset by ID
        dataset = Dataset.query.get(dataset_id)
        
        # Check if dataset exists
        if not dataset:
            logger.warning(f"Intento de eliminar dataset inexistente: {dataset_id}")
            return jsonify({
                "success": False,
                "error": "dataset_not_found",
                "message": f"No se encontró el dataset con ID {dataset_id}"
            }), 404
        
        # Guardar nombre del dataset para mensaje de éxito
        dataset_name = dataset.name
        
        # Check if user has access to the dataset's project
        try:
            project = Project.query.get(dataset.project_id)
            if not project:
                logger.error(f"Proyecto no encontrado para dataset {dataset_id}: {dataset.project_id}")
                return jsonify({
                    "success": False,
                    "error": "project_not_found",
                    "message": "No se encontró el proyecto asociado al dataset"
                }), 404
                
            if project.owner_id != current_user_id_int:
                logger.warning(f"Acceso no autorizado para eliminar dataset {dataset_id} por usuario {current_user_id}")
                return jsonify({
                    "success": False,
                    "error": "unauthorized_access",
                    "message": "No tiene permiso para eliminar este dataset"
                }), 403
        except Exception as e:
            logger.error(f"Error al verificar permisos para eliminar dataset {dataset_id}: {str(e)}")
            return jsonify({
                "success": False,
                "error": "permission_error",
                "message": f"Error al verificar permisos: {str(e)}"
            }), 500
        
        try:
            # Delete dataset file from storage
            try:
                minio_service.delete_file(dataset.file_path)
            except Exception as storage_error:
                # Registrar error pero continuar con la eliminación de la BD
                logger.warning(f"Error al eliminar archivo de dataset {dataset_id}: {str(storage_error)}")
            
            # Delete dataset from database
            try:
                db.session.delete(dataset)
                db.session.commit()
                
                logger.info(f"Dataset eliminado correctamente: {dataset_id} - {dataset_name}")
                return jsonify({
                    "success": True,
                    "message": f"Dataset '{dataset_name}' eliminado correctamente"
                }), 200
            except Exception as db_error:
                db.session.rollback()
                logger.error(f"Error al eliminar dataset {dataset_id} de la base de datos: {str(db_error)}")
                return jsonify({
                    "success": False,
                    "error": "database_error",
                    "message": f"Error al eliminar el dataset de la base de datos: {str(db_error)}"
                }), 500
        except Exception as e:
            logger.error(f"Error al eliminar dataset {dataset_id}: {str(e)}")
            return jsonify({
                "success": False,
                "error": "deletion_error",
                "message": f"Error al eliminar el dataset: {str(e)}"
            }), 500
    except Exception as e:
        logger.error(f"Error inesperado al eliminar dataset {dataset_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": f"Error del servidor: {str(e)}"
        }), 500
