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
    access_token = create_access_token(identity=new_user.id)
    refresh_token = create_refresh_token(identity=new_user.id)
    
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
    data = request.get_json()
    
    # Check if required fields are present
    if not data.get('username') or not data.get('password'):
        return jsonify({"error": "Missing username or password"}), 400
    
    # Find user by username
    user = User.query.filter_by(username=data['username']).first()
    
    # Check if user exists and password is correct
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({"error": "Invalid username or password"}), 401
    
    # Create access and refresh tokens
    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)
    
    return jsonify({
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

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token using refresh token"""
    current_user_id = get_jwt_identity()
    access_token = create_access_token(identity=current_user_id)
    
    return jsonify({"access_token": access_token}), 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_user_profile():
    """Get current user profile"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    return jsonify({
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
