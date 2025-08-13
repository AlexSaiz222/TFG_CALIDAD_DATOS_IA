# Endpoints de Evaluaciones

Esta sección documenta los endpoints relacionados con la ejecución y gestión de evaluaciones de calidad de datos en la Plataforma de Evaluación de Calidad de Datos.

## Iniciar Evaluación

Inicia una nueva evaluación de calidad para un dataset específico.

**Endpoint:** `POST /api/evaluations/datasets/{dataset_id}`

**Encabezados:**

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| dataset_id | integer | ID del dataset a evaluar |

**Cuerpo de la solicitud:**

```json
{
  "metrics": [
    {
      "id": "completeness",
      "parameters": {
        "columns": ["nombre", "email", "telefono"]
      }
    },
    {
      "id": "uniqueness",
      "parameters": {
        "columns": ["id", "email"]
      }
    },
    {
      "id": "consistency_pattern",
      "parameters": {
        "column": "email",
        "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
      }
    }
  ],
  "options": {
    "use_project_config": false,
    "sample_size": 1000,
    "notification_email": "usuario@ejemplo.com"
  }
}
```

**Respuesta exitosa (202 Accepted):**

```json
{
  "success": true,
  "data": {
    "evaluation": {
      "id": 5,
      "dataset_id": 1,
      "status": "pending",
      "metrics": [
        {
          "id": "completeness",
          "parameters": {
            "columns": ["nombre", "email", "telefono"]
          }
        },
        {
          "id": "uniqueness",
          "parameters": {
            "columns": ["id", "email"]
          }
        },
        {
          "id": "consistency_pattern",
          "parameters": {
            "column": "email",
            "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
          }
        }
      ],
      "created_at": "2023-08-13T17:30:45Z",
      "task_id": "evaluation-task-12345"
    }
  },
  "message": "Evaluación iniciada correctamente"
}
```

**Posibles errores:**

- `400 Bad Request`: Datos de evaluación inválidos
- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para evaluar este dataset
- `404 Not Found`: Dataset no encontrado
- `422 Unprocessable Entity`: Configuración de métricas inválida

## Listado de Evaluaciones

Obtiene la lista de evaluaciones para un dataset específico.

**Endpoint:** `GET /api/evaluations/datasets/{dataset_id}`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| dataset_id | integer | ID del dataset |

**Parámetros de consulta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| page | integer | Número de página (por defecto: 1) |
| per_page | integer | Elementos por página (por defecto: 10, máximo: 50) |
| status | string | Filtrar por estado (valores: pending, processing, completed, failed) |

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "evaluations": [
      {
        "id": 5,
        "dataset_id": 1,
        "status": "completed",
        "metrics_count": 3,
        "quality_score": 92.5,
        "created_at": "2023-08-13T17:30:45Z",
        "completed_at": "2023-08-13T17:32:10Z",
        "duration_seconds": 85
      },
      {
        "id": 4,
        "dataset_id": 1,
        "status": "completed",
        "metrics_count": 5,
        "quality_score": 88.7,
        "created_at": "2023-08-12T14:20:30Z",
        "completed_at": "2023-08-12T14:22:15Z",
        "duration_seconds": 105
      },
      {
        "id": 3,
        "dataset_id": 1,
        "status": "completed",
        "metrics_count": 5,
        "quality_score": 87.5,
        "created_at": "2023-08-10T16:15:20Z",
        "completed_at": "2023-08-10T16:17:45Z",
        "duration_seconds": 145
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 10,
      "total_items": 3,
      "total_pages": 1
    }
  },
  "message": "Evaluaciones obtenidas correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para acceder a este dataset
- `404 Not Found`: Dataset no encontrado

## Detalles de Evaluación

Obtiene información detallada de una evaluación específica.

**Endpoint:** `GET /api/evaluations/{evaluation_id}`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| evaluation_id | integer | ID de la evaluación |

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "evaluation": {
      "id": 5,
      "dataset_id": 1,
      "dataset_name": "Dataset de Ventas",
      "project_id": 1,
      "project_name": "Proyecto de Ejemplo",
      "status": "completed",
      "quality_score": 92.5,
      "metrics_results": [
        {
          "metric_id": "completeness",
          "name": "Completitud",
          "category": "completeness",
          "parameters": {
            "columns": ["nombre", "email", "telefono"]
          },
          "score": 0.98,
          "status": "excellent",
          "details": {
            "column_scores": {
              "nombre": 1.0,
              "email": 0.97,
              "telefono": 0.97
            },
            "total_rows": 5000,
            "null_counts": {
              "nombre": 0,
              "email": 150,
              "telefono": 150
            }
          }
        },
        {
          "metric_id": "uniqueness",
          "name": "Unicidad",
          "category": "uniqueness",
          "parameters": {
            "columns": ["id", "email"]
          },
          "score": 0.995,
          "status": "excellent",
          "details": {
            "column_scores": {
              "id": 1.0,
              "email": 0.99
            },
            "total_rows": 5000,
            "duplicate_counts": {
              "id": 0,
              "email": 50
            }
          }
        },
        {
          "metric_id": "consistency_pattern",
          "name": "Consistencia de Patrón",
          "category": "consistency",
          "parameters": {
            "column": "email",
            "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
          },
          "score": 0.96,
          "status": "excellent",
          "details": {
            "total_rows": 5000,
            "valid_count": 4800,
            "invalid_count": 200,
            "null_count": 0,
            "examples": {
              "invalid": [
                "usuario@dominio",
                "usuario.com",
                "usuario@.com"
              ]
            }
          }
        }
      ],
      "summary": {
        "by_category": {
          "completeness": {
            "score": 0.98,
            "metrics_count": 1,
            "status": "excellent"
          },
          "uniqueness": {
            "score": 0.995,
            "metrics_count": 1,
            "status": "excellent"
          },
          "consistency": {
            "score": 0.96,
            "metrics_count": 1,
            "status": "excellent"
          }
        },
        "issues": [
          {
            "severity": "warning",
            "message": "200 registros con formato de email inválido",
            "metric_id": "consistency_pattern",
            "column": "email"
          },
          {
            "severity": "info",
            "message": "150 valores nulos en la columna email",
            "metric_id": "completeness",
            "column": "email"
          }
        ]
      },
      "created_at": "2023-08-13T17:30:45Z",
      "completed_at": "2023-08-13T17:32:10Z",
      "duration_seconds": 85
    }
  },
  "message": "Evaluación obtenida correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para acceder a esta evaluación
- `404 Not Found`: Evaluación no encontrada

## Estado de Evaluación

Obtiene el estado actual de una evaluación en proceso.

**Endpoint:** `GET /api/evaluations/{evaluation_id}/status`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| evaluation_id | integer | ID de la evaluación |

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "status": {
      "evaluation_id": 5,
      "status": "processing",
      "progress": 65,
      "current_step": "Evaluando unicidad de datos",
      "steps_completed": 2,
      "steps_total": 3,
      "started_at": "2023-08-13T17:30:45Z",
      "estimated_completion": "2023-08-13T17:32:15Z"
    }
  },
  "message": "Estado de evaluación obtenido correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para acceder a esta evaluación
- `404 Not Found`: Evaluación no encontrada

## Cancelar Evaluación

Cancela una evaluación en proceso.

**Endpoint:** `POST /api/evaluations/{evaluation_id}/cancel`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| evaluation_id | integer | ID de la evaluación |

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "message": "Evaluación cancelada correctamente"
}
```

**Posibles errores:**

- `400 Bad Request`: La evaluación no puede ser cancelada (ya completada o fallida)
- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para cancelar esta evaluación
- `404 Not Found`: Evaluación no encontrada

## Comparar Evaluaciones

Compara los resultados de dos evaluaciones.

**Endpoint:** `GET /api/evaluations/compare`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Parámetros de consulta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| evaluation_id_1 | integer | ID de la primera evaluación |
| evaluation_id_2 | integer | ID de la segunda evaluación |

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "comparison": {
      "evaluations": [
        {
          "id": 5,
          "dataset_id": 1,
          "dataset_name": "Dataset de Ventas",
          "created_at": "2023-08-13T17:30:45Z",
          "quality_score": 92.5
        },
        {
          "id": 3,
          "dataset_id": 1,
          "dataset_name": "Dataset de Ventas",
          "created_at": "2023-08-10T16:15:20Z",
          "quality_score": 87.5
        }
      ],
      "metrics_comparison": [
        {
          "metric_id": "completeness",
          "name": "Completitud",
          "scores": [0.98, 0.95],
          "difference": 0.03,
          "trend": "improvement"
        },
        {
          "metric_id": "uniqueness",
          "name": "Unicidad",
          "scores": [0.995, 0.99],
          "difference": 0.005,
          "trend": "improvement"
        },
        {
          "metric_id": "consistency_pattern",
          "name": "Consistencia de Patrón",
          "scores": [0.96, 0.94],
          "difference": 0.02,
          "trend": "improvement"
        }
      ],
      "categories_comparison": [
        {
          "category": "completeness",
          "name": "Completitud",
          "scores": [0.98, 0.95],
          "difference": 0.03,
          "trend": "improvement"
        },
        {
          "category": "uniqueness",
          "name": "Unicidad",
          "scores": [0.995, 0.99],
          "difference": 0.005,
          "trend": "improvement"
        },
        {
          "category": "consistency",
          "name": "Consistencia",
          "scores": [0.96, 0.94],
          "difference": 0.02,
          "trend": "improvement"
        }
      ],
      "overall_difference": 5.0,
      "overall_trend": "improvement"
    }
  },
  "message": "Comparación de evaluaciones obtenida correctamente"
}
```

**Posibles errores:**

- `400 Bad Request`: IDs de evaluación no proporcionados o inválidos
- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para acceder a estas evaluaciones
- `404 Not Found`: Una o ambas evaluaciones no encontradas

## Exportar Resultados de Evaluación

Exporta los resultados de una evaluación en diferentes formatos.

**Endpoint:** `GET /api/evaluations/{evaluation_id}/export`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| evaluation_id | integer | ID de la evaluación |

**Parámetros de consulta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| format | string | Formato de exportación (valores: json, csv, pdf, html) |

**Respuesta exitosa (200 OK):**

La respuesta es un archivo descargable en el formato solicitado.

**Posibles errores:**

- `400 Bad Request`: Formato de exportación no válido
- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para acceder a esta evaluación
- `404 Not Found`: Evaluación no encontrada

## Implementación en el Backend

A continuación se muestra un ejemplo de cómo están implementadas las rutas de evaluaciones en el backend:

```python
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timezone
import uuid

from models.evaluation import Evaluation, EvaluationStatus
from models.dataset import Dataset
from models.project import Project
from models.user import User
from services.evaluation_service import start_evaluation, get_evaluation_status, cancel_evaluation
from services.export_service import export_evaluation
from extensions import db, task_queue

evaluations_bp = Blueprint('evaluations', __name__)

@evaluations_bp.route('/datasets/<int:dataset_id>', methods=['POST'])
@jwt_required()
def create_evaluation(dataset_id):
    user_id = get_jwt_identity()
    data = request.get_json()
    
    # Verificar acceso al dataset
    dataset = Dataset.query.get(dataset_id)
    if not dataset:
        return jsonify({
            'success': False,
            'error': {
                'code': 'DATASET_NOT_FOUND',
                'message': 'Dataset no encontrado'
            }
        }), 404
    
    # Obtener proyecto asociado al dataset
    project = Project.query.get(dataset.project_id)
    
    # Verificar permisos
    if project.owner_id != user_id:
        # Verificar si es colaborador con permisos de edición
        collaboration = ProjectCollaborator.query.filter_by(
            project_id=project.id, user_id=user_id, role='editor'
        ).first()
        
        if not collaboration:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'FORBIDDEN',
                    'message': 'No tiene permisos para evaluar este dataset'
                }
            }), 403
    
    # Validar datos de evaluación
    if not data or 'metrics' not in data:
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_DATA',
                'message': 'Se requiere una lista de métricas para la evaluación'
            }
        }), 400
    
    # Obtener opciones de evaluación
    options = data.get('options', {})
    use_project_config = options.get('use_project_config', False)
    
    # Si se usa la configuración del proyecto, obtener métricas configuradas
    if use_project_config:
        metrics_config = ProjectMetricsConfig.query.filter_by(project_id=project.id).first()
        if metrics_config and metrics_config.enabled_metrics:
            metrics = metrics_config.enabled_metrics
        else:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'NO_PROJECT_CONFIG',
                    'message': 'No hay configuración de métricas para este proyecto'
                }
            }), 400
    else:
        metrics = data['metrics']
    
    # Crear nueva evaluación
    new_evaluation = Evaluation(
        dataset_id=dataset_id,
        status=EvaluationStatus.PENDING,
        metrics=metrics,
        created_by=user_id,
        created_at=datetime.now(timezone.utc)
    )
    
    db.session.add(new_evaluation)
    db.session.commit()
    
    # Generar ID de tarea único
    task_id = f"evaluation-{uuid.uuid4()}"
    
    # Iniciar tarea de evaluación en segundo plano
    task_queue.enqueue(
        start_evaluation,
        evaluation_id=new_evaluation.id,
        task_id=task_id,
        options=options
    )
    
    # Actualizar evaluación con ID de tarea
    new_evaluation.task_id = task_id
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': {
            'evaluation': {
                'id': new_evaluation.id,
                'dataset_id': new_evaluation.dataset_id,
                'status': new_evaluation.status,
                'metrics': new_evaluation.metrics,
                'created_at': new_evaluation.created_at.isoformat(),
                'task_id': new_evaluation.task_id
            }
        },
        'message': 'Evaluación iniciada correctamente'
    }), 202

@evaluations_bp.route('/datasets/<int:dataset_id>', methods=['GET'])
@jwt_required()
def get_dataset_evaluations(dataset_id):
    user_id = get_jwt_identity()
    
    # Verificar acceso al dataset
    dataset = Dataset.query.get(dataset_id)
    if not dataset:
        return jsonify({
            'success': False,
            'error': {
                'code': 'DATASET_NOT_FOUND',
                'message': 'Dataset no encontrado'
            }
        }), 404
    
    # Obtener proyecto asociado al dataset
    project = Project.query.get(dataset.project_id)
    
    # Verificar permisos
    if project.owner_id != user_id:
        # Verificar si es colaborador
        collaboration = ProjectCollaborator.query.filter_by(
            project_id=project.id, user_id=user_id
        ).first()
        
        if not collaboration:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'FORBIDDEN',
                    'message': 'No tiene permisos para acceder a este dataset'
                }
            }), 403
    
    # Parámetros de paginación y filtrado
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 10, type=int), 50)
    status = request.args.get('status')
    
    # Consulta de evaluaciones
    evaluations_query = Evaluation.query.filter_by(dataset_id=dataset_id)
    
    # Aplicar filtro por estado
    if status:
        evaluations_query = evaluations_query.filter_by(status=status)
    
    # Ordenar por fecha de creación descendente
    evaluations_query = evaluations_query.order_by(Evaluation.created_at.desc())
    
    # Aplicar paginación
    paginated = evaluations_query.paginate(page=page, per_page=per_page)
    
    # Formatear resultados
    evaluations = []
    for evaluation in paginated.items:
        # Calcular duración si está completada
        duration_seconds = None
        if evaluation.status == EvaluationStatus.COMPLETED and evaluation.completed_at:
            duration_seconds = (evaluation.completed_at - evaluation.created_at).total_seconds()
        
        evaluations.append({
            'id': evaluation.id,
            'dataset_id': evaluation.dataset_id,
            'status': evaluation.status,
            'metrics_count': len(evaluation.metrics) if evaluation.metrics else 0,
            'quality_score': evaluation.quality_score,
            'created_at': evaluation.created_at.isoformat(),
            'completed_at': evaluation.completed_at.isoformat() if evaluation.completed_at else None,
            'duration_seconds': duration_seconds
        })
    
    return jsonify({
        'success': True,
        'data': {
            'evaluations': evaluations,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total_items': paginated.total,
                'total_pages': paginated.pages
            }
        },
        'message': 'Evaluaciones obtenidas correctamente'
    }), 200

@evaluations_bp.route('/<int:evaluation_id>', methods=['GET'])
@jwt_required()
def get_evaluation(evaluation_id):
    user_id = get_jwt_identity()
    
    # Buscar evaluación
    evaluation = Evaluation.query.get(evaluation_id)
    
    if not evaluation:
        return jsonify({
            'success': False,
            'error': {
                'code': 'EVALUATION_NOT_FOUND',
                'message': 'Evaluación no encontrada'
            }
        }), 404
    
    # Obtener dataset y proyecto asociados
    dataset = Dataset.query.get(evaluation.dataset_id)
    project = Project.query.get(dataset.project_id)
    
    # Verificar permisos
    if project.owner_id != user_id:
        # Verificar si es colaborador
        collaboration = ProjectCollaborator.query.filter_by(
            project_id=project.id, user_id=user_id
        ).first()
        
        if not collaboration:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'FORBIDDEN',
                    'message': 'No tiene permisos para acceder a esta evaluación'
                }
            }), 403
    
    # Calcular duración si está completada
    duration_seconds = None
    if evaluation.status == EvaluationStatus.COMPLETED and evaluation.completed_at:
        duration_seconds = (evaluation.completed_at - evaluation.created_at).total_seconds()
    
    # Formatear resultado detallado
    evaluation_data = {
        'id': evaluation.id,
        'dataset_id': evaluation.dataset_id,
        'dataset_name': dataset.name,
        'project_id': project.id,
        'project_name': project.name,
        'status': evaluation.status,
        'quality_score': evaluation.quality_score,
        'metrics_results': evaluation.results,
        'summary': evaluation.summary,
        'created_at': evaluation.created_at.isoformat(),
        'completed_at': evaluation.completed_at.isoformat() if evaluation.completed_at else None,
        'duration_seconds': duration_seconds
    }
    
    return jsonify({
        'success': True,
        'data': {
            'evaluation': evaluation_data
        },
        'message': 'Evaluación obtenida correctamente'
    }), 200

# Implementaciones adicionales para status, cancel, compare y export...
```

Este módulo de evaluaciones proporciona la funcionalidad básica para la ejecución y gestión de evaluaciones de calidad de datos en la plataforma, permitiendo a los usuarios iniciar evaluaciones, consultar su estado y resultados, comparar evaluaciones y exportar informes.
