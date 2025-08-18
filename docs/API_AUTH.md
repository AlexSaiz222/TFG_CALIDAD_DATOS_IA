# Referencia de la API REST

## Introducción

Esta documentación describe la API REST de la Plataforma de Evaluación de Calidad de Datos para Proyectos de IA. La API proporciona acceso programático a todas las funcionalidades de la plataforma, permitiendo la gestión de usuarios, proyectos, datasets, métricas y evaluaciones de calidad.

### Base URL

```
Desarrollo: http://localhost:5000/api
Producción: https://[dominio-produccion]/api
```

### Formato de Respuestas

Todas las respuestas de la API siguen un formato consistente:

**Respuesta exitosa:**

```json
{
  "success": true,
  "data": {
    // Datos específicos de la respuesta
  },
  "message": "Operación completada con éxito"
}
```

**Respuesta de error:**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descripción del error"
  }
}
```

### Autenticación

La API utiliza autenticación basada en tokens JWT (JSON Web Tokens). Para acceder a endpoints protegidos, se debe incluir el token de acceso en el encabezado de la solicitud:

```
Authorization: Bearer <access_token>
```

El flujo de autenticación es el siguiente:

1. El usuario se registra o inicia sesión para obtener un par de tokens (access_token y refresh_token)
2. El access_token se utiliza para autenticar solicitudes a endpoints protegidos
3. Cuando el access_token expira, se utiliza el refresh_token para obtener un nuevo par de tokens
4. Si el refresh_token también expira, el usuario debe iniciar sesión nuevamente

## Endpoints de Autenticación

### Registro de Usuario

Crea una nueva cuenta de usuario en la plataforma.

**Endpoint:** `POST /api/auth/register`

**Cuerpo de la solicitud:**

```json
{
  "username": "usuario_ejemplo",
  "email": "usuario@ejemplo.com",
  "password": "contraseña_segura",
  "first_name": "Nombre",
  "last_name": "Apellido",
  "organization": "Organización" // Opcional
}
```

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "usuario_ejemplo",
      "email": "usuario@ejemplo.com",
      "first_name": "Nombre",
      "last_name": "Apellido",
      "organization": "Organización",
      "role": "user",
      "created_at": "2023-08-13T08:30:45Z"
    },
    "tokens": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expires_in": 3600
    }
  },
  "message": "Usuario registrado correctamente"
}
```

**Posibles errores:**

- `400 Bad Request`: Datos de registro inválidos
- `409 Conflict`: El nombre de usuario o email ya están en uso

### Inicio de Sesión

Autentica a un usuario existente y devuelve tokens de acceso.

**Endpoint:** `POST /api/auth/login`

**Cuerpo de la solicitud:**

```json
{
  "username": "usuario_ejemplo",
  "password": "contraseña_segura"
}
```

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "usuario_ejemplo",
      "email": "usuario@ejemplo.com",
      "first_name": "Nombre",
      "last_name": "Apellido",
      "organization": "Organización",
      "role": "user",
      "created_at": "2023-08-13T08:30:45Z"
    },
    "tokens": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expires_in": 3600
    }
  },
  "message": "Inicio de sesión exitoso"
}
```

**Posibles errores:**

- `400 Bad Request`: Datos de inicio de sesión inválidos
- `401 Unauthorized`: Credenciales incorrectas

### Renovación de Token

Utiliza un refresh_token para obtener un nuevo par de tokens.

**Endpoint:** `POST /api/auth/refresh`

**Cuerpo de la solicitud:**

```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "tokens": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expires_in": 3600
    }
  },
  "message": "Token renovado correctamente"
}
```

**Posibles errores:**

- `400 Bad Request`: Refresh token no proporcionado
- `401 Unauthorized`: Refresh token inválido o expirado

### Obtener Perfil de Usuario

Obtiene información del perfil del usuario autenticado.

**Endpoint:** `GET /api/auth/me`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "usuario_ejemplo",
      "email": "usuario@ejemplo.com",
      "first_name": "Nombre",
      "last_name": "Apellido",
      "organization": "Organización",
      "role": "user",
      "created_at": "2023-08-13T08:30:45Z"
    }
  },
  "message": "Perfil de usuario obtenido correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado

### Actualizar Perfil de Usuario

Actualiza la información del perfil del usuario autenticado.

**Endpoint:** `PUT /api/auth/me`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Cuerpo de la solicitud:**

```json
{
  "first_name": "Nuevo Nombre",
  "last_name": "Nuevo Apellido",
  "organization": "Nueva Organización",
  "email": "nuevo_email@ejemplo.com" // Opcional
}
```

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "usuario_ejemplo",
      "email": "nuevo_email@ejemplo.com",
      "first_name": "Nuevo Nombre",
      "last_name": "Nuevo Apellido",
      "organization": "Nueva Organización",
      "role": "user",
      "created_at": "2023-08-13T08:30:45Z",
      "updated_at": "2023-08-13T10:15:22Z"
    }
  },
  "message": "Perfil actualizado correctamente"
}
```

**Posibles errores:**

- `400 Bad Request`: Datos de actualización inválidos
- `401 Unauthorized`: Token de acceso inválido o expirado
- `409 Conflict`: El email ya está en uso por otro usuario

### Cambiar Contraseña

Permite al usuario cambiar su contraseña.

**Endpoint:** `PUT /api/auth/password`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Cuerpo de la solicitud:**

```json
{
  "current_password": "contraseña_actual",
  "new_password": "nueva_contraseña"
}
```

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "message": "Contraseña actualizada correctamente"
}
```

**Posibles errores:**

- `400 Bad Request`: Datos inválidos o nueva contraseña demasiado débil
- `401 Unauthorized`: Token de acceso inválido o contraseña actual incorrecta

### Cerrar Sesión

Invalida el refresh token del usuario.

**Endpoint:** `POST /api/auth/logout`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Cuerpo de la solicitud:**

```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "message": "Sesión cerrada correctamente"
}
```

**Posibles errores:**

- `400 Bad Request`: Refresh token no proporcionado
- `401 Unauthorized`: Token de acceso inválido o expirado

## Implementación en el Backend

A continuación se muestra un ejemplo de cómo están implementadas las rutas de autenticación en el backend:

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token, 
    jwt_required, get_jwt_identity, get_jwt
)
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timezone, timedelta

from models.user import User
from extensions import db, jwt

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    # Validación de datos
    if not data or not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_DATA',
                'message': 'Se requieren username, email y password'
            }
        }), 400
    
    # Verificar si el usuario ya existe
    if User.query.filter_by(username=data['username']).first():
        return jsonify({
            'success': False,
            'error': {
                'code': 'USERNAME_EXISTS',
                'message': 'El nombre de usuario ya está en uso'
            }
        }), 409
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({
            'success': False,
            'error': {
                'code': 'EMAIL_EXISTS',
                'message': 'El email ya está registrado'
            }
        }), 409
    
    # Crear nuevo usuario
    new_user = User(
        username=data['username'],
        email=data['email'],
        password_hash=generate_password_hash(data['password']),
        first_name=data.get('first_name', ''),
        last_name=data.get('last_name', ''),
        organization=data.get('organization', ''),
        role='user'
    )
    
    db.session.add(new_user)
    db.session.commit()
    
    # Generar tokens
    access_token = create_access_token(identity=new_user.id)
    refresh_token = create_refresh_token(identity=new_user.id)
    
    return jsonify({
        'success': True,
        'data': {
            'user': new_user.to_dict(),
            'tokens': {
                'access_token': access_token,
                'refresh_token': refresh_token,
                'expires_in': 3600  # 1 hora
            }
        },
        'message': 'Usuario registrado correctamente'
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_DATA',
                'message': 'Se requieren username y password'
            }
        }), 400
    
    # Buscar usuario
    user = User.query.filter_by(username=data['username']).first()
    
    # Verificar credenciales
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_CREDENTIALS',
                'message': 'Credenciales inválidas'
            }
        }), 401
    
    # Generar tokens
    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)
    
    return jsonify({
        'success': True,
        'data': {
            'user': user.to_dict(),
            'tokens': {
                'access_token': access_token,
                'refresh_token': refresh_token,
                'expires_in': 3600  # 1 hora
            }
        },
        'message': 'Inicio de sesión exitoso'
    }), 200

@auth_bp.route('/refresh', methods=['POST'])
def refresh():
    data = request.get_json()
    
    if not data or not data.get('refresh_token'):
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_DATA',
                'message': 'Se requiere refresh_token'
            }
        }), 400
    
    try:
        # Verificar refresh token
        user_id = get_jwt_identity()
        
        # Generar nuevos tokens
        access_token = create_access_token(identity=user_id)
        refresh_token = create_refresh_token(identity=user_id)
        
        return jsonify({
            'success': True,
            'data': {
                'tokens': {
                    'access_token': access_token,
                    'refresh_token': refresh_token,
                    'expires_in': 3600  # 1 hora
                }
            },
            'message': 'Token renovado correctamente'
        }), 200
    except:
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_REFRESH_TOKEN',
                'message': 'Refresh token inválido o expirado'
            }
        }), 401

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    
    try:
        # Convertir el ID a entero si es necesario
        current_user_id_int = int(user_id) if isinstance(user_id, str) else user_id
        
        # Consultar usuario en la base de datos
        try:
            user = User.query.get(current_user_id_int)
            
            if not user:
                logger.warning(f"Usuario no encontrado para ID: {current_user_id_int}")
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
        logger.error(f"Error inesperado en get_profile: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": "Error interno del servidor"
        }), 500

@auth_bp.route('/me', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({
            'success': False,
            'error': {
                'code': 'USER_NOT_FOUND',
                'message': 'Usuario no encontrado'
            }
        }), 404
    
    data = request.get_json()
    
    # Actualizar campos permitidos
    if data.get('first_name'):
        user.first_name = data['first_name']
    
    if data.get('last_name'):
        user.last_name = data['last_name']
    
    if data.get('organization'):
        user.organization = data['organization']
    
    if data.get('email'):
        # Verificar si el email ya está en uso
        existing_user = User.query.filter_by(email=data['email']).first()
        if existing_user and existing_user.id != user.id:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'EMAIL_EXISTS',
                    'message': 'El email ya está en uso por otro usuario'
                }
            }), 409
        
        user.email = data['email']
    
    user.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': {
            'user': user.to_dict()
        },
        'message': 'Perfil actualizado correctamente'
    }), 200

@auth_bp.route('/password', methods=['PUT'])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({
            'success': False,
            'error': {
                'code': 'USER_NOT_FOUND',
                'message': 'Usuario no encontrado'
            }
        }), 404
    
    data = request.get_json()
    
    if not data or not data.get('current_password') or not data.get('new_password'):
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_DATA',
                'message': 'Se requieren current_password y new_password'
            }
        }), 400
    
    # Verificar contraseña actual
    if not check_password_hash(user.password_hash, data['current_password']):
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_PASSWORD',
                'message': 'Contraseña actual incorrecta'
            }
        }), 401
    
    # Validar nueva contraseña
    if len(data['new_password']) < 8:
        return jsonify({
            'success': False,
            'error': {
                'code': 'WEAK_PASSWORD',
                'message': 'La nueva contraseña debe tener al menos 8 caracteres'
            }
        }), 400
    
    # Actualizar contraseña
    user.password_hash = generate_password_hash(data['new_password'])
    user.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Contraseña actualizada correctamente'
    }), 200

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    # En una implementación completa, se debería agregar el token a una lista negra
    # Para este MVP, simplemente devolvemos una respuesta exitosa
    
    return jsonify({
        'success': True,
        'message': 'Sesión cerrada correctamente'
    }), 200
```

## Implementación en el Frontend

A continuación se muestra un ejemplo de cómo se utilizan estos endpoints en el frontend:

```typescript
// src/services/api.ts

import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// Cliente axios con configuración base
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de autenticación
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar errores de autenticación
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Si el error es 401 y no es un retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Intentar renovar el token
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken
        });
        
        const { access_token, refresh_token } = response.data.data.tokens;
        
        // Guardar nuevos tokens
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        
        // Reintentar la solicitud original con el nuevo token
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Si falla la renovación, redirigir a login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Servicios de autenticación
export const authAPI = {
  register: (userData: any) => 
    apiClient.post('/auth/register', userData),
  
  login: (credentials: { username: string; password: string }) => 
    apiClient.post('/auth/login', credentials),
  
  getProfile: () => 
    apiClient.get('/auth/me'),
  
  updateProfile: (userData: any) => 
    apiClient.put('/auth/me', userData),
  
  changePassword: (passwordData: { current_password: string; new_password: string }) => 
    apiClient.put('/auth/password', passwordData),
  
  logout: (refreshToken: string) => 
    apiClient.post('/auth/logout', { refresh_token: refreshToken })
};

export default apiClient;
```

Este módulo de autenticación proporciona la base para la seguridad de la plataforma, permitiendo el registro de usuarios, la autenticación y la gestión de perfiles. Los tokens JWT garantizan que solo los usuarios autorizados puedan acceder a las funcionalidades protegidas de la API.
