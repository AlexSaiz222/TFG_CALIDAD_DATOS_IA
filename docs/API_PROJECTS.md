# Endpoints de Proyectos

Esta sección documenta los endpoints relacionados con la gestión de proyectos en la Plataforma de Evaluación de Calidad de Datos.

## Listado de Proyectos

Obtiene la lista de proyectos a los que tiene acceso el usuario autenticado.

**Endpoint:** `GET /api/projects`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Parámetros de consulta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| page | integer | Número de página (por defecto: 1) |
| per_page | integer | Elementos por página (por defecto: 10, máximo: 50) |
| sort | string | Campo y dirección de ordenación (ej. `name:asc`, `created_at:desc`) |
| filter | string | Filtro en formato `campo:operador:valor` (ej. `name:contains:calidad`) |

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": 1,
        "name": "Proyecto de Ejemplo",
        "description": "Descripción del proyecto",
        "owner_id": 1,
        "owner_username": "usuario_ejemplo",
        "datasets_count": 3,
        "created_at": "2023-08-10T14:30:45Z",
        "updated_at": "2023-08-12T09:15:22Z"
      },
      {
        "id": 2,
        "name": "Otro Proyecto",
        "description": "Descripción de otro proyecto",
        "owner_id": 1,
        "owner_username": "usuario_ejemplo",
        "datasets_count": 1,
        "created_at": "2023-08-11T10:20:30Z",
        "updated_at": "2023-08-11T10:20:30Z"
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 10,
      "total_items": 2,
      "total_pages": 1
    }
  },
  "message": "Proyectos obtenidos correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado

## Creación de Proyecto

Crea un nuevo proyecto asociado al usuario autenticado.

**Endpoint:** `POST /api/projects`

**Encabezados:**

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Cuerpo de la solicitud:**

```json
{
  "name": "Nuevo Proyecto",
  "description": "Descripción del nuevo proyecto"
}
```

**Respuesta exitosa (201 Created):**

```json
{
  "success": true,
  "data": {
    "project": {
      "id": 3,
      "name": "Nuevo Proyecto",
      "description": "Descripción del nuevo proyecto",
      "owner_id": 1,
      "owner_username": "usuario_ejemplo",
      "datasets_count": 0,
      "created_at": "2023-08-13T11:45:30Z",
      "updated_at": "2023-08-13T11:45:30Z"
    }
  },
  "message": "Proyecto creado correctamente"
}
```

**Posibles errores:**

- `400 Bad Request`: Datos de proyecto inválidos
- `401 Unauthorized`: Token de acceso inválido o expirado
- `409 Conflict`: Ya existe un proyecto con el mismo nombre para este usuario

## Detalles de Proyecto

Obtiene información detallada de un proyecto específico.

**Endpoint:** `GET /api/projects/{project_id}`

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
    "project": {
      "id": 1,
      "name": "Proyecto de Ejemplo",
      "description": "Descripción del proyecto",
      "owner_id": 1,
      "owner_username": "usuario_ejemplo",
      "datasets_count": 3,
      "created_at": "2023-08-10T14:30:45Z",
      "updated_at": "2023-08-12T09:15:22Z",
      "datasets": [
        {
          "id": 1,
          "name": "Dataset 1",
          "description": "Descripción del dataset 1",
          "file_path": "datasets/1/dataset1.csv",
          "file_size": 1024000,
          "row_count": 5000,
          "column_count": 15,
          "created_at": "2023-08-10T15:20:10Z"
        },
        {
          "id": 2,
          "name": "Dataset 2",
          "description": "Descripción del dataset 2",
          "file_path": "datasets/1/dataset2.csv",
          "file_size": 512000,
          "row_count": 2500,
          "column_count": 10,
          "created_at": "2023-08-11T09:45:30Z"
        },
        {
          "id": 3,
          "name": "Dataset 3",
          "description": "Descripción del dataset 3",
          "file_path": "datasets/1/dataset3.csv",
          "file_size": 768000,
          "row_count": 3500,
          "column_count": 12,
          "created_at": "2023-08-12T08:30:15Z"
        }
      ]
    }
  },
  "message": "Proyecto obtenido correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para acceder a este proyecto
- `404 Not Found`: Proyecto no encontrado

## Actualización de Proyecto

Actualiza la información de un proyecto existente.

**Endpoint:** `PUT /api/projects/{project_id}`

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
  "name": "Nombre Actualizado",
  "description": "Descripción actualizada del proyecto"
}
```

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "project": {
      "id": 1,
      "name": "Nombre Actualizado",
      "description": "Descripción actualizada del proyecto",
      "owner_id": 1,
      "owner_username": "usuario_ejemplo",
      "datasets_count": 3,
      "created_at": "2023-08-10T14:30:45Z",
      "updated_at": "2023-08-13T12:10:25Z"
    }
  },
  "message": "Proyecto actualizado correctamente"
}
```

**Posibles errores:**

- `400 Bad Request`: Datos de actualización inválidos
- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para modificar este proyecto
- `404 Not Found`: Proyecto no encontrado
- `409 Conflict`: Ya existe un proyecto con el mismo nombre para este usuario

## Eliminación de Proyecto

Elimina un proyecto y todos sus datasets y evaluaciones asociados.

**Endpoint:** `DELETE /api/projects/{project_id}`

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
  "message": "Proyecto eliminado correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para eliminar este proyecto
- `404 Not Found`: Proyecto no encontrado
- `500 Internal Server Error`: Error al eliminar el proyecto

### Implementación en el Backend

```python
@projects_bp.route('/<int:project_id>', methods=['DELETE'])
@jwt_required()
def delete_project(project_id):
    user_id = get_jwt_identity()
    
    # Buscar proyecto
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
        return jsonify({
            'success': False,
            'error': {
                'code': 'FORBIDDEN',
                'message': 'No tiene permisos para eliminar este proyecto'
            }
        }), 403
    
    try:
        # Eliminar datasets asociados
        for dataset in project.datasets:
            db.session.delete(dataset)
        
        # Eliminar evaluaciones asociadas
        evaluations = Evaluation.query.filter_by(project_id=project_id).all()
        for evaluation in evaluations:
            db.session.delete(evaluation)
        
        # Eliminar configuración de métricas
        metrics_config = ProjectMetricsConfig.query.filter_by(project_id=project_id).first()
        if metrics_config:
            db.session.delete(metrics_config)
        
        # Eliminar colaboradores
        collaborators = ProjectCollaborator.query.filter_by(project_id=project_id).all()
        for collaborator in collaborators:
            db.session.delete(collaborator)
        
        # Eliminar proyecto
        db.session.delete(project)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Proyecto eliminado correctamente'
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error al eliminar proyecto {project_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': {
                'code': 'DELETE_ERROR',
                'message': f"Error al eliminar el proyecto: {str(e)}"
            }
        }), 500
```

### Implementación en el Frontend

La interfaz de usuario para la eliminación de proyectos incluye:

1. Un botón "Delete" en la página de detalles del proyecto con el color rojo (#E5484D) para acciones destructivas
2. Un diálogo de confirmación que advierte sobre la eliminación de todos los datasets y evaluaciones asociados
3. Manejo de estados de carga y errores durante el proceso
4. Redirección a la lista de proyectos tras una eliminación exitosa

```typescript
// Función para eliminar un proyecto
const deleteProject = async () => {
  setError(null); // Limpiar errores previos
  setDeleting(true);
  
  try {
    const response = await api.delete(`/api/projects/${project.id}`);
    
    if (response.data.success) {
      setDeleting(false);
      setShowDeleteDialog(false);
      toast.success("Proyecto eliminado correctamente");
      router.push('/projects');
    } else {
      setError(response.data.error?.message || "Error al eliminar el proyecto");
      setDeleting(false);
    }
  } catch (err: any) {
    setError(err.response?.data?.error?.message || err.message || "Error al eliminar el proyecto");
    setDeleting(false);
  }
};
```

## Colaboradores del Proyecto

### Listar Colaboradores

Obtiene la lista de colaboradores de un proyecto.

**Endpoint:** `GET /api/projects/{project_id}/collaborators`

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
    "collaborators": [
      {
        "user_id": 2,
        "username": "colaborador1",
        "email": "colaborador1@ejemplo.com",
        "first_name": "Nombre",
        "last_name": "Apellido",
        "role": "editor",
        "added_at": "2023-08-11T14:30:45Z"
      },
      {
        "user_id": 3,
        "username": "colaborador2",
        "email": "colaborador2@ejemplo.com",
        "first_name": "Otro",
        "last_name": "Usuario",
        "role": "viewer",
        "added_at": "2023-08-12T09:15:22Z"
      }
    ]
  },
  "message": "Colaboradores obtenidos correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para ver los colaboradores de este proyecto
- `404 Not Found`: Proyecto no encontrado

### Añadir Colaborador

Añade un nuevo colaborador al proyecto.

**Endpoint:** `POST /api/projects/{project_id}/collaborators`

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
  "username": "nuevo_colaborador",
  "role": "editor"  // Valores posibles: "editor", "viewer"
}
```

**Respuesta exitosa (201 Created):**

```json
{
  "success": true,
  "data": {
    "collaborator": {
      "user_id": 4,
      "username": "nuevo_colaborador",
      "email": "nuevo@ejemplo.com",
      "first_name": "Nuevo",
      "last_name": "Colaborador",
      "role": "editor",
      "added_at": "2023-08-13T12:45:30Z"
    }
  },
  "message": "Colaborador añadido correctamente"
}
```

**Posibles errores:**

- `400 Bad Request`: Datos inválidos o usuario no encontrado
- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para añadir colaboradores a este proyecto
- `404 Not Found`: Proyecto no encontrado
- `409 Conflict`: El usuario ya es colaborador del proyecto

### Actualizar Rol de Colaborador

Actualiza el rol de un colaborador existente.

**Endpoint:** `PUT /api/projects/{project_id}/collaborators/{user_id}`

**Encabezados:**

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| project_id | integer | ID del proyecto |
| user_id | integer | ID del usuario colaborador |

**Cuerpo de la solicitud:**

```json
{
  "role": "viewer"  // Valores posibles: "editor", "viewer"
}
```

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "data": {
    "collaborator": {
      "user_id": 2,
      "username": "colaborador1",
      "email": "colaborador1@ejemplo.com",
      "first_name": "Nombre",
      "last_name": "Apellido",
      "role": "viewer",
      "added_at": "2023-08-11T14:30:45Z",
      "updated_at": "2023-08-13T13:10:20Z"
    }
  },
  "message": "Rol de colaborador actualizado correctamente"
}
```

**Posibles errores:**

- `400 Bad Request`: Datos inválidos
- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para modificar colaboradores de este proyecto
- `404 Not Found`: Proyecto o colaborador no encontrado

### Eliminar Colaborador

Elimina un colaborador del proyecto.

**Endpoint:** `DELETE /api/projects/{project_id}/collaborators/{user_id}`

**Encabezados:**

```
Authorization: Bearer <access_token>
```

**Parámetros de ruta:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| project_id | integer | ID del proyecto |
| user_id | integer | ID del usuario colaborador |

**Respuesta exitosa (200 OK):**

```json
{
  "success": true,
  "message": "Colaborador eliminado correctamente"
}
```

**Posibles errores:**

- `401 Unauthorized`: Token de acceso inválido o expirado
- `403 Forbidden`: No tiene permisos para eliminar colaboradores de este proyecto
- `404 Not Found`: Proyecto o colaborador no encontrado

## Implementación en el Backend

A continuación se muestra un ejemplo de cómo están implementadas las rutas de proyectos en el backend:

```python
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timezone

from models.project import Project
from models.user import User
from models.collaborator import ProjectCollaborator
from extensions import db

projects_bp = Blueprint('projects', __name__)

@projects_bp.route('', methods=['GET'])
@jwt_required()
def get_projects():
    user_id = get_jwt_identity()
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 10, type=int), 50)
    
    # Obtener proyectos propios y colaboraciones
    owned_projects = Project.query.filter_by(owner_id=user_id)
    
    collaborations = db.session.query(Project).join(
        ProjectCollaborator, ProjectCollaborator.project_id == Project.id
    ).filter(ProjectCollaborator.user_id == user_id)
    
    # Combinar resultados
    projects_query = owned_projects.union(collaborations)
    
    # Aplicar ordenación
    sort_param = request.args.get('sort', 'created_at:desc')
    if sort_param:
        field, direction = sort_param.split(':')
        if direction == 'desc':
            projects_query = projects_query.order_by(db.desc(getattr(Project, field)))
        else:
            projects_query = projects_query.order_by(getattr(Project, field))
    
    # Aplicar paginación
    paginated = projects_query.paginate(page=page, per_page=per_page)
    
    # Formatear resultados
    projects = []
    for project in paginated.items:
        owner = User.query.get(project.owner_id)
        projects.append({
            'id': project.id,
            'name': project.name,
            'description': project.description,
            'owner_id': project.owner_id,
            'owner_username': owner.username if owner else None,
            'datasets_count': len(project.datasets),
            'created_at': project.created_at.isoformat(),
            'updated_at': project.updated_at.isoformat() if project.updated_at else None
        })
    
    return jsonify({
        'success': True,
        'data': {
            'projects': projects,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total_items': paginated.total,
                'total_pages': paginated.pages
            }
        },
        'message': 'Proyectos obtenidos correctamente'
    }), 200

@projects_bp.route('', methods=['POST'])
@jwt_required()
def create_project():
    user_id = get_jwt_identity()
    data = request.get_json()
    
    # Validación de datos
    if not data or not data.get('name'):
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_DATA',
                'message': 'Se requiere un nombre para el proyecto'
            }
        }), 400
    
    # Verificar si ya existe un proyecto con el mismo nombre para este usuario
    existing_project = Project.query.filter_by(owner_id=user_id, name=data['name']).first()
    if existing_project:
        return jsonify({
            'success': False,
            'error': {
                'code': 'PROJECT_EXISTS',
                'message': 'Ya existe un proyecto con este nombre'
            }
        }), 409
    
    # Crear nuevo proyecto
    new_project = Project(
        name=data['name'],
        description=data.get('description', ''),
        owner_id=user_id,
        created_at=datetime.now(timezone.utc)
    )
    
    db.session.add(new_project)
    db.session.commit()
    
    # Obtener información del propietario
    owner = User.query.get(user_id)
    
    return jsonify({
        'success': True,
        'data': {
            'project': {
                'id': new_project.id,
                'name': new_project.name,
                'description': new_project.description,
                'owner_id': new_project.owner_id,
                'owner_username': owner.username if owner else None,
                'datasets_count': 0,
                'created_at': new_project.created_at.isoformat(),
                'updated_at': new_project.updated_at.isoformat() if new_project.updated_at else None
            }
        },
        'message': 'Proyecto creado correctamente'
    }), 201

@projects_bp.route('/<int:project_id>', methods=['GET'])
@jwt_required()
def get_project(project_id):
    user_id = get_jwt_identity()
    
    # Buscar proyecto
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
    
    # Obtener información del propietario
    owner = User.query.get(project.owner_id)
    
    # Formatear datasets
    datasets = []
    for dataset in project.datasets:
        datasets.append({
            'id': dataset.id,
            'name': dataset.name,
            'description': dataset.description,
            'file_path': dataset.file_path,
            'file_size': dataset.file_size,
            'row_count': dataset.row_count,
            'column_count': dataset.column_count,
            'created_at': dataset.created_at.isoformat()
        })
    
    return jsonify({
        'success': True,
        'data': {
            'project': {
                'id': project.id,
                'name': project.name,
                'description': project.description,
                'owner_id': project.owner_id,
                'owner_username': owner.username if owner else None,
                'datasets_count': len(project.datasets),
                'created_at': project.created_at.isoformat(),
                'updated_at': project.updated_at.isoformat() if project.updated_at else None,
                'datasets': datasets
            }
        },
        'message': 'Proyecto obtenido correctamente'
    }), 200

# Implementaciones adicionales para PUT, DELETE y endpoints de colaboradores...
```

Este módulo de proyectos proporciona la funcionalidad básica para la gestión de proyectos en la plataforma, permitiendo a los usuarios crear, ver, actualizar y eliminar proyectos, así como gestionar colaboradores para trabajar en equipo.
