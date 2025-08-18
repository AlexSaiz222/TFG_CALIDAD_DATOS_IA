from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import logging

from models.user import User
from extensions import db

# Configurar logger
logger = logging.getLogger(__name__)

def register_update_profile_route(auth_bp):
    @auth_bp.route('/me', methods=['PUT'])
    @jwt_required()
    def update_user_profile():
        """Update current user profile"""
        try:
            # Obtener y registrar encabezados para depuración
            auth_header = request.headers.get('Authorization', None)
            if not auth_header:
                logger.warning("Intento de actualización de perfil sin token de autorización")
                return jsonify({
                    "success": False,
                    "error": "missing_authorization",
                    "message": "No se proporcionó token de autorización"
                }), 401
            
            logger.debug(f"Encabezado Authorization recibido en PUT /auth/me: {auth_header[:20]}...")
            
            # Obtener datos de la solicitud
            try:
                data = request.get_json()
                if not data:
                    logger.warning("Intento de actualización de perfil con datos JSON inválidos")
                    return jsonify({
                        "success": False,
                        "error": "invalid_json",
                        "message": "Formato JSON inválido en la solicitud"
                    }), 400
            except Exception as e:
                logger.error(f"Error al parsear JSON en actualización de perfil: {str(e)}")
                return jsonify({
                    "success": False,
                    "error": "invalid_json",
                    "message": "Formato JSON inválido en la solicitud"
                }), 400
            
            # Obtener ID de usuario del token JWT
            try:
                current_user_id = get_jwt_identity()
                if not current_user_id:
                    logger.error("Token JWT sin identidad de usuario")
                    return jsonify({
                        "success": False,
                        "error": "invalid_token",
                        "message": "Token de autorización inválido o expirado"
                    }), 401
                    
                logger.debug(f"Actualizando perfil para usuario ID (string): {current_user_id}")
                
                # Convertir a int para consulta en BD
                try:
                    current_user_id_int = int(current_user_id)
                except (TypeError, ValueError):
                    logger.error(f"ID de usuario inválido en token: {current_user_id}")
                    return jsonify({
                        "success": False,
                        "error": "invalid_token_identity",
                        "message": "ID de usuario inválido en el token"
                    }), 401
                
                # Buscar usuario en la base de datos
                try:
                    user = User.query.get(current_user_id_int)
                    
                    if not user:
                        logger.error(f"Usuario no encontrado para ID: {current_user_id}")
                        return jsonify({
                            "success": False,
                            "error": "user_not_found",
                            "message": "Usuario no encontrado"
                        }), 404
                    
                    # Actualizar campos permitidos
                    allowed_fields = ['first_name', 'last_name', 'email', 'organization']
                    updated = False
                    
                    for field in allowed_fields:
                        if field in data:
                            # Validación especial para email
                            if field == 'email' and data[field] != user.email:
                                # Verificar que el email no esté en uso
                                existing_user = User.query.filter_by(email=data[field]).first()
                                if existing_user and existing_user.id != user.id:
                                    return jsonify({
                                        "success": False,
                                        "error": "email_exists",
                                        "message": "El email ya está en uso por otro usuario"
                                    }), 409
                                
                                # Validar formato de email
                                if '@' not in data[field]:
                                    return jsonify({
                                        "success": False,
                                        "error": "invalid_email_format",
                                        "message": "El formato del email es inválido"
                                    }), 400
                            
                            # Actualizar el campo
                            setattr(user, field, data[field])
                            updated = True
                    
                    if not updated:
                        logger.warning(f"Intento de actualización sin campos válidos para usuario ID: {current_user_id}")
                        return jsonify({
                            "success": False,
                            "error": "no_valid_fields",
                            "message": "No se proporcionaron campos válidos para actualizar"
                        }), 400
                    
                    # Guardar cambios en la base de datos
                    if hasattr(user, 'updated_at'):
                        user.updated_at = datetime.utcnow()
                    db.session.commit()
                    
                    # Intentar serializar la respuesta completa
                    try:
                        user_data = user.to_dict(include_sensitive=False)
                        
                        # Log de éxito
                        logger.info(f"Perfil de usuario actualizado con éxito para ID: {current_user_id_int}, username: {user.username}")
                        
                        return jsonify({
                            "success": True,
                            "data": {
                                "user": user_data
                            },
                            "message": "Perfil actualizado correctamente"
                        }), 200
                    except Exception as e:
                        # Si falla la serialización, devolver datos básicos
                        logger.error(f"Error al serializar datos de usuario en actualización de perfil: {str(e)}")
                        return jsonify({
                            "success": True,
                            "data": {
                                "user": {
                                    "id": user.id,
                                    "username": user.username,
                                    "email": user.email,
                                    "first_name": user.first_name,
                                    "last_name": user.last_name,
                                    "organization": user.organization,
                                    "role": user.role
                                }
                            },
                            "message": "Perfil actualizado correctamente"
                        }), 200
                except Exception as e:
                    db.session.rollback()
                    logger.error(f"Error al actualizar usuario en la base de datos: {str(e)}")
                    return jsonify({
                        "success": False,
                        "error": "database_error",
                        "message": f"Error al actualizar el usuario: {str(e)}"
                    }), 500
            except Exception as e:
                logger.error(f"Error al procesar token JWT en actualización de perfil: {str(e)}")
                return jsonify({
                    "success": False,
                    "error": "token_processing_error",
                    "message": f"Error al procesar token de autorización: {str(e)}"
                }), 401
        except Exception as e:
            logger.error(f"Error inesperado al actualizar perfil de usuario: {str(e)}")
            return jsonify({
                "success": False,
                "error": "server_error",
                "message": f"Error del servidor: {str(e)}"
            }), 500
