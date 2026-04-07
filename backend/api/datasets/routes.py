from flask import Blueprint, request, jsonify, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
import io
import pandas as pd
import numpy as np
import logging
from datetime import datetime, timezone

from extensions import db
from models.dataset import Dataset
from models.project import Project
from services.minio_service import MinioService
from services.dataset_service import DatasetService
from services.evaluation_service import EvaluationService
from models.evaluation import Evaluation
from schemas.evaluation_schema import create_evaluation_schema

# Configurar logger
logger = logging.getLogger(__name__)

datasets_bp = Blueprint('datasets', __name__, url_prefix='/datasets')
minio_service = MinioService()
dataset_service = DatasetService()
evaluation_service = EvaluationService()

# Register this blueprint with a different URL prefix for project-related endpoints
project_datasets_bp = Blueprint('project_datasets', __name__, url_prefix='/projects/<int:project_id>/datasets')

@project_datasets_bp.route('', methods=['GET'])
@jwt_required()
def get_project_datasets(project_id):
    """Get all datasets for a specific project"""
    try:
        # Obtener ID del usuario del token JWT
        try:
            current_user_id = get_jwt_identity()
            if current_user_id is None:
                logger.error(f"Token JWT no contiene identidad de usuario")
                return jsonify({
                    "success": True,  # Cambiar a True para evitar errores en frontend
                    "data": [],
                    "warning": "Error de autenticación: token sin identidad"
                }), 200  # Devolver 200 en lugar de 401 para evitar problemas
        except Exception as jwt_error:
            logger.error(f"Error al obtener identidad del token: {str(jwt_error)}")
            return jsonify({
                "success": True,
                "data": [],
                "warning": "Error de autenticación"
            }), 200
        
        # Convertir ID de usuario a entero de forma segura
        try:
            current_user_id_int = int(current_user_id)
        except (ValueError, TypeError):
            logger.error(f"ID de usuario inválido en token: {current_user_id}")
            return jsonify({
                "success": True,  # Cambiar a True para evitar errores en frontend
                "data": [],
                "warning": "ID de usuario inválido en el token"
            }), 200  # Devolver 200 en lugar de 401
        
        # Verificar que project_id sea un entero válido
        try:
            project_id_int = int(project_id)
        except (ValueError, TypeError):
            logger.error(f"ID de proyecto inválido: {project_id}")
            return jsonify({
                "success": True,
                "data": [],
                "warning": f"ID de proyecto inválido: {project_id}"
            }), 200
        
        # Check if project exists
        try:
            project = Project.query.get(project_id_int)
            if not project:
                logger.warning(f"Proyecto no encontrado: {project_id}")
                return jsonify({
                    "success": True,  # Cambiar a True para evitar errores en frontend
                    "data": [],
                    "warning": f"Proyecto {project_id} no encontrado"
                }), 200  # Devolver 200 en lugar de 404
        except Exception as project_error:
            logger.error(f"Error al obtener proyecto {project_id}: {str(project_error)}")
            return jsonify({
                "success": True,
                "data": [],
                "warning": f"Error al obtener proyecto {project_id}"
            }), 200
        
        # Check if user has access to the project
        try:
            if project.owner_id != current_user_id_int:
                logger.warning(f"Usuario {current_user_id_int} no tiene acceso al proyecto {project_id}")
                return jsonify({
                    "success": True,  # Cambiar a True para evitar errores en frontend
                    "data": [],
                    "warning": "No tienes acceso a este proyecto"
                }), 200  # Devolver 200 en lugar de 403
        except Exception as access_error:
            logger.error(f"Error al verificar acceso al proyecto {project_id}: {str(access_error)}")
            return jsonify({
                "success": True,
                "data": [],
                "warning": "Error al verificar permisos de acceso"
            }), 200
        
        # Get datasets for this project
        try:
            datasets = Dataset.query.filter_by(project_id=project_id_int).all()
        except Exception as dataset_query_error:
            logger.error(f"Error al consultar datasets del proyecto {project_id}: {str(dataset_query_error)}")
            return jsonify({
                "success": True,
                "data": [],
                "warning": "Error al consultar datasets en la base de datos"
            }), 200
        
        # Convert datasets to dictionaries safely
        dataset_list = []
        for dataset in datasets:
            try:
                # Usar un método más seguro para convertir a diccionario
                dataset_dict = {
                    'id': dataset.id,
                    'name': dataset.name,
                    'description': dataset.description or '',
                    'project_id': dataset.project_id,
                    'file_path': dataset.file_path,
                    'file_size': int(dataset.file_size) if dataset.file_size is not None else 0,
                    'row_count': int(dataset.row_count) if dataset.row_count is not None else 0,
                    'column_count': int(dataset.column_count) if dataset.column_count is not None else 0,
                    'schema': [],  # Simplificar para evitar errores de serialización
                    'created_at': dataset.created_at.isoformat() if dataset.created_at else '',
                    'updated_at': dataset.updated_at.isoformat() if dataset.updated_at else '',
                    'evaluation_count': 0,  # Valor por defecto seguro
                    'version': getattr(dataset, 'version', 1) or 1,
                    'parent_dataset_id': getattr(dataset, 'parent_dataset_id', None),
                    'is_latest': getattr(dataset, 'is_latest', True),
                    'version_tag': getattr(dataset, 'version_tag', None)
                }
                dataset_list.append(dataset_dict)
            except Exception as dict_error:
                logger.warning(f"Error al serializar dataset {dataset.id}: {str(dict_error)}")
                # Crear un diccionario mínimo con la información básica
                try:
                    dataset_list.append({
                        'id': dataset.id,
                        'name': getattr(dataset, 'name', f"Dataset {dataset.id}"),
                        'project_id': dataset.project_id,
                        'created_at': '',
                        'updated_at': '',
                        'file_size': 0,
                        'row_count': 0,
                        'column_count': 0,
                        'schema': [],
                        'evaluation_count': 0,
                        'version': getattr(dataset, 'version', 1) or 1,
                        'parent_dataset_id': getattr(dataset, 'parent_dataset_id', None),
                        'is_latest': getattr(dataset, 'is_latest', True),
                        'version_tag': getattr(dataset, 'version_tag', None)
                    })
                except Exception as minimal_dict_error:
                    logger.error(f"Error al crear diccionario mínimo para dataset: {str(minimal_dict_error)}")
                    # No añadir este dataset si falla completamente
        
        return jsonify({
            "success": True,
            "data": dataset_list
        }), 200
    except Exception as e:
        logger.error(f"Error inesperado al obtener datasets del proyecto {project_id}: {str(e)}")
        # Devolver array vacío en lugar de error 500
        return jsonify({
            "success": True,
            "data": [],
            "warning": "Error inesperado al obtener datasets del proyecto"
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
        try:
            dataset_info = dataset_service.process_dataset(file, project_id)
        except Exception as csv_error:
            # Handle CSV parsing errors with user-friendly messages
            error_msg = str(csv_error)
            logger.error(f"Error processing CSV file: {error_msg}")
            
            # Translate common errors to user-friendly messages
            user_msg = None
            if "xlsx" in error_msg.lower():
                user_msg = "El archivo parece ser un Excel (.xlsx). Convierte a CSV antes de subir."
            elif "gzip" in error_msg.lower():
                user_msg = "El archivo está comprimido (gzip). Sube el CSV descomprimido."
            elif "0 bytes" in error_msg.lower() or "empty" in error_msg.lower() or "vacío" in error_msg.lower():
                user_msg = "El archivo del dataset está vacío. Vuelve a subir un CSV con contenido."
            elif "No columns to parse" in error_msg or "Sin columnas" in error_msg:
                user_msg = "No se detectaron columnas. Verifica que el CSV tenga encabezados y separadores válidos."
            elif "Failed to parse CSV" in error_msg:
                user_msg = "No se pudo analizar el CSV. Verifica que el formato sea correcto y que use separadores estándar (coma, punto y coma, tabulador)."
            elif "encoding" in error_msg.lower() or "codec" in error_msg.lower():
                user_msg = "Problema con la codificación del archivo. Intenta guardar el CSV con codificación UTF-8."
            else:
                # Default message for other errors
                user_msg = f"Error al procesar el dataset: {error_msg}"
            
            return jsonify({
                "success": False,
                "error": "CSV Processing Error",
                "message": user_msg
            }), 400  # 400 Bad Request is more appropriate for invalid file format
        
        # Parse sensitive_columns from form data (JSON string)
        sensitive_columns = []
        if 'sensitive_columns' in request.form:
            try:
                import json as _json
                sensitive_columns = _json.loads(request.form.get('sensitive_columns', '[]'))
            except Exception as _e:
                logger.warning(f"Error parsing sensitive_columns: {str(_e)}")

        # Create new dataset record
        new_dataset = Dataset(
            name=request.form.get('name', file.filename),
            description=request.form.get('description', ''),
            project_id=project_id,
            file_path=dataset_info['file_path'],
            file_size=dataset_info['file_size'],
            row_count=dataset_info['row_count'],
            column_count=dataset_info['column_count'],
            schema=dataset_info['schema'],
            sensitive_columns=sensitive_columns
        )
        
        # Add schema_meta if available
        if 'schema_meta' in dataset_info:
            new_dataset.schema_meta = dataset_info['schema_meta']
        
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
        logger.error(f"Error inesperado al procesar dataset: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Server Error",
            "message": f"Error al procesar el dataset: {str(e)}"
        }), 500

@datasets_bp.route('', methods=['GET'])
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
                "message": "ID de usuario inválido en el token",
                "data": []  # Siempre incluir data vacío para compatibilidad con frontend
            }), 401
        
        try:
            # Get projects owned by the current user
            try:
                projects = Project.query.filter_by(owner_id=current_user_id_int).all()
                project_ids = [project.id for project in projects]
            except Exception as project_error:
                logger.error(f"Error al obtener proyectos: {str(project_error)}")
                # Devolver array vacío en lugar de error
                return jsonify({
                    "success": True,
                    "data": [],
                    "warning": "No se pudieron cargar los proyectos"
                }), 200
            
            # Si no hay proyectos, devolver array vacío
            if not project_ids:
                logger.info(f"Usuario {current_user_id_int} no tiene proyectos")
                return jsonify({
                    "success": True,
                    "data": []
                }), 200
            
            # Get datasets for these projects
            try:
                datasets = Dataset.query.filter(Dataset.project_id.in_(project_ids)).all()
            except Exception as dataset_query_error:
                logger.error(f"Error al consultar datasets: {str(dataset_query_error)}")
                # Devolver array vacío en lugar de error
                return jsonify({
                    "success": True,
                    "data": [],
                    "warning": "Error al consultar datasets en la base de datos"
                }), 200
            
            # Convertir datasets a diccionarios de manera segura
            dataset_list = []
            for dataset in datasets:
                try:
                    # Usar un método más seguro para convertir a diccionario
                    dataset_dict = {
                        'id': dataset.id,
                        'name': dataset.name,
                        'description': dataset.description or '',
                        'project_id': dataset.project_id,
                        'file_path': dataset.file_path,
                        'file_size': int(dataset.file_size) if dataset.file_size is not None else 0,
                        'row_count': int(dataset.row_count) if dataset.row_count is not None else 0,
                        'column_count': int(dataset.column_count) if dataset.column_count is not None else 0,
                        'schema': [],  # Simplificar para evitar errores de serialización
                        'created_at': dataset.created_at.isoformat() if dataset.created_at else '',
                        'updated_at': dataset.updated_at.isoformat() if dataset.updated_at else '',
                        'evaluation_count': 0,  # Valor por defecto seguro
                        # Versioning fields
                        'parent_dataset_id': dataset.parent_dataset_id,
                        'version': dataset.version if dataset.version is not None else 1,
                        'version_tag': dataset.version_tag,
                        'is_latest': dataset.is_latest if dataset.is_latest is not None else True
                    }
                    dataset_list.append(dataset_dict)
                except Exception as dict_error:
                    logger.warning(f"Error al serializar dataset {dataset.id}: {str(dict_error)}")
                    # Crear un diccionario mínimo con la información básica
                    dataset_list.append({
                        'id': dataset.id,
                        'name': getattr(dataset, 'name', f"Dataset {dataset.id}"),
                        'project_id': dataset.project_id,
                        'created_at': '',
                        'updated_at': '',
                        'file_size': 0,
                        'row_count': 0,
                        'column_count': 0,
                        'schema': [],
                        'evaluation_count': 0,
                        'parent_dataset_id': getattr(dataset, 'parent_dataset_id', None),
                        'version': getattr(dataset, 'version', 1) or 1,
                        'version_tag': getattr(dataset, 'version_tag', None),
                        'is_latest': getattr(dataset, 'is_latest', True) if getattr(dataset, 'is_latest', None) is not None else True
                    })
            
            return jsonify({
                "success": True,
                "data": dataset_list
            }), 200
            
        except Exception as e:
            logger.error(f"Error al procesar datasets: {str(e)}")
            # Devolver array vacío en lugar de error 500
            return jsonify({
                "success": True,
                "data": [],
                "warning": "Error al procesar datasets"
            }), 200
    except Exception as e:
        logger.error(f"Error inesperado al obtener datasets: {str(e)}")
        # Devolver array vacío en lugar de error 500
        return jsonify({
            "success": True,
            "data": [],
            "warning": "Error inesperado al obtener datasets"
        }), 200

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
            
            # Parse sensitive_columns from form data (JSON string)
            sensitive_columns = []
            if 'sensitive_columns' in request.form:
                try:
                    import json
                    sensitive_columns = json.loads(request.form.get('sensitive_columns', '[]'))
                except Exception as e:
                    logger.warning(f"Error parsing sensitive_columns: {str(e)}")
            
            # Create new dataset record
            new_dataset = Dataset(
                name=request.form.get('name', file.filename),
                description=request.form.get('description', ''),
                project_id=project_id,
                file_path=dataset_info['file_path'],
                file_size=dataset_info['file_size'],
                row_count=dataset_info['row_count'],
                column_count=dataset_info['column_count'],
                schema=dataset_info['schema'],
                sensitive_columns=sensitive_columns
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
            logger.info(f"Requesting preview for dataset {dataset_id} with file_path: {dataset.file_path}")
            
            # Download file from MinIO and log size
            file_data = dataset_service.minio_service.download_file(dataset.file_path)
            logger.debug(f"Downloaded {len(file_data)} bytes from MinIO for dataset {dataset_id}")
            
            # Log a sample of the first bytes for debugging
            if len(file_data) > 0:
                logger.debug(f"First 100 bytes: {repr(file_data[:100])}")
            else:
                logger.warning(f"Downloaded file for dataset {dataset_id} is empty (0 bytes)")
            
            # Process the downloaded data directly without downloading again
            preview_data = dataset_service.get_preview_from_bytes(file_data)
            logger.info(f"Successfully generated preview for dataset {dataset_id}: {len(preview_data)} rows")

            # Mask sensitive column values before returning
            sensitive_cols = dataset.sensitive_columns or []
            if sensitive_cols and preview_data:
                for row in preview_data:
                    for col in sensitive_cols:
                        if col in row:
                            row[col] = "***"

            # Get column names from the first row or from the dataset service
            columns = []
            if preview_data and len(preview_data) > 0:
                columns = list(preview_data[0].keys())
                logger.debug(f"Columns from preview: {columns}")
            else:
                # Try to get columns directly from the dataset
                try:
                    columns = dataset_service.get_dataset_columns(dataset.file_path)
                    logger.debug(f"Columns from dataset_service: {columns}")
                except Exception as column_error:
                    logger.warning(f"Could not get columns for dataset {dataset_id}: {str(column_error)}")
            
            # Return data in the format expected by the frontend
            # The frontend expects: { data: [...rows], columns: [...] }
            return jsonify({
                "success": True,
                "data": preview_data,
                "columns": columns
            }), 200
        except FileNotFoundError:
            logger.error(f"Archivo no encontrado para dataset {dataset_id}: {dataset.file_path}")
            return jsonify({
                "success": False,
                "error": "file_not_found",
                "message": "El archivo del dataset no se encuentra en el almacenamiento"
            }), 404
        except Exception as e:
            # Log the full error for debugging
            logger.error(f"Error al obtener vista previa del dataset {dataset_id}: {str(e)}")
            
            # Translate common errors to user-friendly messages
            error_msg = str(e)
            user_msg = None
            
            # Check for specific error patterns and provide friendly messages
            if "xlsx" in error_msg.lower():
                user_msg = "El archivo parece ser un Excel (.xlsx). Convierte a CSV antes de subir."
            elif "gzip" in error_msg.lower():
                user_msg = "El archivo está comprimido (gzip). Sube el CSV descomprimido."
            elif "0 bytes" in error_msg.lower() or "empty" in error_msg.lower() or "vacío" in error_msg.lower():
                user_msg = "El archivo del dataset está vacío. Vuelve a subir un CSV con contenido."
            elif "No columns to parse" in error_msg or "Sin columnas" in error_msg:
                user_msg = "No se detectaron columnas. Verifica que el CSV tenga encabezados y separadores válidos."
            elif "Failed to parse CSV" in error_msg:
                user_msg = "No se pudo analizar el CSV. Verifica que el formato sea correcto y que use separadores estándar (coma, punto y coma, tabulador)."
            elif "encoding" in error_msg.lower() or "codec" in error_msg.lower():
                user_msg = "Problema con la codificación del archivo. Intenta guardar el CSV con codificación UTF-8."
            else:
                # Default message for other errors
                user_msg = f"Error al obtener vista previa: {error_msg}"
            
            return jsonify({
                "success": False,
                "error": "preview_error",
                "message": user_msg
            }), 500
    except Exception as e:
        logger.error(f"Error inesperado al obtener vista previa del dataset {dataset_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": f"Error del servidor: {str(e)}"
        }), 500

@datasets_bp.route('/<int:dataset_id>/profiling', methods=['GET'])
@jwt_required()
def get_dataset_profiling(dataset_id):
    """Generate a full Data Profiling / EDA report for the dataset.

    Returns dataset overview, column type classification, descriptive
    statistics, univariate visualisation data (histograms, boxplots,
    bar charts) and a correlation matrix – all purely informative.
    
    Query parameters:
        iqr_factor (float, optional): Factor for IQR outlier detection. Default: 1.5
                                      Higher values = less sensitive (fewer outliers)
                                      Typical range: 1.0 (strict) to 5.0 (permissive)
    """
    try:
        # Get optional IQR factor from query parameters
        iqr_factor = request.args.get('iqr_factor', default=1.5, type=float)
        # Validate iqr_factor range
        if iqr_factor < 0.5 or iqr_factor > 10.0:
            return jsonify({
                "success": False,
                "error": "invalid_parameter",
                "message": "iqr_factor debe estar entre 0.5 y 10.0"
            }), 400
        
        current_user_id = get_jwt_identity()
        try:
            current_user_id_int = int(current_user_id)
        except (TypeError, ValueError):
            return jsonify({"success": False, "error": "invalid_token_identity",
                            "message": "ID de usuario inválido en el token"}), 401

        dataset = Dataset.query.get(dataset_id)
        if not dataset:
            return jsonify({"success": False, "error": "dataset_not_found",
                            "message": f"No se encontró el dataset con ID {dataset_id}"}), 404

        project = Project.query.get(dataset.project_id)
        if not project:
            return jsonify({"success": False, "error": "project_not_found",
                            "message": "No se encontró el proyecto asociado al dataset"}), 404
        if project.owner_id != current_user_id_int:
            return jsonify({"success": False, "error": "unauthorized_access",
                            "message": "No tiene permiso para acceder a este dataset"}), 403

        # ── Download & read CSV ──────────────────────────────────────
        file_data = dataset_service.minio_service.download_file(dataset.file_path)
        df = pd.read_csv(io.BytesIO(file_data))

        total_rows = len(df)
        total_cols = len(df.columns)

        # ── 1. Dataset Overview ──────────────────────────────────────
        total_cells = total_rows * total_cols
        total_missing = int(df.isna().sum().sum())
        missing_percent = round((total_missing / total_cells * 100) if total_cells > 0 else 0, 2)
        duplicate_rows = int(df.duplicated().sum())
        duplicate_percent = round((duplicate_rows / total_rows * 100) if total_rows > 0 else 0, 2)
        estimated_size_bytes = int(dataset.file_size) if dataset.file_size else len(file_data)

        overview = {
            "total_rows": total_rows,
            "total_columns": total_cols,
            "total_cells": total_cells,
            "total_missing": total_missing,
            "missing_percent": missing_percent,
            "duplicate_rows": duplicate_rows,
            "duplicate_percent": duplicate_percent,
            "estimated_size_bytes": estimated_size_bytes,
        }

        # ── Helper: classify a column ────────────────────────────────
        def classify_column(series, col_name):
            """Return (category, sub_type) for a pandas Series."""
            if pd.api.types.is_bool_dtype(series):
                return ("categorical", "binary")
            if pd.api.types.is_numeric_dtype(series):
                nunique = series.nunique(dropna=True)
                if pd.api.types.is_float_dtype(series) or nunique > 20:
                    return ("numeric", "continuous")
                return ("numeric", "discrete")
            # Object / string columns
            nunique = series.nunique(dropna=True)
            if nunique <= 2:
                return ("categorical", "binary")
            if nunique <= 30:
                return ("categorical", "nominal")
            return ("categorical", "text")

        # ── 2. Column type detection & 3. Descriptive stats ──────────
        columns_info = []
        numeric_cols = []
        categorical_cols = []

        for col in df.columns:
            series = df[col]
            cat, sub = classify_column(series, col)
            n_missing = int(series.isna().sum())
            n_valid = int(series.notna().sum())
            missing_pct = round((n_missing / total_rows * 100) if total_rows > 0 else 0, 2)
            n_unique = int(series.nunique(dropna=True))

            col_info = {
                "name": col,
                "dtype": str(series.dtype),
                "category": cat,
                "sub_type": sub,
                "n_missing": n_missing,
                "n_valid": n_valid,
                "missing_percent": missing_pct,
                "n_unique": n_unique,
            }

            if cat == "numeric":
                numeric_cols.append(col)
                clean = series.dropna()
                if len(clean) > 0:
                    q1 = float(clean.quantile(0.25))
                    q3 = float(clean.quantile(0.75))
                    col_info.update({
                        "mean": round(float(clean.mean()), 4),
                        "median": round(float(clean.median()), 4),
                        "std": round(float(clean.std()), 4),
                        "min": float(clean.min()),
                        "max": float(clean.max()),
                        "q1": round(q1, 4),
                        "q3": round(q3, 4),
                        "iqr": round(q3 - q1, 4),
                        "skewness": round(float(clean.skew()), 4),
                        "kurtosis": round(float(clean.kurtosis()), 4),
                    })

                    # Histogram data (max 30 bins)
                    n_bins = min(30, max(10, n_unique))
                    counts, bin_edges = np.histogram(clean, bins=n_bins)
                    col_info["histogram"] = {
                        "bins": [round(float(b), 4) for b in bin_edges[:-1]],
                        "counts": [int(c) for c in counts],
                    }

                    # Boxplot data (using configurable IQR factor)
                    iqr = q3 - q1
                    lower_fence = float(q1 - iqr_factor * iqr)
                    upper_fence = float(q3 + iqr_factor * iqr)
                    outlier_mask = (clean < lower_fence) | (clean > upper_fence)
                    outlier_values = clean[outlier_mask]
                    col_info["boxplot"] = {
                        "min": float(clean.min()),
                        "q1": round(q1, 4),
                        "median": round(float(clean.median()), 4),
                        "q3": round(q3, 4),
                        "max": float(clean.max()),
                        "lower_fence": round(lower_fence, 4),
                        "upper_fence": round(upper_fence, 4),
                        "outlier_count": int(outlier_mask.sum()),
                        "outliers_sample": [round(float(v), 4) for v in outlier_values.head(50).values],
                    }
                else:
                    col_info.update({"mean": None, "median": None, "std": None,
                                     "min": None, "max": None, "q1": None,
                                     "q3": None, "iqr": None,
                                     "skewness": None, "kurtosis": None,
                                     "histogram": None, "boxplot": None})
            else:
                categorical_cols.append(col)
                clean = series.dropna()
                mode_val = str(clean.mode().iloc[0]) if len(clean) > 0 and len(clean.mode()) > 0 else None
                col_info["mode"] = mode_val

                # Bar chart – top 20 categories
                if len(clean) > 0:
                    value_counts = clean.astype(str).value_counts().head(20)
                    col_info["bar_chart"] = {
                        "labels": value_counts.index.tolist(),
                        "counts": [int(v) for v in value_counts.values],
                    }
                else:
                    col_info["bar_chart"] = None

            columns_info.append(col_info)

        # ── Redact statistics for sensitive columns ──────────────────
        sensitive_cols = dataset.sensitive_columns or []
        _REDACTED = {"redacted": True}
        for col_info in columns_info:
            if col_info["name"] in sensitive_cols:
                # Keep structural metadata, remove all value-derived stats
                for key in ["mean", "median", "std", "min", "max", "q1", "q3",
                            "iqr", "skewness", "kurtosis", "histogram", "boxplot",
                            "mode", "bar_chart"]:
                    col_info.pop(key, None)
                col_info["redacted"] = True

        # ── 4. Type summary ──────────────────────────────────────────
        type_summary = {
            "numeric_count": len(numeric_cols),
            "categorical_count": len(categorical_cols),
            "numeric_columns": numeric_cols,
            "categorical_columns": categorical_cols,
        }

        # ── 5. Correlation matrix (numeric only, excluding sensitive) ─
        safe_numeric_cols = [c for c in numeric_cols if c not in sensitive_cols]
        correlation_matrix = None
        if len(safe_numeric_cols) >= 2:
            # Calculate both Pearson and Spearman correlations
            corr_pearson = df[safe_numeric_cols].corr(method='pearson')
            corr_spearman = df[safe_numeric_cols].corr(method='spearman')
            
            correlation_matrix = {
                "columns": safe_numeric_cols,
                "pearson": [[round(float(corr_pearson.iloc[i, j]), 4)
                            for j in range(len(safe_numeric_cols))]
                           for i in range(len(safe_numeric_cols))],
                "spearman": [[round(float(corr_spearman.iloc[i, j]), 4)
                             for j in range(len(safe_numeric_cols))]
                            for i in range(len(safe_numeric_cols))],
            }

        profiling_result = {
            "overview": overview,
            "type_summary": type_summary,
            "columns": columns_info,
            "correlation_matrix": correlation_matrix,
        }

        return jsonify({"success": True, "data": profiling_result}), 200

    except Exception as e:
        logger.error(f"Error generating profiling for dataset {dataset_id}: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": "profiling_error",
                        "message": f"Error al generar el profiling: {str(e)}"}), 500


@datasets_bp.route('/<int:dataset_id>/duplicates', methods=['GET'])
@jwt_required()
def get_duplicate_rows(dataset_id):
    """Get actual duplicate rows from a dataset"""
    try:
        current_user_id = get_jwt_identity()
        try:
            current_user_id_int = int(current_user_id)
        except (TypeError, ValueError):
            return jsonify({"success": False, "error": "invalid_token_identity"}), 401
        
        dataset = Dataset.query.get(dataset_id)
        if not dataset:
            return jsonify({"success": False, "error": "dataset_not_found"}), 404
        
        if dataset.project.owner_id != current_user_id_int:
            return jsonify({"success": False, "error": "unauthorized"}), 403
        
        minio_service = MinioService()
        file_data = minio_service.download_file(dataset.file_path)
        
        if dataset.file_path.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(file_data))
        elif dataset.file_path.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(file_data))
        else:
            return jsonify({"success": False, "error": "unsupported_format"}), 400
        
        # Find duplicate rows — group by all columns to detect identical rows.
        # Use .copy() to avoid pandas SettingWithCopyWarning / copy-on-write issues.
        duplicated_mask = df.duplicated(keep=False)
        duplicate_rows = df[duplicated_mask].copy()

        # Get unique duplicate groups
        duplicate_groups = []
        if not duplicate_rows.empty:
            group_cols = list(df.columns)
            for _, group in duplicate_rows.groupby(group_cols, dropna=False):
                # Each group is a set of identical rows
                sample = group.head(5).where(pd.notnull(group.head(5)), None)
                duplicate_groups.append({
                    'count': len(group),
                    'indices': group.index.tolist(),
                    'sample': sample.to_dict('records'),
                })
        
        # Mask sensitive column values in duplicate samples
        sensitive_cols = dataset.sensitive_columns or []
        if sensitive_cols:
            for group in duplicate_groups:
                for row in group['sample']:
                    for col in sensitive_cols:
                        if col in row:
                            row[col] = "***"

        return jsonify({
            "success": True,
            "total_duplicates": int(duplicated_mask.sum()),
            "duplicate_groups": duplicate_groups[:50],  # Limit to 50 groups
            "total_groups": len(duplicate_groups)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting duplicates for dataset {dataset_id}: {str(e)}", exc_info=True)
        return jsonify({"success": False, "error": "server_error", "message": str(e)}), 500


@datasets_bp.route('/<int:dataset_id>/evaluations', methods=['GET'])
@jwt_required()
def list_dataset_evaluations(dataset_id):
    """Get all evaluations for a specific dataset"""
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
            logger.warning(f"Dataset no encontrado para evaluaciones: {dataset_id}")
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
                logger.warning(f"Acceso no autorizado a las evaluaciones del dataset {dataset_id} por usuario {current_user_id}")
                return jsonify({
                    "success": False,
                    "error": "unauthorized_access",
                    "message": "No tiene permiso para acceder a este dataset"
                }), 403
        except Exception as e:
            logger.error(f"Error al verificar permisos para evaluaciones del dataset {dataset_id}: {str(e)}")
            return jsonify({
                "success": False,
                "error": "permission_error",
                "message": f"Error al verificar permisos: {str(e)}"
            }), 500
        
        # Get evaluations for this dataset
        try:
            evaluations = Evaluation.query.filter_by(dataset_id=dataset_id).all()
            evaluations_data = [evaluation.to_dict() for evaluation in evaluations]
            
            return jsonify({
                "success": True,
                "data": evaluations_data
            }), 200
        except Exception as e:
            logger.error(f"Error al obtener evaluaciones para dataset {dataset_id}: {str(e)}")
            return jsonify({
                "success": True,
                "data": [],
                "warning": "Error al obtener evaluaciones"
            }), 200
    except Exception as e:
        logger.error(f"Error inesperado al obtener evaluaciones del dataset {dataset_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": f"Error del servidor: {str(e)}"
        }), 500

@datasets_bp.route('/<int:dataset_id>/evaluations', methods=['POST'])
@jwt_required()
def create_dataset_evaluation(dataset_id):
    """Create a new evaluation for a specific dataset
    
    This endpoint creates a new evaluation for the specified dataset and starts
    the evaluation process asynchronously.
    
    Args:
        dataset_id (int): ID of the dataset to evaluate
    
    Request Body:
        metrics (list): List of metrics to evaluate, each with its configuration
        options (dict, optional): Additional options for the evaluation
    
    Returns:
        tuple: JSON with information about the created evaluation and HTTP code:
            - 202: If the evaluation was successfully started (Accepted)
            - 404: If the dataset doesn't exist
            - 403: If the user doesn't have access to the dataset
            - 400: If the metrics configuration is invalid
            - 500: If an error occurs when starting the evaluation
    """
    current_user_id = get_jwt_identity()
    logger.info(f"Usuario {current_user_id} solicitando nueva evaluación para dataset {dataset_id}")
    
    try:
        # Convert string ID from JWT to integer for database comparison
        current_user_id_int = int(current_user_id)
    except (ValueError, TypeError):
        return jsonify({
            "success": False,
            "error": "Invalid token",
            "message": "Invalid user identification"
        }), 401
    
    # Verificar que el dataset existe y el usuario tiene acceso
    dataset = Dataset.query.get(dataset_id)
    if not dataset:
        logger.warning(f"Dataset {dataset_id} no encontrado")
        return jsonify({
            "success": False,
            "error": "Dataset no encontrado",
            "message": f"No se encontró el dataset con ID {dataset_id}"
        }), 404
    
    # Verificar permisos de acceso
    project = Project.query.get(dataset.project_id)
    if project.owner_id != current_user_id_int:
        logger.warning(f"Usuario {current_user_id} intentó acceder al dataset {dataset_id} sin permisos")
        return jsonify({
            "success": False,
            "error": "Acceso no autorizado",
            "message": "No tienes permisos para evaluar este dataset"
        }), 403
    
    # Obtener y validar datos de entrada
    data = request.get_json() or {}
    logger.info(f"Datos recibidos en create_dataset_evaluation para dataset {dataset_id}: {data}")
    
    # Obtener métricas configuradas en el proyecto
    # Si el proyecto tiene metrics_config, usarlas; si no, usar métricas por defecto
    project_metrics = project.metrics_config if project.metrics_config else []
    
    # Métricas por defecto (fallback si el proyecto no tiene configuración)
    default_metrics = project_metrics if len(project_metrics) > 0 else [
        {
            "id": "completeness",
            "parameters": {},
            "weight": 1.0
        },
        {
            "id": "uniqueness",
            "parameters": {},
            "weight": 1.0
        },
        {
            "id": "outliers",
            "parameters": {"method": "iqr", "factor": 1.5},
            "weight": 1.0
        }
    ]
    
    logger.info(f"Usando métricas del proyecto (total: {len(default_metrics)}): {default_metrics}")
    
    # Opciones por defecto
    default_options = {
        "sample_size": 1.0,
        "include_profiling": True
    }
    
    try:
        # Verificar si los datos están vacíos o son un objeto vacío
        if not data or (isinstance(data, dict) and len(data) == 0):
            logger.info("Configuración vacía recibida, usando métricas por defecto")
            data = {
                'metrics': default_metrics,
                'options': default_options
            }
        # Verificar si los datos vienen en el formato del frontend (metrics_config)
        # o en el formato esperado por el esquema (metrics y options)
        elif 'metrics_config' in data:
            # Formato del frontend
            metrics_config = data['metrics_config']
            logger.info(f"Formato frontend detectado con metrics_config: {type(metrics_config)}")
            
            # Verificar si metrics_config es una lista directamente o está anidado
            if isinstance(metrics_config, list):
                # Es una lista de métricas directamente
                if len(metrics_config) > 0:
                    logger.info(f"metrics_config es una lista de {len(metrics_config)} elementos")
                    data = {
                        'metrics': metrics_config,
                        'options': default_options
                    }
                else:
                    # Lista vacía, usar métricas por defecto
                    logger.info("Lista de métricas vacía, usando métricas por defecto")
                    data = {
                        'metrics': default_metrics,
                        'options': default_options
                    }
            elif isinstance(metrics_config, dict):
                if 'metrics' in metrics_config:
                    # Ya tiene la estructura correcta dentro de metrics_config
                    logger.info(f"metrics_config es un diccionario con clave 'metrics'")
                    
                    # Verificar si la lista de métricas está vacía
                    if not metrics_config['metrics'] or len(metrics_config['metrics']) == 0:
                        logger.info("Lista de métricas vacía en el diccionario, usando métricas por defecto")
                        metrics_config['metrics'] = default_metrics
                    
                    # Asegurar que hay opciones
                    if 'options' not in metrics_config or not metrics_config['options']:
                        metrics_config['options'] = default_options
                    
                    data = metrics_config
                else:
                    # Diccionario sin métricas, usar métricas por defecto
                    logger.info("Diccionario sin clave 'metrics', usando métricas por defecto")
                    data = {
                        'metrics': default_metrics,
                        'options': default_options
                    }
            else:
                # Formato desconocido, usar métricas por defecto
                logger.warning(f"Formato de metrics_config desconocido: {metrics_config}, usando métricas por defecto")
                data = {
                    'metrics': default_metrics,
                    'options': default_options
                }
        else:
            logger.info(f"No se encontró metrics_config en los datos, verificando estructura")
            
            # Verificar si ya tiene la estructura correcta
            if 'metrics' in data:
                # Verificar si la lista de métricas está vacía
                if not data['metrics'] or len(data['metrics']) == 0:
                    logger.info("Lista de métricas vacía, usando métricas por defecto")
                    data['metrics'] = default_metrics
                
                # Asegurar que hay opciones
                if 'options' not in data or not data['options']:
                    data['options'] = default_options
            else:
                # No tiene la estructura correcta, usar métricas por defecto
                logger.info("Estructura incorrecta, usando métricas por defecto")
                data = {
                    'metrics': default_metrics,
                    'options': default_options
                }
        
        # Validar datos con el esquema
        from marshmallow import ValidationError
        try:
            logger.info(f"Datos a validar: {data}")
            
            # Verificar que data tenga la estructura correcta antes de validar
            if 'metrics' not in data:
                logger.error(f"Falta la clave 'metrics' en los datos: {data}")
                return jsonify({
                    "success": False,
                    "error": "Formato inválido",
                    "message": "La configuración debe incluir una lista de métricas"
                }), 400
                
            if not isinstance(data['metrics'], list):
                logger.error(f"'metrics' no es una lista: {type(data['metrics'])}")
                return jsonify({
                    "success": False,
                    "error": "Formato inválido",
                    "message": "La configuración de métricas debe ser una lista"
                }), 400
                
            if len(data['metrics']) == 0:
                logger.error("Lista de métricas vacía")
                return jsonify({
                    "success": False,
                    "error": "Configuración inválida",
                    "message": "Debe especificar al menos una métrica"
                }), 400
            
            # Verificar cada métrica individualmente antes de validar
            for i, metric in enumerate(data['metrics']):
                if not isinstance(metric, dict):
                    logger.error(f"Métrica {i} no es un objeto: {type(metric)}")
                    return jsonify({
                        "success": False,
                        "error": "Formato inválido",
                        "message": f"La métrica en posición {i} debe ser un objeto"
                    }), 400
                    
                if 'id' not in metric:
                    logger.error(f"Métrica {i} no tiene ID: {metric}")
                    return jsonify({
                        "success": False,
                        "error": "Formato inválido",
                        "message": f"La métrica en posición {i} debe tener un ID"
                    }), 400
            
            # Ahora validar con el esquema
            validated_data = create_evaluation_schema.load(data)
            metrics = validated_data['metrics']
            options = validated_data.get('options', {})
            
            logger.info(f"Configuración de evaluación validada: {len(metrics)} métricas")
            
        except ValidationError as err:
            logger.error(f"Error de validación en solicitud de evaluación: {err.messages}")
            # Mostrar más detalles sobre el error
            for field, errors in err.messages.items():
                logger.error(f"Campo '{field}': {errors}")
            
            return jsonify({
                "success": False,
                "error": "Configuración inválida",
                "message": "La configuración de la evaluación contiene errores",
                "details": err.messages
            }), 400
        
        # Crear nueva evaluación usando SQL directo para evitar problemas con task_id
        import json
        from sqlalchemy import text
        
        # Preparar datos para la inserción
        metrics_json = json.dumps({
            'metrics': metrics,
            'options': options
        })
        now = datetime.utcnow()
        
        # Ejecutar SQL directo para insertar la evaluación con solo los campos que existen en la BD
        sql = text("""
            INSERT INTO evaluations 
            (dataset_id, status, metrics_config, created_at, updated_at) 
            VALUES (:dataset_id, :status, :metrics_config, :created_at, :updated_at) 
            RETURNING id
        """)
        
        result = db.session.execute(
            sql, 
            {
                'dataset_id': dataset_id,
                'status': 'pending',
                'metrics_config': metrics_json,
                'created_at': now,
                'updated_at': now
            }
        )
        
        # Obtener el ID de la evaluación creada
        evaluation_id = result.scalar()
        db.session.commit()
        
        try:
            # Ejecutar la evaluación directamente sin Celery ni hilos para garantizar que se complete
            from services.evaluation_service import EvaluationService
            
            # Crear instancia del servicio de evaluación
            evaluation_service = EvaluationService()
            
            # Actualizar estado a "processing"
            from sqlalchemy import text
            now = datetime.utcnow()
            update_sql = text("""
                UPDATE evaluations 
                SET status = 'processing', started_at = :started_at
                WHERE id = :id
            """)
            
            db.session.execute(update_sql, {'id': evaluation_id, 'started_at': now})
            db.session.commit()
            
            # Ejecutar evaluación directamente de forma síncrona
            logger.info(f"Ejecutando evaluación {evaluation_id} de forma síncrona")
            result = evaluation_service.run_evaluation(evaluation_id)
            
            if not result.get('success', False):
                logger.error(f"Error en evaluación {evaluation_id}: {result.get('error', 'Error desconocido')}")
                return jsonify({
                    "success": False,
                    "error": "Error al ejecutar evaluación",
                    "message": result.get('error', 'Error desconocido')
                }), 500
                
            logger.info(f"Evaluación {evaluation_id} completada con éxito")
            
            # La evaluación ya está completada, no hay necesidad de polling
            
            # Recargar la evaluación para tener los datos actualizados
            new_evaluation = Evaluation.query.get(evaluation_id)
            
            # Devolver respuesta con información de la evaluación creada
            try:
                eval_dict = new_evaluation.to_dict()
                return jsonify({
                    "success": True,
                    "data": {
                        "evaluation": eval_dict
                    },
                    "message": "Evaluación iniciada correctamente"
                }), 202  # 202 Accepted indica que la solicitud ha sido aceptada para procesamiento
            except Exception as e:
                logger.error(f"Error al serializar nueva evaluación {new_evaluation.id}: {str(e)}")
                # Devolver información básica si hay error de serialización
                return jsonify({
                    "success": True,
                    "data": {
                        "evaluation": {
                            "id": new_evaluation.id,
                            "dataset_id": new_evaluation.dataset_id,
                            "status": new_evaluation.status
                        }
                    },
                    "message": "Evaluación iniciada correctamente, pero con errores al serializar datos completos"
                }), 202
        
        except Exception as e:
            # Registrar error y actualizar estado de la evaluación
            db.session.rollback()
            # Actualizar estado a fallido usando SQL directo
            try:
                sql_failed = text("""
                    UPDATE evaluations 
                    SET status = 'failed'
                    WHERE id = :id
                """)
                db.session.execute(sql_failed, {'id': new_evaluation.id})
                db.session.commit()
            except Exception as db_error:
                logger.error(f"Error al actualizar estado de evaluación: {str(db_error)}")
                # No hacer nada más, ya que la evaluación podría no existir
            
            return jsonify({
                "success": False,
                "error": "Error al iniciar evaluación",
                "message": str(e)
            }), 500
    
    except Exception as e:
        logger.error(f"Error inesperado al crear evaluación: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Error del servidor",
            "message": f"Error al crear la evaluación: {str(e)}"
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


# ==================== VERSIONING ENDPOINTS ====================

@project_datasets_bp.route('/<int:dataset_id>/versions', methods=['GET'])
@jwt_required()
def get_dataset_versions(project_id, dataset_id):
    """Get all versions of a dataset"""
    try:
        current_user_id = get_jwt_identity()
        current_user_id_int = int(current_user_id)
        
        # Verify project access
        project = Project.query.get(project_id)
        if not project:
            return jsonify({
                "success": False,
                "error": "not_found",
                "message": "Proyecto no encontrado"
            }), 404
        
        if project.owner_id != current_user_id_int:
            return jsonify({
                "success": False,
                "error": "unauthorized",
                "message": "No tienes acceso a este proyecto"
            }), 403
        
        # Get the dataset
        dataset = Dataset.query.get(dataset_id)
        if not dataset:
            return jsonify({
                "success": False,
                "error": "not_found",
                "message": "Dataset no encontrado"
            }), 404
        
        if dataset.project_id != project_id:
            return jsonify({
                "success": False,
                "error": "not_found",
                "message": "Dataset no pertenece a este proyecto"
            }), 404
        
        # Get version history
        versions = dataset.get_version_history()
        
        # Import AnalysisRun for eager loading analysis data
        from models.analysis import AnalysisRun
        
        # Get latest analysis for each version in a single query
        version_ids = [v.id for v in versions]
        
        # Subquery to get latest completed analysis per dataset
        from sqlalchemy import func
        latest_analysis_subq = db.session.query(
            AnalysisRun.dataset_id,
            func.max(AnalysisRun.completed_at).label('max_completed')
        ).filter(
            AnalysisRun.dataset_id.in_(version_ids),
            AnalysisRun.status == 'COMPLETED'
        ).group_by(AnalysisRun.dataset_id).subquery()
        
        latest_analyses = db.session.query(AnalysisRun).join(
            latest_analysis_subq,
            db.and_(
                AnalysisRun.dataset_id == latest_analysis_subq.c.dataset_id,
                AnalysisRun.completed_at == latest_analysis_subq.c.max_completed
            )
        ).all()
        
        # Map analyses by dataset_id
        analysis_map = {a.dataset_id: a for a in latest_analyses}
        
        # Build response with analysis data
        versions_data = []
        for v in versions:
            v_dict = v.to_dict()
            analysis = analysis_map.get(v.id)
            if analysis:
                # Convert enum to string if necessary
                gate_status = analysis.quality_gate_status
                if hasattr(gate_status, 'value'):
                    gate_status = gate_status.value
                elif hasattr(gate_status, 'name'):
                    gate_status = gate_status.name
                
                v_dict['latestAnalysis'] = {
                    'quality_score': analysis.quality_score,
                    'quality_gate_status': str(gate_status) if gate_status else None,
                    'total_issues_count': analysis.total_issues_count or 0,
                    'completed_at': analysis.completed_at.isoformat() if analysis.completed_at else None
                }
            else:
                v_dict['latestAnalysis'] = None
            versions_data.append(v_dict)
        
        return jsonify({
            "success": True,
            "data": {
                "dataset_id": dataset_id,
                "total_versions": len(versions),
                "versions": versions_data
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error al obtener versiones del dataset {dataset_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": f"Error al obtener versiones: {str(e)}"
        }), 500


@project_datasets_bp.route('/<int:dataset_id>/new-version', methods=['POST'])
@jwt_required()
def upload_new_version(project_id, dataset_id):
    """Upload a new version of an existing dataset"""
    try:
        current_user_id = get_jwt_identity()
        current_user_id_int = int(current_user_id)
        
        # Verify project access
        project = Project.query.get(project_id)
        if not project:
            return jsonify({
                "success": False,
                "error": "not_found",
                "message": "Proyecto no encontrado"
            }), 404
        
        if project.owner_id != current_user_id_int:
            return jsonify({
                "success": False,
                "error": "unauthorized",
                "message": "No tienes acceso a este proyecto"
            }), 403
        
        # Get parent dataset
        parent_dataset = Dataset.query.get(dataset_id)
        if not parent_dataset:
            return jsonify({
                "success": False,
                "error": "not_found",
                "message": "Dataset padre no encontrado"
            }), 404
        
        if parent_dataset.project_id != project_id:
            return jsonify({
                "success": False,
                "error": "not_found",
                "message": "Dataset no pertenece a este proyecto"
            }), 404
        
        # Check if file is provided
        if 'file' not in request.files:
            return jsonify({
                "success": False,
                "error": "bad_request",
                "message": "No se proporcionó archivo"
            }), 400
        
        file = request.files['file']
        if file.filename == '' or not file.filename.endswith('.csv'):
            return jsonify({
                "success": False,
                "error": "bad_request",
                "message": "Solo se permiten archivos CSV"
            }), 400
        
        # Process the new file
        try:
            dataset_info = dataset_service.process_dataset(file, project_id)
        except Exception as csv_error:
            return jsonify({
                "success": False,
                "error": "csv_error",
                "message": f"Error al procesar el CSV: {str(csv_error)}"
            }), 400
        
        # Calculate new version number
        root_dataset = parent_dataset.get_root_dataset()
        versions = root_dataset.get_version_history()
        max_version = max(v.version or 1 for v in versions)

        # Mark ALL versions in chain as not latest (atomic, avoids race condition)
        for v in versions:
            v.is_latest = False
        
        # Parse sensitive_columns for the new version (inherit parent if not provided)
        new_sensitive_columns = parent_dataset.sensitive_columns or []
        if 'sensitive_columns' in request.form:
            try:
                import json as _json
                new_sensitive_columns = _json.loads(request.form.get('sensitive_columns', '[]'))
            except Exception as _e:
                logger.warning(f"Error parsing sensitive_columns for new version: {str(_e)}")

        # Create new version
        new_dataset = Dataset(
            name=parent_dataset.name,  # Keep original name
            description=request.form.get('description', parent_dataset.description),
            project_id=project_id,
            file_path=dataset_info['file_path'],
            file_size=dataset_info.get('file_size'),
            row_count=dataset_info.get('row_count'),
            column_count=dataset_info.get('column_count'),
            schema=dataset_info.get('schema'),
            parent_dataset_id=parent_dataset.id,
            version=max_version + 1,
            version_tag=request.form.get('version_tag'),
            is_latest=True,
            sensitive_columns=new_sensitive_columns
        )
        
        db.session.add(new_dataset)
        db.session.commit()
        
        logger.info(f"Nueva versión creada: Dataset {new_dataset.id} (v{new_dataset.version}) del dataset {parent_dataset.id}")
        
        return jsonify({
            "success": True,
            "data": new_dataset.to_dict(),
            "message": f"Versión {new_dataset.version} creada correctamente"
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al crear nueva versión del dataset {dataset_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": f"Error al crear nueva versión: {str(e)}"
        }), 500


@project_datasets_bp.route('/<int:dataset_id>/compare/<int:other_dataset_id>', methods=['GET'])
@jwt_required()
def compare_dataset_versions(project_id, dataset_id, other_dataset_id):
    """Compare two versions of a dataset"""
    try:
        current_user_id = get_jwt_identity()
        current_user_id_int = int(current_user_id)
        
        # Verify project access
        project = Project.query.get(project_id)
        if not project:
            return jsonify({
                "success": False,
                "error": "not_found",
                "message": "Proyecto no encontrado"
            }), 404
        
        if project.owner_id != current_user_id_int:
            return jsonify({
                "success": False,
                "error": "unauthorized",
                "message": "No tienes acceso a este proyecto"
            }), 403
        
        # Get both datasets
        dataset_a = Dataset.query.get(dataset_id)
        dataset_b = Dataset.query.get(other_dataset_id)
        
        if not dataset_a or not dataset_b:
            return jsonify({
                "success": False,
                "error": "not_found",
                "message": "Uno o ambos datasets no encontrados"
            }), 404
        
        # Verify they belong to the same project
        if dataset_a.project_id != project_id or dataset_b.project_id != project_id:
            return jsonify({
                "success": False,
                "error": "bad_request",
                "message": "Los datasets deben pertenecer al mismo proyecto"
            }), 400
        
        # Verify they are from the same version chain
        root_a = dataset_a.get_root_dataset()
        root_b = dataset_b.get_root_dataset()
        
        if root_a.id != root_b.id:
            return jsonify({
                "success": False,
                "error": "bad_request",
                "message": "Solo se pueden comparar versiones del mismo dataset"
            }), 400
        
        # Import AnalysisRun and DataQualityIssue here to avoid circular imports
        from models.analysis import AnalysisRun, DataQualityIssue
        
        # Get latest completed analysis for each dataset
        analysis_a = AnalysisRun.query.filter_by(
            dataset_id=dataset_id
        ).filter(
            AnalysisRun.status.in_(['COMPLETED'])
        ).order_by(AnalysisRun.completed_at.desc()).first()
        
        analysis_b = AnalysisRun.query.filter_by(
            dataset_id=other_dataset_id
        ).filter(
            AnalysisRun.status.in_(['COMPLETED'])
        ).order_by(AnalysisRun.completed_at.desc()).first()
        
        # Get issues for both analyses
        issues_a_list = []
        issues_b_list = []
        
        if analysis_a:
            issues_a_list = DataQualityIssue.query.filter_by(analysis_run_id=analysis_a.id).all()
        if analysis_b:
            issues_b_list = DataQualityIssue.query.filter_by(analysis_run_id=analysis_b.id).all()
        
        # Compare issues by description to find new/resolved
        issues_a_descriptions = {i.description for i in issues_a_list}
        issues_b_descriptions = {i.description for i in issues_b_list}
        
        resolved_issues = [i.to_dict() for i in issues_a_list if i.description not in issues_b_descriptions]
        new_issues = [i.to_dict() for i in issues_b_list if i.description not in issues_a_descriptions]
        common_issues = [i.to_dict() for i in issues_b_list if i.description in issues_a_descriptions]
        
        # Build comparison response with frontend-expected structure
        dataset_a_dict = dataset_a.to_dict()
        dataset_b_dict = dataset_b.to_dict()
        
        # Helper to convert enum to string
        def get_gate_status_str(status):
            if status is None:
                return None
            if hasattr(status, 'value'):
                return status.value
            if hasattr(status, 'name'):
                return status.name
            return str(status)
        
        # Add latestAnalysis to each dataset
        if analysis_a:
            dataset_a_dict['latestAnalysis'] = {
                'quality_score': analysis_a.quality_score,
                'quality_gate_status': get_gate_status_str(analysis_a.quality_gate_status),
                'total_issues_count': analysis_a.total_issues_count or 0,
                'completed_at': analysis_a.completed_at.isoformat() if analysis_a.completed_at else None
            }
        
        if analysis_b:
            dataset_b_dict['latestAnalysis'] = {
                'quality_score': analysis_b.quality_score,
                'quality_gate_status': get_gate_status_str(analysis_b.quality_gate_status),
                'total_issues_count': analysis_b.total_issues_count or 0,
                'completed_at': analysis_b.completed_at.isoformat() if analysis_b.completed_at else None
            }
        
        # Calculate differences
        score_a = analysis_a.quality_score if analysis_a else None
        score_b = analysis_b.quality_score if analysis_b else None
        issues_a_count = analysis_a.total_issues_count or 0 if analysis_a else 0
        issues_b_count = analysis_b.total_issues_count or 0 if analysis_b else 0
        
        quality_score_diff = None
        if score_a is not None and score_b is not None:
            quality_score_diff = round(score_b - score_a, 2)
        
        # Column-level diff using schema JSON
        schema_a = dataset_a.schema or []
        schema_b = dataset_b.schema or []
        cols_a = {col["name"] for col in schema_a if isinstance(col, dict) and "name" in col}
        cols_b = {col["name"] for col in schema_b if isinstance(col, dict) and "name" in col}
        added_columns = sorted(list(cols_b - cols_a))
        removed_columns = sorted(list(cols_a - cols_b))

        comparison = {
            "dataset_a": dataset_a_dict,
            "dataset_b": dataset_b_dict,
            "comparison": {
                "rows_diff": (dataset_b.row_count or 0) - (dataset_a.row_count or 0),
                "columns_diff": (dataset_b.column_count or 0) - (dataset_a.column_count or 0),
                "quality_score_diff": quality_score_diff,
                "issues_diff": issues_b_count - issues_a_count,
                "new_issues": new_issues,
                "resolved_issues": resolved_issues,
                "common_issues": common_issues,
                "added_columns": added_columns,
                "removed_columns": removed_columns,
            }
        }

        return jsonify({
            "success": True,
            "data": comparison
        }), 200

    except Exception as e:
        logger.error(f"Error al comparar datasets {dataset_id} y {other_dataset_id}: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": f"Error al comparar versiones: {str(e)}"
        }), 500


@project_datasets_bp.route("/<int:dataset_id>/version-tag", methods=["PATCH"])
@jwt_required()
def patch_version_tag(project_id, dataset_id):
    """Update version_tag and/or description of a dataset version"""
    try:
        current_user_id = int(get_jwt_identity())
        project = Project.query.get(project_id)
        if not project or project.owner_id != current_user_id:
            return jsonify({"success": False, "error": "unauthorized", "message": "No tienes acceso a este proyecto"}), 403
        dataset = Dataset.query.get(dataset_id)
        if not dataset or dataset.project_id != project_id:
            return jsonify({"success": False, "error": "not_found", "message": "Dataset no encontrado"}), 404
        data = request.get_json() or {}
        if "version_tag" in data:
            dataset.version_tag = data["version_tag"] or None
        if "description" in data:
            dataset.description = data["description"]
        db.session.commit()
        return jsonify({"success": True, "data": dataset.to_dict(), "message": "Version actualizada"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al actualizar version_tag del dataset {dataset_id}: {str(e)}")
        return jsonify({"success": False, "error": "server_error", "message": str(e)}), 500

