from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
import logging

from models.user import User
from extensions import db

# Configurar logger
logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        try:
            data = request.get_json()
            if not data:
                logger.warning("Intento de registro con datos JSON inválidos")
                return jsonify({
                    "success": False,
                    "error": "invalid_json",
                    "message": "Formato JSON inválido en la solicitud"
                }), 400
        except Exception as e:
            logger.error(f"Error al parsear JSON en registro: {str(e)}")
            return jsonify({
                "success": False,
                "error": "invalid_json",
                "message": "Formato JSON inválido en la solicitud"
            }), 400
        
        # Check if required fields are present
        required_fields = ['username', 'email', 'password']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            logger.warning(f"Intento de registro con campos faltantes: {missing_fields}")
            return jsonify({
                "success": False,
                "error": "missing_required_fields",
                "message": f"Faltan campos obligatorios: {', '.join(missing_fields)}"
            }), 400
        
        # Validar formato de email (básico)
        if '@' not in data['email']:
            logger.warning(f"Intento de registro con email inválido: {data['email']}")
            return jsonify({
                "success": False,
                "error": "invalid_email_format",
                "message": "El formato del email es inválido"
            }), 400
        
        # Validar longitud de contraseña
        if len(data['password']) < 6:
            logger.warning("Intento de registro con contraseña demasiado corta")
            return jsonify({
                "success": False,
                "error": "password_too_short",
                "message": "La contraseña debe tener al menos 6 caracteres"
            }), 400
        
        # Check if user already exists
        if User.query.filter_by(username=data['username']).first():
            logger.warning(f"Intento de registro con nombre de usuario existente: {data['username']}")
            return jsonify({
                "success": False,
                "error": "username_exists",
                "message": "El nombre de usuario ya existe"
            }), 409
        
        if User.query.filter_by(email=data['email']).first():
            logger.warning(f"Intento de registro con email existente: {data['email']}")
            return jsonify({
                "success": False,
                "error": "email_exists",
                "message": "El email ya está registrado"
            }), 409
        
        # Create new user
        try:
            new_user = User(
                username=data['username'],
                email=data['email'],
                password_hash=generate_password_hash(data['password']),
                first_name=data.get('first_name', ''),
                last_name=data.get('last_name', ''),
                organization=data.get('organization', ''),
                role=data.get('role', 'user')
            )
            
            # Save user to database
            db.session.add(new_user)
            db.session.commit()
            
            # Create access and refresh tokens
            # Usar identidad como string para cumplir con el estándar JWT (sub debe ser string)
            access_token = create_access_token(identity=str(new_user.id))
            refresh_token = create_refresh_token(identity=str(new_user.id))
            
            logger.info(f"Usuario registrado exitosamente: {new_user.username}, ID: {new_user.id}")
            
            # Intentar serializar la respuesta completa
            try:
                user_data = new_user.to_dict(include_sensitive=False)
                return jsonify({
                    "success": True,
                    "message": "Usuario registrado correctamente",
                    "token": access_token,
                    "refresh_token": refresh_token,
                    "user": user_data
                }), 201
            except Exception as e:
                # Si falla la serialización, devolver datos básicos
                logger.error(f"Error al serializar datos de usuario: {str(e)}")
                return jsonify({
                    "success": True,
                    "message": "Usuario registrado correctamente",
                    "token": access_token,
                    "refresh_token": refresh_token,
                    "user": {
                        "id": new_user.id,
                        "username": new_user.username,
                        "email": new_user.email
                    }
                }), 201
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error al crear usuario en la base de datos: {str(e)}")
            return jsonify({
                "success": False,
                "error": "database_error",
                "message": f"Error al crear el usuario: {str(e)}"
            }), 500
    except Exception as e:
        logger.error(f"Error inesperado en registro de usuario: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": f"Error del servidor: {str(e)}"
        }), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate a user and return JWT tokens"""
    try:
        try:
            data = request.get_json()
            if not data:
                logger.warning("Intento de login con datos JSON inválidos")
                return jsonify({
                    "success": False,
                    "error": "invalid_json",
                    "message": "Formato JSON inválido en la solicitud"
                }), 400
        except Exception as e:
            logger.error(f"Error al parsear JSON en login: {str(e)}")
            return jsonify({
                "success": False,
                "error": "invalid_json",
                "message": "Formato JSON inválido en la solicitud"
            }), 400
        
        logger.debug(f"Intento de login para usuario: {data.get('username')}")
        
        # Check if required fields are present
        required_fields = ['username', 'password']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            logger.warning(f"Intento de login con campos faltantes: {missing_fields}")
            return jsonify({
                "success": False,
                "error": "missing_required_fields",
                "message": f"Faltan campos obligatorios: {', '.join(missing_fields)}"
            }), 400
        
        try:
            # Find user by username
            user = User.query.filter_by(username=data['username']).first()
            
            # Check if user exists and password is correct
            if not user:
                logger.warning(f"Usuario no encontrado en login: {data.get('username')}")
                return jsonify({
                    "success": False,
                    "error": "invalid_credentials",
                    "message": "Nombre de usuario o contraseña incorrectos"
                }), 401
                
            if not check_password_hash(user.password_hash, data['password']):
                logger.warning(f"Contraseña incorrecta para usuario: {data.get('username')}")
                return jsonify({
                    "success": False,
                    "error": "invalid_credentials",
                    "message": "Nombre de usuario o contraseña incorrectos"
                }), 401
            
            # Create access and refresh tokens
            try:
                # Usar identidad como string para cumplir con el estándar JWT (sub debe ser string)
                access_token = create_access_token(identity=str(user.id))
                refresh_token = create_refresh_token(identity=str(user.id))
                
                # Log de éxito
                logger.info(f"Login exitoso para usuario: {user.username}, ID: {user.id}")
                logger.debug(f"Token generado para usuario {user.username}: {access_token[:20]}...")
                
                # Intentar serializar la respuesta completa
                try:
                    user_data = user.to_dict(include_sensitive=False)
                    return jsonify({
                        "success": True,
                        "message": "Inicio de sesión exitoso",
                        "token": access_token,
                        "refresh_token": refresh_token,
                        "user": user_data
                    }), 200
                except Exception as e:
                    # Si falla la serialización, devolver datos básicos
                    logger.error(f"Error al serializar datos de usuario en login: {str(e)}")
                    return jsonify({
                        "success": True,
                        "message": "Inicio de sesión exitoso",
                        "token": access_token,
                        "refresh_token": refresh_token,
                        "user": {
                            "id": user.id,
                            "username": user.username,
                            "email": user.email
                        }
                    }), 200
            except Exception as e:
                logger.error(f"Error al generar tokens JWT: {str(e)}")
                return jsonify({
                    "success": False,
                    "error": "token_generation_error",
                    "message": "Error al generar tokens de autenticación"
                }), 500
        except Exception as e:
            logger.error(f"Error en proceso de autenticación: {str(e)}")
            return jsonify({
                "success": False,
                "error": "authentication_error",
                "message": f"Error en el proceso de autenticación: {str(e)}"
            }), 500
    except Exception as e:
        logger.error(f"Error inesperado en login: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": f"Error del servidor: {str(e)}"
        }), 500

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token using refresh token"""
    try:
        # get_jwt_identity devolverá string; mantener string al recrear token
        current_user_id = get_jwt_identity()
        
        # Verificar que el ID de usuario es válido
        try:
            # Intentar convertir a entero para validar, pero no usamos el resultado
            int(current_user_id)
        except (ValueError, TypeError):
            logger.error(f"ID de usuario inválido en token de refresco: {current_user_id}")
            return jsonify({
                "success": False,
                "error": "invalid_token_identity",
                "message": "Token de refresco inválido"
            }), 401
        
        # Verificar que el usuario existe
        user_exists = User.query.get(int(current_user_id))
        if not user_exists:
            logger.warning(f"Intento de refresco de token para usuario inexistente ID: {current_user_id}")
            return jsonify({
                "success": False,
                "error": "user_not_found",
                "message": "Usuario no encontrado"
            }), 401
        
        # Crear nuevo token de acceso
        access_token = create_access_token(identity=str(current_user_id))
        logger.info(f"Token refrescado para usuario ID: {current_user_id}")
        
        return jsonify({
            "success": True,
            "access_token": access_token,
            "message": "Token actualizado correctamente"
        }), 200
    except Exception as e:
        logger.error(f"Error al refrescar token: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": f"Error al refrescar token: {str(e)}"
        }), 500

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_user_profile():
    """Get current user profile"""
    try:
        # Obtener y registrar encabezados para depuración
        auth_header = request.headers.get('Authorization', None)
        if not auth_header:
            logger.warning("Intento de acceso a perfil sin token de autorización")
            return jsonify({
                "success": False,
                "error": "missing_authorization",
                "message": "No se proporcionó token de autorización"
            }), 401
        
        logger.debug(f"Encabezado Authorization recibido en /auth/me: {auth_header[:20]}...")
        
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
                
            logger.debug(f"Obteniendo perfil para usuario ID (string): {current_user_id}")
            
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
                
                # Intentar serializar la respuesta completa
                try:
                    user_data = user.to_dict(include_sensitive=False)
                    
                    # Log de éxito
                    logger.info(f"Perfil de usuario obtenido con éxito para ID: {current_user_id_int}, username: {user.username}")
                    
                    return jsonify({
                        "success": True,
                        "data": {
                            "user": user_data
                        }
                    }), 200
                except Exception as e:
                    # Si falla la serialización, devolver datos básicos
                    logger.error(f"Error al serializar datos de usuario en perfil: {str(e)}")
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
                        }
                    }), 200
            except Exception as e:
                logger.error(f"Error al consultar usuario en la base de datos: {str(e)}")
                return jsonify({
                    "success": False,
                    "error": "database_error",
                    "message": f"Error al obtener datos del usuario: {str(e)}"
                }), 500
        except Exception as e:
            logger.error(f"Error al procesar token JWT: {str(e)}")
            return jsonify({
                "success": False,
                "error": "token_processing_error",
                "message": f"Error al procesar token de autorización: {str(e)}"
            }), 401
    except Exception as e:
        logger.error(f"Error inesperado al obtener perfil de usuario: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": f"Error del servidor: {str(e)}"
        }), 500
