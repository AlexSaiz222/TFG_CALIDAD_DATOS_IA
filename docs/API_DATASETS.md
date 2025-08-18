# Endpoints de Datasets

Esta sección documenta los endpoints relacionados con la gestión de datasets en la Plataforma de Evaluación de Calidad de Datos.

## Listado de Datasets por Proyecto

Obtiene la lista de datasets asociados a un proyecto específico.

**Endpoint:** `GET /api/projects/{project_id}/datasets`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| project_id | integer | ID del proyecto |

**Parámetros de consulta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| page | integer | Número de página (por defecto: 1) |
| per_page | integer | Elementos por página (por defecto: 10, máximo: 50) |
| sort | string | Campo y dirección de ordenación (ej. `name:asc`, `created_at:desc`) |
| filter | string | Filtro en formato `campo:operador:valor` (ej. `name:contains:ventas`) |

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "datasets": [
      {
        "id": 1,
        "name": "Dataset de Ventas",
        "description": "Datos de ventas mensuales",
        "file_path": "datasets/1/ventas.csv",
        "file_type": "csv",
        "file_size": 1024000,
        "row_count": 5000,
        "column_count": 15,
        "created_at": "2023-08-10T15:20:10Z",
        "updated_at": "2023-08-10T15:20:10Z",
        "last_evaluation": {
          "id": 3,
          "status": "completed",
          "quality_score": 87.5,
          "completed_at": "2023-08-10T16:30:45Z"
        }
      },
      {
        "id": 2,
        "name": "Dataset de Clientes",
        "description": "Información de clientes",
        "file_path": "datasets/1/clientes.csv",
        "file_type": "csv",
        "file_size": 512000,
        "row_count": 2500,
        "column_count": 10,
        "created_at": "2023-08-11T09:45:30Z",
        "updated_at": "2023-08-11T09:45:30Z",
        "last_evaluation": null
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 10,
      "total_items": 2,
      "total_pages": 1
    }
  },
  "message": "Datasets obtenidos correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para acceder a este proyecto
- `404 Not Found`: Proyecto no encontrado

## Carga de Dataset

Sube un nuevo dataset asociado a un proyecto específico.

**Endpoint:** `POST /api/projects/{project_id}/datasets/upload`

**Encabezados:**

```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| project_id | integer | ID del proyecto |

**Parámetros del formulario:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| file | file | Archivo del dataset (formatos soportados: CSV, Excel, JSON, Parquet) |
| name | string | Nombre del dataset |
| description | string | Descripción del dataset (opcional) |
| delimiter | string | Delimitador para archivos CSV (opcional, por defecto: ",") |
| has_header | boolean | Indica si el archivo CSV tiene encabezado (opcional, por defecto: true) |

**Respuesta exitosa (201 Created):**

```json
{
  "success": true,
  "data": {
    "dataset": {
      "id": 3,
      "name": "Nuevo Dataset",
      "description": "Descripción del nuevo dataset",
      "file_path": "datasets/1/nuevo_dataset.csv",
      "file_type": "csv",
      "file_size": 768000,
      "row_count": 3500,
      "column_count": 12,
      "schema": {
        "columns": [
          {"name": "id", "type": "integer", "nullable": false},
          {"name": "nombre", "type": "string", "nullable": false},
          {"name": "email", "type": "string", "nullable": true},
          {"name": "fecha", "type": "date", "nullable": false},
          {"name": "valor", "type": "float", "nullable": false}
        ]
      },
      "created_at": "2023-08-13T14:25:30Z",
      "updated_at": "2023-08-13T14:25:30Z"
    }
  },
  "message": "Dataset cargado correctamente"
}
```

**Posibles errores:**

- `400 Bad Request`: Datos inválidos o archivo no proporcionado
- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para añadir datasets a este proyecto
- `404 Not Found`: Proyecto no encontrado
- `413 Payload Too Large`: El archivo excede el tamaño máximo permitido
- `415 Unsupported Media Type`: Formato de archivo no soportado
- `422 Unprocessable Entity`: El archivo no puede ser procesado (formato incorrecto, corrupto, etc.)

## Detalles de Dataset

Obtiene información detallada de un dataset específico.

**Endpoint:** `GET /api/datasets/{dataset_id}`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| dataset_id | integer | ID del dataset |

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "dataset": {
      "id": 1,
      "name": "Dataset de Ventas",
      "description": "Datos de ventas mensuales",
      "project_id": 1,
      "project_name": "Proyecto de Ejemplo",
      "file_path": "datasets/1/ventas.csv",
      "file_type": "csv",
      "file_size": 1024000,
      "row_count": 5000,
      "column_count": 15,
      "schema": {
        "columns": [
          {"name": "id", "type": "integer", "nullable": false},
          {"name": "fecha", "type": "date", "nullable": false},
          {"name": "producto", "type": "string", "nullable": false},
          {"name": "cantidad", "type": "integer", "nullable": false},
          {"name": "precio", "type": "float", "nullable": false},
          {"name": "total", "type": "float", "nullable": false},
          {"name": "cliente_id", "type": "integer", "nullable": true},
          {"name": "region", "type": "string", "nullable": false},
          {"name": "vendedor", "type": "string", "nullable": false},
          {"name": "canal", "type": "string", "nullable": false},
          {"name": "descuento", "type": "float", "nullable": true},
          {"name": "impuesto", "type": "float", "nullable": false},
          {"name": "costo", "type": "float", "nullable": true},
          {"name": "margen", "type": "float", "nullable": true},
          {"name": "comentarios", "type": "string", "nullable": true}
        ]
      },
      "statistics": {
        "numeric_columns": {
          "cantidad": {
            "min": 1,
            "max": 500,
            "mean": 45.32,
            "median": 30,
            "std": 65.78
          },
          "precio": {
            "min": 5.99,
            "max": 999.99,
            "mean": 125.45,
            "median": 89.99,
            "std": 150.23
          }
        },
        "categorical_columns": {
          "region": {
            "unique_values": 8,
            "most_common": [
              {"value": "Norte", "count": 1500},
              {"value": "Sur", "count": 1200},
              {"value": "Este", "count": 1000}
            ]
          },
          "canal": {
            "unique_values": 4,
            "most_common": [
              {"value": "Online", "count": 2500},
              {"value": "Tienda", "count": 1800},
              {"value": "Distribuidor", "count": 700}
            ]
          }
        }
      },
      "created_at": "2023-08-10T15:20:10Z",
      "updated_at": "2023-08-10T15:20:10Z",
      "evaluations_count": 3,
      "last_evaluation": {
        "id": 3,
        "status": "completed",
        "quality_score": 87.5,
        "completed_at": "2023-08-10T16:30:45Z"
      }
    }
  },
  "message": "Dataset obtenido correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para acceder a este dataset
- `404 Not Found`: Dataset no encontrado

## Vista Previa de Dataset

Obtiene una vista previa de los datos de un dataset específico.

**Endpoint:** `GET /api/datasets/{dataset_id}/preview`

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
| rows | integer | Número de filas a mostrar (por defecto: 10, máximo: 100) |
| columns | string | Lista de columnas separadas por comas (opcional) |

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "preview": {
      "columns": ["id", "fecha", "producto", "cantidad", "precio", "total", "region"],
      "rows": [
        [1, "2023-01-15", "Laptop", 2, 899.99, 1799.98, "Norte"],
        [2, "2023-01-15", "Monitor", 3, 249.99, 749.97, "Norte"],
        [3, "2023-01-16", "Teclado", 5, 49.99, 249.95, "Sur"],
        [4, "2023-01-16", "Mouse", 10, 29.99, 299.90, "Este"],
        [5, "2023-01-17", "Disco SSD", 8, 89.99, 719.92, "Oeste"],
        [6, "2023-01-17", "Memoria RAM", 15, 75.50, 1132.50, "Norte"],
        [7, "2023-01-18", "Tarjeta Gráfica", 1, 599.99, 599.99, "Sur"],
        [8, "2023-01-18", "Fuente de Poder", 4, 120.00, 480.00, "Este"],
        [9, "2023-01-19", "Gabinete", 3, 150.00, 450.00, "Oeste"],
        [10, "2023-01-19", "Webcam", 7, 45.99, 321.93, "Norte"]
      ],
      "total_rows": 5000
    }
  },
  "message": "Vista previa del dataset obtenida correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para acceder a este dataset
- `404 Not Found`: Dataset no encontrado

## Actualización de Dataset

Actualiza la información de un dataset existente.

**Endpoint:** `PUT /api/datasets/{dataset_id}`

**Encabezados:**

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| dataset_id | integer | ID del dataset |

**Cuerpo de la solicitud:**

```json
{
  "name": "Nombre Actualizado",
  "description": "Descripción actualizada del dataset"
}
```

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "dataset": {
      "id": 1,
      "name": "Nombre Actualizado",
      "description": "Descripción actualizada del dataset",
      "project_id": 1,
      "file_path": "datasets/1/ventas.csv",
      "file_type": "csv",
      "file_size": 1024000,
      "row_count": 5000,
      "column_count": 15,
      "created_at": "2023-08-10T15:20:10Z",
      "updated_at": "2023-08-13T15:45:30Z"
    }
  },
  "message": "Dataset actualizado correctamente"
}
```

**Posibles errores:**

- `400 Bad Request`: Datos de actualización inválidos
- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para modificar este dataset
- `404 Not Found`: Dataset no encontrado

## Eliminación de Dataset

Elimina un dataset específico y todos sus datos asociados.

**Endpoint:** `DELETE /api/datasets/{dataset_id}`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| dataset_id | integer | ID del dataset |

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "message": "Dataset eliminado correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para eliminar este dataset
- `404 Not Found`: Dataset no encontrado

## Exportación de Dataset

Exporta un dataset en diferentes formatos.

**Endpoint:** `GET /api/datasets/{dataset_id}/export`

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
| format | string | Formato de exportación (valores: csv, excel, json, parquet) |
| columns | string | Lista de columnas separadas por comas (opcional) |

**Respuesta exitosa (200 OK):**

La respuesta es un archivo descargable en el formato solicitado.

**Posibles errores:**

- `400 Bad Request`: Formato de exportación no válido
- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para exportar este dataset
- `404 Not Found`: Dataset no encontrado

## Estadísticas del Dataset

Obtiene estadísticas detalladas de un dataset específico.

**Endpoint:** `GET /api/datasets/{dataset_id}/statistics`

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
| columns | string | Lista de columnas separadas por comas (opcional) |

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "statistics": {
      "row_count": 5000,
      "column_count": 15,
      "missing_values": {
        "total": 320,
        "percentage": 0.43,
        "by_column": {
          "cliente_id": 150,
          "descuento": 75,
          "costo": 50,
          "margen": 45,
          "comentarios": 0
        }
      },
      "numeric_columns": {
        "cantidad": {
          "min": 1,
          "max": 500,
          "mean": 45.32,
          "median": 30,
          "std": 65.78,
          "q1": 10,
          "q3": 60,
          "outliers_count": 120
        },
        "precio": {
          "min": 5.99,
          "max": 999.99,
          "mean": 125.45,
          "median": 89.99,
          "std": 150.23,
          "q1": 49.99,
          "q3": 199.99,
          "outliers_count": 85
        },
        "total": {
          "min": 5.99,
          "max": 9999.90,
          "mean": 325.75,
          "median": 199.98,
          "std": 450.65,
          "q1": 89.99,
          "q3": 499.95,
          "outliers_count": 95
        }
      },
      "categorical_columns": {
        "region": {
          "unique_values": 8,
          "most_common": [
            {"value": "Norte", "count": 1500, "percentage": 30.0},
            {"value": "Sur", "count": 1200, "percentage": 24.0},
            {"value": "Este", "count": 1000, "percentage": 20.0},
            {"value": "Oeste", "count": 800, "percentage": 16.0},
            {"value": "Centro", "count": 500, "percentage": 10.0}
          ]
        },
        "canal": {
          "unique_values": 4,
          "most_common": [
            {"value": "Online", "count": 2500, "percentage": 50.0},
            {"value": "Tienda", "count": 1800, "percentage": 36.0},
            {"value": "Distribuidor", "count": 700, "percentage": 14.0}
          ]
        }
      },
      "temporal_columns": {
        "fecha": {
          "min": "2023-01-01",
          "max": "2023-06-30",
          "distribution": {
            "2023-01": 850,
            "2023-02": 780,
            "2023-03": 920,
            "2023-04": 850,
            "2023-05": 800,
            "2023-06": 800
          }
        }
      },
      "correlations": {
        "cantidad_precio": -0.15,
        "cantidad_total": 0.65,
        "precio_total": 0.85
      }
    }
  },
  "message": "Estadísticas del dataset obtenidas correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para acceder a este dataset
- `404 Not Found`: Dataset no encontrado

## Implementación en el Backend

A continuación se muestra un ejemplo de cómo están implementadas las rutas de datasets en el backend:

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import os
import pandas as pd

from extensions import db
from models.dataset import Dataset
from models.project import Project
from services.minio_service import MinioService
from services.dataset_service import DatasetService

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
    
    return jsonify({
        "success": True,
        "data": [dataset.to_dict() for dataset in datasets]
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
        db.session.add(new_dataset)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "data": new_dataset.to_dict()
        }), 201
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Server Error",
            "message": str(e)
        }), 500
```

### Notas de Implementación

1. **Conversión de ID de JWT**: Es importante notar que el ID de usuario almacenado en el token JWT es una cadena de texto (string), mientras que el ID del propietario del proyecto en la base de datos es un entero (integer). Por lo tanto, se debe realizar una conversión explícita antes de comparar estos valores:

```python
current_user_id = get_jwt_identity()  # String del token JWT
try:
    current_user_id_int = int(current_user_id)  # Conversión a entero
except (ValueError, TypeError):
    return jsonify({"error": "Invalid token"}), 401

# Ahora podemos comparar con el ID del propietario del proyecto
if project.owner_id != current_user_id_int:
    return jsonify({"error": "Unauthorized"}), 403
```

2. **Estructura de Blueprints**: La API utiliza dos blueprints separados para endpoints relacionados con datasets:
   - `datasets_bp` con prefijo `/datasets` para operaciones generales de datasets
   - `project_datasets_bp` con prefijo `/projects/<int:project_id>/datasets` para operaciones de datasets específicas de un proyecto
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
                    'message': 'No tiene permisos para añadir datasets a este proyecto'
                }
            }), 403
    
    # Verificar si se proporcionó un archivo
    if 'file' not in request.files:
        return jsonify({
            'success': False,
            'error': {
                'code': 'FILE_REQUIRED',
                'message': 'No se proporcionó ningún archivo'
            }
        }), 400
    
    file = request.files['file']
    
    # Verificar si el archivo tiene nombre
    if file.filename == '':
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_FILE',
                'message': 'Archivo sin nombre'
            }
        }), 400
    
    # Verificar nombre del dataset
    name = request.form.get('name')
    if not name:
        return jsonify({
            'success': False,
            'error': {
                'code': 'NAME_REQUIRED',
                'message': 'Se requiere un nombre para el dataset'
            }
        }), 400
    
    # Verificar formato del archivo
    filename = secure_filename(file.filename)
    file_extension = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    
    supported_extensions = {'csv', 'xlsx', 'xls', 'json', 'parquet'}
    if file_extension not in supported_extensions:
        return jsonify({
            'success': False,
            'error': {
                'code': 'UNSUPPORTED_FORMAT',
                'message': f'Formato de archivo no soportado. Formatos soportados: {", ".join(supported_extensions)}'
            }
        }), 415
    
    try:
        # Generar ruta única para el archivo
        file_path = f"datasets/{project_id}/{uuid.uuid4()}_{filename}"
        
        # Guardar archivo en almacenamiento
        storage_service.save_file(file, file_path)
        
        # Procesar dataset para extraer metadatos
        metadata = process_dataset(file_path, file_extension, 
                                  delimiter=request.form.get('delimiter', ','),
                                  has_header=request.form.get('has_header', 'true').lower() == 'true')
        
        # Crear registro de dataset en la base de datos
        new_dataset = Dataset(
            name=name,
            description=request.form.get('description', ''),
            project_id=project_id,
            file_path=file_path,
            file_type=file_extension,
            file_size=metadata['file_size'],
            row_count=metadata['row_count'],
            column_count=metadata['column_count'],
            schema=metadata['schema'],
            created_at=datetime.now(timezone.utc)
        )
        
        db.session.add(new_dataset)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': {
                'dataset': {
                    'id': new_dataset.id,
                    'name': new_dataset.name,
                    'description': new_dataset.description,
                    'file_path': new_dataset.file_path,
                    'file_type': new_dataset.file_type,
                    'file_size': new_dataset.file_size,
                    'row_count': new_dataset.row_count,
                    'column_count': new_dataset.column_count,
                    'schema': new_dataset.schema,
                    'created_at': new_dataset.created_at.isoformat(),
                    'updated_at': new_dataset.updated_at.isoformat() if new_dataset.updated_at else None
                }
            },
            'message': 'Dataset cargado correctamente'
        }), 201
        
    except Exception as e:
        # Manejar errores durante el procesamiento
        return jsonify({
            'success': False,
            'error': {
                'code': 'PROCESSING_ERROR',
                'message': f'Error al procesar el dataset: {str(e)}'
            }
        }), 422

# Implementaciones adicionales para GET, PUT, DELETE y otros endpoints...
```

Este módulo de datasets proporciona la funcionalidad básica para la gestión de datasets en la plataforma, permitiendo a los usuarios cargar, ver, actualizar y eliminar datasets, así como obtener estadísticas y vistas previas de los datos.
