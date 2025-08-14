from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash

from models.user import User
from extensions import db

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.get_json()
    
    # Check if required fields are present
    required_fields = ['username', 'email', 'password']
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    
    # Check if user already exists
    if User.query.filter_by(username=data['username']).first():
        return jsonify({"error": "Username already exists"}), 409
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"error": "Email already exists"}), 409
    
    # Create new user
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
    
    return jsonify({
        "message": "User registered successfully",
        "token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
            "first_name": new_user.first_name,
            "last_name": new_user.last_name,
            "organization": new_user.organization,
            "role": new_user.role
        }
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate a user and return JWT tokens"""
    try:
        # Importar app para logging
        from flask import current_app as app
        
        data = request.get_json()
        app.logger.debug(f"Intento de login para usuario: {data.get('username')}")
        
        # Check if required fields are present
        if not data.get('username') or not data.get('password'):
            app.logger.warning("Intento de login sin username o password")
            return jsonify({"error": "Missing username or password", "success": False}), 400
        
        # Find user by username
        user = User.query.filter_by(username=data['username']).first()
        
        # Check if user exists and password is correct
        if not user:
            app.logger.warning(f"Usuario no encontrado: {data.get('username')}")
            return jsonify({"error": "Invalid username or password", "success": False}), 401
            
        if not check_password_hash(user.password_hash, data['password']):
            app.logger.warning(f"Contraseña incorrecta para usuario: {data.get('username')}")
            return jsonify({"error": "Invalid username or password", "success": False}), 401
        
        # Create access and refresh tokens
        # Usar identidad como string para cumplir con el estándar JWT (sub debe ser string)
        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))
        
        # Log de éxito
        app.logger.info(f"Login exitoso para usuario: {user.username}, ID: {user.id}")
        app.logger.debug(f"Token generado para usuario {user.username}: {access_token[:20]}...")
        
        return jsonify({
            "success": True,
            "message": "Login successful",
            "token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "organization": user.organization,
                "role": user.role
            }
        }), 200
    except Exception as e:
        from flask import current_app as app
        app.logger.error(f"Error en login: {str(e)}")
        return jsonify({"error": "Error during login", "success": False, "message": str(e)}), 500

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token using refresh token"""
    # get_jwt_identity devolverá string; mantener string al recrear token
    current_user_id = get_jwt_identity()
    access_token = create_access_token(identity=str(current_user_id))
    
    return jsonify({"access_token": access_token}), 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_user_profile():
    """Get current user profile"""
    try:
        # Importar app para logging
        from flask import current_app as app
        
        # Obtener y registrar encabezados para depuración
        auth_header = request.headers.get('Authorization', None)
        app.logger.debug(f"Encabezado Authorization recibido en /auth/me: {auth_header}")
        
        # Obtener ID de usuario del token JWT
        current_user_id = get_jwt_identity()
        app.logger.debug(f"Obteniendo perfil para usuario ID (string): {current_user_id}")
        # Convertir a int para consulta en BD
        try:
            current_user_id_int = int(current_user_id)
        except (TypeError, ValueError):
            app.logger.error(f"ID de usuario inválido en token: {current_user_id}")
            return jsonify({"error": "Invalid token identity", "success": False}), 401
        
        # Buscar usuario en la base de datos
        user = User.query.get(current_user_id_int)
        
        if not user:
            app.logger.error(f"Usuario no encontrado para ID: {current_user_id}")
            return jsonify({"error": "User not found", "success": False}), 404
        
        # Log de éxito
        app.logger.info(f"Perfil de usuario obtenido con éxito para ID: {current_user_id_int}, username: {user.username}")
        
        # Devolver información del usuario
        return jsonify({
            "success": True,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "organization": user.organization,
                "role": user.role
            }
        }), 200
    except Exception as e:
        from flask import current_app as app
        app.logger.error(f"Error al obtener perfil de usuario: {str(e)}")
        return jsonify({"error": "Error retrieving user profile", "success": False, "message": str(e)}), 500
