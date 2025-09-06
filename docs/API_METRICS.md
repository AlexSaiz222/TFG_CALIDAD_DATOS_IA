# Endpoints de Métricas

Esta sección documenta los endpoints relacionados con la gestión de métricas de calidad de datos en la Plataforma de Evaluación de Calidad de Datos.

## Listado de Métricas Disponibles

Obtiene la lista de todas las métricas de calidad disponibles en la plataforma.

**Endpoint:** `GET /api/metrics`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Parámetros de consulta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| category | string | Filtrar por categoría de métrica (opcional) |

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "metrics": [
      {
        "id": "completeness",
        "name": "Completitud",
        "description": "Mide la proporción de valores no nulos en los datos",
        "category": "completeness",
        "parameters": [
          {
            "name": "columns",
            "type": "array",
            "description": "Columnas a evaluar (vacío para todas)",
            "required": false
          }
        ]
      },
      {
        "id": "uniqueness",
        "name": "Unicidad",
        "description": "Mide la proporción de valores únicos en una columna",
        "category": "uniqueness",
        "parameters": [
          {
            "name": "columns",
            "type": "array",
            "description": "Columnas a evaluar",
            "required": true
          }
        ]
      },
      {
        "id": "consistency_pattern",
        "name": "Consistencia de Patrón",
        "description": "Verifica que los valores sigan un patrón específico",
        "category": "consistency",
        "parameters": [
          {
            "name": "column",
            "type": "string",
            "description": "Columna a evaluar",
            "required": true
          },
          {
            "name": "pattern",
            "type": "string",
            "description": "Expresión regular para validar",
            "required": true
          }
        ]
      }
    ],
    "categories": [
      {
        "id": "completeness",
        "name": "Completitud",
        "description": "Métricas relacionadas con la presencia de datos"
      },
      {
        "id": "uniqueness",
        "name": "Unicidad",
        "description": "Métricas relacionadas con la duplicación de datos"
      },
      {
        "id": "consistency",
        "name": "Consistencia",
        "description": "Métricas relacionadas con la coherencia de los datos"
      },
      {
        "id": "validity",
        "name": "Validez",
        "description": "Métricas relacionadas con la validez de los datos"
      },
      {
        "id": "accuracy",
        "name": "Precisión",
        "description": "Métricas relacionadas con la exactitud de los datos"
      },
      {
        "id": "timeliness",
        "name": "Temporalidad",
        "description": "Métricas relacionadas con la actualidad de los datos"
      }
    ]
  },
  "message": "Métricas obtenidas correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado

## Detalles de Métrica

Obtiene información detallada sobre una métrica específica.

**Endpoint:** `GET /api/metrics/{metric_id}`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| metric_id | string | ID de la métrica |

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "metric": {
      "id": "completeness",
      "name": "Completitud",
      "description": "Mide la proporción de valores no nulos en los datos",
      "category": "completeness",
      "formula": "count(non_null_values) / count(total_values)",
      "interpretation": "Un valor de 1.0 indica que no hay valores nulos en los datos seleccionados",
      "parameters": [
        {
          "name": "columns",
          "type": "array",
          "description": "Columnas a evaluar (vacío para todas)",
          "required": false,
          "default": []
        }
      ],
      "example_usage": {
        "python": "from quality_metrics import completeness\nscore = completeness(df, columns=['nombre', 'email'])",
        "api": "POST /api/evaluations/datasets/1/metrics\n{\n  \"metrics\": [\n    {\n      \"id\": \"completeness\",\n      \"parameters\": {\n        \"columns\": [\"nombre\", \"email\"]\n      }\n    }\n  ]\n}"
      },
      "thresholds": {
        "excellent": 0.98,
        "good": 0.95,
        "acceptable": 0.90,
        "poor": 0.80
      }
    }
  },
  "message": "Métrica obtenida correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado
- `404 Not Found`: Métrica no encontrada

## Configuración de Métricas por Proyecto

### Obtener Configuración

Obtiene la configuración de métricas para un proyecto específico.

**Endpoint:** `GET /api/projects/{project_id}/metrics/config`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| project_id | integer | ID del proyecto |

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "metrics_config": {
      "enabled_metrics": [
        {
          "id": "completeness",
          "parameters": {
            "columns": ["nombre", "email", "telefono"]
          },
          "thresholds": {
            "warning": 0.90,
            "error": 0.80
          }
        },
        {
          "id": "uniqueness",
          "parameters": {
            "columns": ["id", "email"]
          },
          "thresholds": {
            "warning": 0.98,
            "error": 0.95
          }
        },
        {
          "id": "consistency_pattern",
          "parameters": {
            "column": "email",
            "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
          },
          "thresholds": {
            "warning": 0.95,
            "error": 0.90
          }
        }
      ],
      "global_settings": {
        "quality_score_weights": {
          "completeness": 0.3,
          "uniqueness": 0.2,
          "consistency": 0.2,
          "validity": 0.2,
          "accuracy": 0.1
        },
        "notification_thresholds": {
          "quality_score": 0.85
        }
      },
      "created_at": "2023-08-10T14:30:45Z",
      "updated_at": "2023-08-12T09:15:22Z"
    }
  },
  "message": "Configuración de métricas obtenida correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para acceder a este proyecto
- `404 Not Found`: Proyecto no encontrado

### Actualizar Configuración

Actualiza la configuración de métricas para un proyecto específico.

**Endpoint:** `PUT /api/projects/{project_id}/metrics/config`

**Encabezados:**

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| project_id | integer | ID del proyecto |

**Cuerpo de la solicitud:**

```json
{
  "enabled_metrics": [
    {
      "id": "completeness",
      "parameters": {
        "columns": ["nombre", "email", "telefono", "direccion"]
      },
      "thresholds": {
        "warning": 0.92,
        "error": 0.85
      }
    },
    {
      "id": "uniqueness",
      "parameters": {
        "columns": ["id", "email", "codigo_cliente"]
      },
      "thresholds": {
        "warning": 0.99,
        "error": 0.97
      }
    }
  ],
  "global_settings": {
    "quality_score_weights": {
      "completeness": 0.25,
      "uniqueness": 0.25,
      "consistency": 0.2,
      "validity": 0.2,
      "accuracy": 0.1
    },
    "notification_thresholds": {
      "quality_score": 0.90
    }
  }
}
```

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "metrics_config": {
      "enabled_metrics": [
        {
          "id": "completeness",
          "parameters": {
            "columns": ["nombre", "email", "telefono", "direccion"]
          },
          "thresholds": {
            "warning": 0.92,
            "error": 0.85
          }
        },
        {
          "id": "uniqueness",
          "parameters": {
            "columns": ["id", "email", "codigo_cliente"]
          },
          "thresholds": {
            "warning": 0.99,
            "error": 0.97
          }
        }
      ],
      "global_settings": {
        "quality_score_weights": {
          "completeness": 0.25,
          "uniqueness": 0.25,
          "consistency": 0.2,
          "validity": 0.2,
          "accuracy": 0.1
        },
        "notification_thresholds": {
          "quality_score": 0.90
        }
      },
      "created_at": "2023-08-10T14:30:45Z",
      "updated_at": "2023-08-13T16:20:15Z"
    }
  },
  "message": "Configuración de métricas actualizada correctamente"
}
```

**Posibles errores:**

- `400 Bad Request`: Datos de configuración inválidos
- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para modificar este proyecto
- `404 Not Found`: Proyecto o métrica no encontrada

## Plantillas de Métricas

### Listar Plantillas

Obtiene la lista de todas las plantillas de métricas disponibles.

**Endpoint:** `GET /api/metrics/templates`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": 1,
        "name": "Plantilla Básica",
        "description": "Configuración básica de métricas de calidad",
        "created_by": 1,
        "created_at": "2023-08-15T10:30:45Z",
        "metrics": [
          {
            "id": "completeness",
            "parameters": {
              "columns": ["nombre", "email"]
            },
            "thresholds": {
              "warning": 0.9,
              "error": 0.8
            }
          },
          {
            "id": "uniqueness",
            "parameters": {
              "columns": ["id", "email"]
            },
            "thresholds": {
              "warning": 0.95,
              "error": 0.9
            }
          }
        ]
      },
      {
        "id": 2,
        "name": "Plantilla Avanzada",
        "description": "Configuración avanzada con múltiples métricas",
        "created_by": 1,
        "created_at": "2023-08-16T14:20:30Z",
        "metrics": [
          {
            "id": "completeness",
            "parameters": {
              "columns": ["nombre", "email", "telefono"]
            },
            "thresholds": {
              "warning": 0.95,
              "error": 0.85
            }
          },
          {
            "id": "uniqueness",
            "parameters": {
              "columns": ["id", "email"]
            },
            "thresholds": {
              "warning": 0.98,
              "error": 0.95
            }
          },
          {
            "id": "consistency_pattern",
            "parameters": {
              "column": "email",
              "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
            },
            "thresholds": {
              "warning": 0.95,
              "error": 0.9
            }
          }
        ]
      }
    ]
  },
  "message": "Plantillas obtenidas correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado

### Obtener Plantilla

Obtiene los detalles de una plantilla específica.

**Endpoint:** `GET /api/metrics/templates/{template_id}`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| template_id | integer | ID de la plantilla |

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "template": {
      "id": 1,
      "name": "Plantilla Básica",
      "description": "Configuración básica de métricas de calidad",
      "created_by": 1,
      "created_at": "2023-08-15T10:30:45Z",
      "metrics": [
        {
          "id": "completeness",
          "parameters": {
            "columns": ["nombre", "email"]
          },
          "thresholds": {
            "warning": 0.9,
            "error": 0.8
          }
        },
        {
          "id": "uniqueness",
          "parameters": {
            "columns": ["id", "email"]
          },
          "thresholds": {
            "warning": 0.95,
            "error": 0.9
          }
        }
      ]
    }
  },
  "message": "Plantilla obtenida correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado
- `404 Not Found`: Plantilla no encontrada

### Crear Plantilla

Crea una nueva plantilla de métricas.

**Endpoint:** `POST /api/metrics/templates`

**Encabezados:**

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Cuerpo de la solicitud:**

```json
{
  "name": "Nueva Plantilla",
  "description": "Descripción de la nueva plantilla",
  "metrics": [
    {
      "id": "completeness",
      "parameters": {
        "columns": ["nombre", "email"]
      },
      "thresholds": {
        "warning": 0.9,
        "error": 0.8
      }
    },
    {
      "id": "uniqueness",
      "parameters": {
        "columns": ["id"]
      },
      "thresholds": {
        "warning": 0.98,
        "error": 0.95
      }
    }
  ]
}
```

**Respuesta exitosa (201 Created):**

```json
{
  "success": true,
  "data": {
    "template": {
      "id": 3,
      "name": "Nueva Plantilla",
      "description": "Descripción de la nueva plantilla",
      "created_by": 1,
      "created_at": "2023-08-17T09:45:30Z",
      "metrics": [
        {
          "id": "completeness",
          "parameters": {
            "columns": ["nombre", "email"]
          },
          "thresholds": {
            "warning": 0.9,
            "error": 0.8
          }
        },
        {
          "id": "uniqueness",
          "parameters": {
            "columns": ["id"]
          },
          "thresholds": {
            "warning": 0.98,
            "error": 0.95
          }
        }
      ]
    }
  },
  "message": "Plantilla creada correctamente"
}
```

**Posibles errores:**

- `400 Bad Request`: Datos de plantilla inválidos
- `401 Unauthorized`: Token de acceso inválido o expirado
- `409 Conflict`: Ya existe una plantilla con el mismo nombre

### Actualizar Plantilla

Actualiza una plantilla de métricas existente.

**Endpoint:** `PUT /api/metrics/templates/{template_id}`

**Encabezados:**

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| template_id | integer | ID de la plantilla |

**Cuerpo de la solicitud:**

```json
{
  "name": "Plantilla Actualizada",
  "description": "Descripción actualizada",
  "metrics": [
    {
      "id": "completeness",
      "parameters": {
        "columns": ["nombre", "email", "telefono"]
      },
      "thresholds": {
        "warning": 0.92,
        "error": 0.85
      }
    },
    {
      "id": "uniqueness",
      "parameters": {
        "columns": ["id", "codigo_cliente"]
      },
      "thresholds": {
        "warning": 0.99,
        "error": 0.97
      }
    }
  ]
}
```

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "template": {
      "id": 1,
      "name": "Plantilla Actualizada",
      "description": "Descripción actualizada",
      "created_by": 1,
      "created_at": "2023-08-15T10:30:45Z",
      "updated_at": "2023-08-17T11:20:15Z",
      "metrics": [
        {
          "id": "completeness",
          "parameters": {
            "columns": ["nombre", "email", "telefono"]
          },
          "thresholds": {
            "warning": 0.92,
            "error": 0.85
          }
        },
        {
          "id": "uniqueness",
          "parameters": {
            "columns": ["id", "codigo_cliente"]
          },
          "thresholds": {
            "warning": 0.99,
            "error": 0.97
          }
        }
      ]
    }
  },
  "message": "Plantilla actualizada correctamente"
}
```

**Posibles errores:**

- `400 Bad Request`: Datos de plantilla inválidos
- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para modificar esta plantilla
- `404 Not Found`: Plantilla no encontrada
- `409 Conflict`: Ya existe otra plantilla con el mismo nombre

### Eliminar Plantilla

Elimina una plantilla de métricas.

**Endpoint:** `DELETE /api/metrics/templates/{template_id}`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| template_id | integer | ID de la plantilla |

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "message": "Plantilla eliminada correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para eliminar esta plantilla
- `404 Not Found`: Plantilla no encontrada

## Validación de Configuración de Métricas

Valida una configuración de métricas antes de guardarla.

**Endpoint:** `POST /api/metrics/validate`

**Encabezados:**

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Cuerpo de la solicitud:**

```json
{
  "metrics": [
    {
      "id": "completeness",
      "parameters": {
        "columns": ["nombre", "email"]
      }
    },
    {
      "id": "consistency_pattern",
      "parameters": {
        "column": "email",
        "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
      }
    }
  ]
}
```

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "validation": {
      "valid": true,
      "metrics": [
        {
          "id": "completeness",
          "valid": true
        },
        {
          "id": "consistency_pattern",
          "valid": true
        }
      ]
    }
  },
  "message": "Configuración de métricas válida"
}
```

**Respuesta con errores (200 OK):**

```json
{
  "success": true,
  "data": {
    "validation": {
      "valid": false,
      "metrics": [
        {
          "id": "completeness",
          "valid": true
        },
        {
          "id": "consistency_pattern",
          "valid": false,
          "errors": [
            {
              "parameter": "pattern",
              "message": "Expresión regular inválida"
            }
          ]
        }
      ]
    }
  },
  "message": "La configuración de métricas contiene errores"
}
```

**Posibles errores:**

- `400 Bad Request`: Datos de solicitud inválidos
- `401 Unauthorized`: Token de acceso inválido o expirado

## Implementación en el Backend

A continuación se muestra un ejemplo de cómo están implementadas las rutas de métricas en el backend:

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timezone

from models.metric import Metric, MetricCategory
from models.project import Project
from models.metrics_config import ProjectMetricsConfig
from services.metrics import validate_metric_config
from extensions import db

metrics_bp = Blueprint('metrics', __name__)

@metrics_bp.route('', methods=['GET'])
@jwt_required()
def get_metrics():
    # Filtrar por categoría si se proporciona
    category = request.args.get('category')
    
    # Obtener todas las métricas disponibles
    metrics_query = Metric.query
    if category:
        metrics_query = metrics_query.filter_by(category=category)
    
    metrics = metrics_query.all()
    categories = MetricCategory.query.all()
    
    # Formatear resultados
    metrics_list = []
    for metric in metrics:
        metrics_list.append({
            'id': metric.id,
            'name': metric.name,
            'description': metric.description,
            'category': metric.category,
            'parameters': metric.parameters
        })
    
    categories_list = []
    for category in categories:
        categories_list.append({
            'id': category.id,
            'name': category.name,
            'description': category.description
        })
    
    return jsonify({
        'success': True,
        'data': {
            'metrics': metrics_list,
            'categories': categories_list
        },
        'message': 'Métricas obtenidas correctamente'
    }), 200

@metrics_bp.route('/<string:metric_id>', methods=['GET'])
@jwt_required()
def get_metric(metric_id):
    # Buscar métrica por ID
    metric = Metric.query.get(metric_id)
    
    if not metric:
        return jsonify({
            'success': False,
            'error': {
                'code': 'METRIC_NOT_FOUND',
                'message': 'Métrica no encontrada'
            }
        }), 404
    
    # Formatear resultado
    metric_data = {
        'id': metric.id,
        'name': metric.name,
        'description': metric.description,
        'category': metric.category,
        'formula': metric.formula,
        'interpretation': metric.interpretation,
        'parameters': metric.parameters,
        'example_usage': metric.example_usage,
        'thresholds': metric.thresholds
    }
    
    return jsonify({
        'success': True,
        'data': {
            'metric': metric_data
        },
        'message': 'Métrica obtenida correctamente'
    }), 200

@metrics_bp.route('/projects/<int:project_id>/metrics/config', methods=['GET'])
@jwt_required()
def get_project_metrics_config(project_id):
    user_id = get_jwt_identity()
    
    # Verificar acceso al proyecto
    project = Project.query.get(project_id)
    if not project:
        return jsonify({
            'success': False,
            'error': {
                'code': 'PROJECT_NOT_FOUND',
                'message': 'Proyecto no encontrado'
            }
        }), 404
    
    # Verificar permisos
    if project.owner_id != user_id:
        # Verificar si es colaborador
        collaboration = ProjectCollaborator.query.filter_by(
            project_id=project_id, user_id=user_id
        ).first()
        
        if not collaboration:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'FORBIDDEN',
                    'message': 'No tiene permisos para acceder a este proyecto'
                }
            }), 403
    
    # Obtener configuración de métricas
    metrics_config = ProjectMetricsConfig.query.filter_by(project_id=project_id).first()
    
    if not metrics_config:
        # Si no existe configuración, devolver una configuración por defecto
        return jsonify({
            'success': True,
            'data': {
                'metrics_config': {
                    'enabled_metrics': [],
                    'global_settings': {
                        'quality_score_weights': {
                            'completeness': 0.2,
                            'uniqueness': 0.2,
                            'consistency': 0.2,
                            'validity': 0.2,
                            'accuracy': 0.2
                        },
                        'notification_thresholds': {
                            'quality_score': 0.85
                        }
                    },
                    'created_at': None,
                    'updated_at': None
                }
            },
            'message': 'Configuración de métricas por defecto'
        }), 200
    
    # Formatear resultado
    config_data = {
        'enabled_metrics': metrics_config.enabled_metrics,
        'global_settings': metrics_config.global_settings,
        'created_at': metrics_config.created_at.isoformat(),
        'updated_at': metrics_config.updated_at.isoformat() if metrics_config.updated_at else None
    }
    
    return jsonify({
        'success': True,
        'data': {
            'metrics_config': config_data
        },
        'message': 'Configuración de métricas obtenida correctamente'
    }), 200

@metrics_bp.route('/projects/<int:project_id>/metrics/config', methods=['PUT'])
@jwt_required()
def update_project_metrics_config(project_id):
    user_id = get_jwt_identity()
    data = request.get_json()
    
    # Verificar acceso al proyecto
    project = Project.query.get(project_id)
    if not project:
        return jsonify({
            'success': False,
            'error': {
                'code': 'PROJECT_NOT_FOUND',
                'message': 'Proyecto no encontrado'
            }
        }), 404
    
    # Verificar permisos
    if project.owner_id != user_id:
        # Verificar si es colaborador con permisos de edición
        collaboration = ProjectCollaborator.query.filter_by(
            project_id=project_id, user_id=user_id, role='editor'
        ).first()
        
        if not collaboration:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'FORBIDDEN',
                    'message': 'No tiene permisos para modificar este proyecto'
                }
            }), 403
    
    # Validar configuración de métricas
    if 'enabled_metrics' in data:
        validation_result = validate_metric_config(data['enabled_metrics'])
        if not validation_result['valid']:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'INVALID_CONFIG',
                    'message': 'Configuración de métricas inválida',
                    'details': validation_result['errors']
                }
            }), 400
    
    # Obtener o crear configuración de métricas
    metrics_config = ProjectMetricsConfig.query.filter_by(project_id=project_id).first()
    
    if not metrics_config:
        metrics_config = ProjectMetricsConfig(
            project_id=project_id,
            enabled_metrics=[],
            global_settings={
                'quality_score_weights': {
                    'completeness': 0.2,
                    'uniqueness': 0.2,
                    'consistency': 0.2,
                    'validity': 0.2,
                    'accuracy': 0.2
                },
                'notification_thresholds': {
                    'quality_score': 0.85
                }
            },
            created_at=datetime.now(timezone.utc)
        )
        db.session.add(metrics_config)
    
    # Actualizar configuración
    if 'enabled_metrics' in data:
        metrics_config.enabled_metrics = data['enabled_metrics']
    
    if 'global_settings' in data:
        metrics_config.global_settings = data['global_settings']
    
    metrics_config.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    
    # Formatear resultado
    config_data = {
        'enabled_metrics': metrics_config.enabled_metrics,
        'global_settings': metrics_config.global_settings,
        'created_at': metrics_config.created_at.isoformat(),
        'updated_at': metrics_config.updated_at.isoformat() if metrics_config.updated_at else None
    }
    
    return jsonify({
        'success': True,
        'data': {
            'metrics_config': config_data
        },
        'message': 'Configuración de métricas actualizada correctamente'
    }), 200

@metrics_bp.route('/validate', methods=['POST'])
@jwt_required()
def validate_metrics():
    data = request.get_json()
    
    if not data or 'metrics' not in data:
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_DATA',
                'message': 'Se requiere una lista de métricas para validar'
            }
        }), 400
    
    # Validar configuración de métricas
    validation_result = validate_metric_config(data['metrics'])
    
    return jsonify({
        'success': True,
        'data': {
            'validation': validation_result
        },
        'message': 'Configuración de métricas válida' if validation_result['valid'] else 'La configuración de métricas contiene errores'
    }), 200
```

Este módulo de métricas proporciona la funcionalidad básica para la gestión de métricas de calidad de datos en la plataforma, permitiendo a los usuarios consultar las métricas disponibles, configurarlas para sus proyectos y validar sus configuraciones antes de aplicarlas.
