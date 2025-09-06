# Guía de Manejo de Errores en la API

## Introducción

Este documento describe las prácticas y patrones de manejo de errores implementados en la API del sistema de evaluación de calidad de datos. El objetivo es proporcionar una experiencia consistente para los usuarios y facilitar la depuración y mantenimiento del código.

## Estructura de Respuesta Estándar

Todas las respuestas de la API siguen una estructura JSON consistente:

### Respuesta Exitosa

```json
{
  "success": true,
  "data": { ... },  // Datos específicos del endpoint
  "message": "Operación completada correctamente"
}
```

### Respuesta de Error

```json
{
  "success": false,
  "error": "tipo_de_error",  // Código de error específico
  "message": "Descripción del error para el usuario",
  "details": { ... }  // Opcional: detalles adicionales del error
}
```

## Códigos HTTP

Los siguientes códigos HTTP se utilizan de manera consistente en toda la API:

- **200 OK**: Operación completada con éxito
- **201 Created**: Recurso creado correctamente
- **202 Accepted**: Solicitud aceptada para procesamiento asíncrono
- **400 Bad Request**: Error en la solicitud del cliente (datos inválidos, parámetros faltantes)
- **401 Unauthorized**: Autenticación requerida o token inválido
- **403 Forbidden**: El usuario no tiene permisos para acceder al recurso
- **404 Not Found**: Recurso no encontrado
- **500 Internal Server Error**: Error interno del servidor

## Patrones de Manejo de Errores

### 1. Validación de Identidad del Usuario

```python
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
```

### 2. Verificación de Existencia de Recursos

```python
# Verificar que el recurso existe
resource = Resource.query.get(resource_id)
if not resource:
    return jsonify({
        "success": False,
        "error": "resource_not_found",
        "message": f"No se encontró el recurso con ID {resource_id}"
    }), 404
```

### 3. Verificación de Permisos

```python
# Verificar permisos de acceso
if resource.owner_id != current_user_id_int:
    logger.warning(f"Usuario {current_user_id} intentó acceder al recurso {resource_id} sin permisos")
    return jsonify({
        "success": False,
        "error": "unauthorized_access",
        "message": "No tienes permisos para acceder a este recurso"
    }), 403
```

### 4. Manejo de Errores de Serialización

```python
try:
    resource_data = resource.to_dict()
    return jsonify({
        "success": True,
        "data": resource_data,
        "message": "Recurso obtenido correctamente"
    }), 200
except Exception as e:
    logger.error(f"Error al serializar recurso {resource_id}: {str(e)}")
    return jsonify({
        "success": False,
        "error": "serialization_error",
        "message": f"Error al procesar los datos del recurso: {str(e)}"
    }), 500
```

### 5. Manejo de Errores en Operaciones de Base de Datos

```python
try:
    db.session.add(new_resource)
    db.session.commit()
    # Operación exitosa
except Exception as e:
    db.session.rollback()
    logger.error(f"Error al guardar en la base de datos: {str(e)}")
    return jsonify({
        "success": False,
        "error": "database_error",
        "message": f"Error al guardar los datos: {str(e)}"
    }), 500
```

### 6. Validación de Datos de Entrada

```python
try:
    # Validar datos con el esquema
    validated_data = schema.load(data)
except ValidationError as err:
    logger.warning(f"Error de validación: {err.messages}")
    return jsonify({
        "success": False,
        "error": "validation_error",
        "message": "Los datos proporcionados contienen errores",
        "details": err.messages
    }), 400
```

### 7. Manejo de Errores en Procesamiento de Archivos

```python
if 'file' not in request.files:
    return jsonify({
        "success": False,
        "error": "missing_file",
        "message": "No se ha proporcionado ningún archivo"
    }), 400

file = request.files['file']
if file.filename == '':
    return jsonify({
        "success": False,
        "error": "empty_filename",
        "message": "El archivo no tiene nombre"
    }), 400
```

## Logging

Se implementa un sistema de logging consistente con los siguientes niveles:

- **DEBUG**: Información detallada para depuración
- **INFO**: Eventos normales del sistema
- **WARNING**: Situaciones inesperadas pero no críticas
- **ERROR**: Errores que impiden completar una operación
- **CRITICAL**: Errores críticos que afectan al sistema completo

Ejemplo de uso:

```python
logger = logging.getLogger(__name__)

# Ejemplos de uso
logger.debug(f"Detalles de la solicitud: {request.json}")
logger.info(f"Usuario {user_id} ha iniciado sesión")
logger.warning(f"Usuario {user_id} intentó acceder a un recurso sin permisos")
logger.error(f"Error al procesar la solicitud: {str(e)}")
logger.critical(f"Error crítico en la base de datos: {str(e)}")
```

## Middleware para Manejo Centralizado de Errores

El sistema utiliza middleware para manejar errores de manera centralizada y mejorar el rendimiento y la trazabilidad de las solicitudes:

### Error Handlers (error_handlers.py)

Maneja excepciones no capturadas y las convierte en respuestas JSON consistentes. Incluye manejadores para:

- Errores HTTP estándar (400, 401, 403, 404, 405, 429)
- Errores de base de datos (SQLAlchemyError)
- Excepciones no manejadas
- Excepciones HTTP genéricas

Ejemplo de implementación:

```python
@app.errorhandler(404)
def not_found_error(error):
    """Maneja errores 404 - Recurso no encontrado"""
    logger.info(f"Recurso no encontrado: {error}")
    return jsonify({
        "success": False,
        "error": "Recurso no encontrado",
        "message": str(error)
    }), 404

@app.errorhandler(SQLAlchemyError)
def database_error(error):
    """Maneja errores de base de datos"""
    logger.error(f"Error de base de datos: {error}", exc_info=True)
    return jsonify({
        "success": False,
        "error": "Error de base de datos",
        "message": "Ha ocurrido un error al procesar la solicitud en la base de datos"
    }), 500
```

### Monitor de Rendimiento (performance_monitor.py)

Registra tiempos de ejecución y métricas de rendimiento para identificar cuellos de botella. Funcionalidades:

- Medición de tiempo de respuesta para cada solicitud
- Detección de solicitudes lentas (configurable mediante umbral)
- Estadísticas por endpoint y ruta
- Decorador para monitorear funciones específicas

Ejemplo de implementación:

```python
@app.after_request
def log_request_info(response):
    """Registra información de rendimiento después de cada solicitud."""
    if hasattr(g, 'start_time'):
        # Calcular duración
        duration = time.time() - g.start_time
        duration_ms = round(duration * 1000, 2)
        
        # Obtener información de la ruta
        endpoint = request.endpoint
        method = request.method
        status_code = response.status_code
        path = request.path
        
        # Registrar métricas
        _request_metrics[endpoint].append(duration_ms)
        
        # Registrar en log si la duración excede el umbral
        threshold_ms = current_app.config.get('SLOW_REQUEST_THRESHOLD_MS', 500)
        if duration_ms > threshold_ms:
            logger.warning(f"Solicitud lenta detectada: {method} {path} - {duration_ms}ms")
        
        # Añadir header con tiempo de respuesta
        response.headers['X-Response-Time'] = f"{duration_ms}ms"
    
    return response
```

### Middleware de Solicitud (request_middleware.py)

Asigna un ID único a cada solicitud para facilitar el seguimiento y la depuración. Funcionalidades:

- Generación de ID único para cada solicitud (UUID)
- Registro de información contextual (IP, método, ruta, agente de usuario)
- Propagación del ID de solicitud a través de los logs
- Inclusión del ID de solicitud en las cabeceras de respuesta

Ejemplo de implementación:

```python
@app.before_request
def process_request():
    """Procesa la solicitud entrante y asigna un ID único"""
    request_id = str(uuid.uuid4())
    g.request_id = request_id
    
    # Configurar contexto de logging
    logger_adapter = logging.LoggerAdapter(
        logger, {
            'request_id': request_id,
            'user_id': get_jwt_identity() if verify_jwt_in_request(optional=True) else None,
            'ip': request.remote_addr,
            'method': request.method,
            'path': request.path
        }
    )
    g.logger = logger_adapter
    
    g.logger.info(f"Solicitud iniciada: {request.method} {request.path}")

@app.after_request
def add_request_id(response):
    """Añade el ID de solicitud a la respuesta"""
    if hasattr(g, 'request_id'):
        response.headers['X-Request-ID'] = g.request_id
    return response
```

## Integración con el Frontend

El frontend debe estar preparado para manejar las respuestas de error de la API:

1. Verificar siempre el campo `success` para determinar si la operación fue exitosa
2. Mostrar mensajes de error amigables basados en el campo `message`
3. Utilizar el campo `error` para lógica específica de manejo de errores
4. Implementar manejo de errores HTTP para casos como 401, 403, 404 y 500

## Mejores Prácticas

1. **Consistencia**: Mantener la estructura de respuesta consistente en todos los endpoints
2. **Mensajes claros**: Proporcionar mensajes de error descriptivos y orientados al usuario
3. **Logging detallado**: Registrar información suficiente para depuración sin exponer datos sensibles
4. **Validación temprana**: Validar datos de entrada lo antes posible
5. **Manejo de transacciones**: Usar rollback en caso de error durante operaciones de base de datos
6. **Seguridad**: No exponer detalles técnicos o stacktraces en las respuestas al cliente
7. **Internacionalización**: Preparar el sistema para soportar mensajes de error en múltiples idiomas

## Ejemplos de Implementación

### Endpoint de Autenticación

```python
@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_user_profile():
    try:
        # Obtener ID de usuario del token
        current_user_id = get_jwt_identity()
        try:
            user_id = int(current_user_id)
        except (TypeError, ValueError):
            logger.warning(f"ID de usuario inválido en token: {current_user_id}")
            return jsonify({
                "success": False,
                "error": "invalid_token_identity",
                "message": "ID de usuario inválido en el token"
            }), 401
        
        # Buscar usuario en la base de datos
        user = User.query.get(user_id)
        if not user:
            logger.warning(f"Usuario {user_id} no encontrado en la base de datos")
            return jsonify({
                "success": False,
                "error": "user_not_found",
                "message": "Usuario no encontrado"
            }), 404
        
        # Serializar respuesta
        try:
            user_data = user.to_dict()
            return jsonify({
                "success": True,
                "data": {
                    "user": user_data
                },
                "message": "Perfil de usuario obtenido correctamente"
            }), 200
        except Exception as e:
            logger.error(f"Error al serializar usuario {user_id}: {str(e)}")
            # Devolver datos básicos si hay error de serialización
            return jsonify({
                "success": True,
                "data": {
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "name": user.name
                    }
                },
                "message": "Perfil básico obtenido (error al procesar datos completos)"
            }), 200
    except Exception as e:
        logger.error(f"Error al obtener perfil de usuario: {str(e)}")
        return jsonify({
            "success": False,
            "error": "server_error",
            "message": "Error al obtener el perfil de usuario"
        }), 500
```

### Endpoint de Carga de Datasets

```python
@datasets_bp.route('/', methods=['POST'])
@jwt_required()
def upload_dataset():
    try:
        # Validar token y usuario
        current_user_id = get_jwt_identity()
        try:
            user_id = int(current_user_id)
        except (TypeError, ValueError):
            logger.warning(f"ID de usuario inválido en token: {current_user_id}")
            return jsonify({
                "success": False,
                "error": "invalid_token_identity",
                "message": "ID de usuario inválido en el token"
            }), 401
        
        # Validar proyecto
        project_id = request.form.get('project_id')
        if not project_id:
            return jsonify({
                "success": False,
                "error": "missing_project_id",
                "message": "ID de proyecto no proporcionado"
            }), 400
        
        # Validar archivo
        if 'file' not in request.files:
            return jsonify({
                "success": False,
                "error": "missing_file",
                "message": "No se ha proporcionado ningún archivo"
            }), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({
                "success": False,
                "error": "empty_filename",
                "message": "El archivo no tiene nombre"
            }), 400
        
        # Procesar dataset
        try:
            result = dataset_service.process_and_save(file, project_id, user_id)
            return jsonify({
                "success": True,
                "data": result,
                "message": "Dataset cargado correctamente"
            }), 201
        except ValueError as e:
            return jsonify({
                "success": False,
                "error": "invalid_data",
                "message": str(e)
            }), 400
        except PermissionError as e:
            return jsonify({
                "success": False,
                "error": "permission_denied",
                "message": str(e)
            }), 403
    except Exception as e:
        logger.error(f"Error al cargar dataset: {str(e)}")
        return jsonify({
            "success": False,
            "error": "upload_error",
            "message": f"Error al cargar el dataset: {str(e)}"
        }), 500
```
