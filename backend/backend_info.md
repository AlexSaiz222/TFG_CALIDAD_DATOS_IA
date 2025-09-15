# Documentación del Backend - Plataforma de Evaluación de Calidad de Datos para IA

## Índice
1. [Introducción](#introducción)
2. [Arquitectura General](#arquitectura-general)
3. [Estructura de Directorios](#estructura-de-directorios)
4. [Configuración](#configuración)
5. [Modelos de Datos](#modelos-de-datos)
6. [API REST](#api-rest)
7. [Servicios](#servicios)
8. [Middleware](#middleware)
9. [Sistema de Tareas Asíncronas](#sistema-de-tareas-asíncronas)
10. [Almacenamiento de Archivos](#almacenamiento-de-archivos)
11. [Flujo de Trabajo](#flujo-de-trabajo)
12. [Guía de Desarrollo](#guía-de-desarrollo)

## Introducción

La Plataforma de Evaluación de Calidad de Datos para IA es una aplicación diseñada para evaluar y mejorar la calidad de los conjuntos de datos utilizados en proyectos de Inteligencia Artificial. El backend está construido con Flask, un framework web ligero para Python, y utiliza una arquitectura modular para facilitar el mantenimiento y la extensibilidad.

### Objetivos del Sistema

- Proporcionar herramientas para evaluar la calidad de los datos
- Detectar problemas en los conjuntos de datos
- Ofrecer métricas y visualizaciones para entender la calidad de los datos
- Permitir la gestión de proyectos y conjuntos de datos
- Facilitar la colaboración entre equipos

## Arquitectura General

El backend sigue una arquitectura de capas:

1. **Capa de Presentación**: API REST implementada con Flask
2. **Capa de Lógica de Negocio**: Servicios que implementan la lógica principal
3. **Capa de Acceso a Datos**: Modelos SQLAlchemy y servicios de almacenamiento
4. **Infraestructura**: Base de datos PostgreSQL, MinIO para almacenamiento de archivos, Redis para tareas asíncronas

### Componentes Principales

- **Flask**: Framework web para la API REST
- **SQLAlchemy**: ORM para interactuar con la base de datos
- **Celery**: Sistema de tareas asíncronas
- **MinIO**: Almacenamiento de objetos compatible con S3
- **Redis**: Broker de mensajes para Celery y caché
- **Pandas/NumPy**: Procesamiento de datos y análisis estadístico

## Estructura de Directorios

```
backend/
├── api/                    # Endpoints de la API REST
│   ├── admin/              # Rutas administrativas
│   ├── auth/               # Autenticación y gestión de usuarios
│   ├── datasets/           # Gestión de conjuntos de datos
│   ├── evaluations/        # Evaluaciones de calidad
│   ├── metrics/            # Métricas y plantillas
│   ├── projects/           # Gestión de proyectos
│   └── routes.py           # Registro de rutas
├── config/                 # Configuración
│   ├── __init__.py
│   └── logging_config.py   # Configuración de logging
├── middleware/             # Middleware
│   ├── __init__.py
│   ├── error_handlers.py   # Manejo centralizado de errores
│   ├── performance_monitor.py # Monitoreo de rendimiento
│   └── request_middleware.py # Procesamiento de solicitudes
├── migrations/             # Migraciones de base de datos
├── models/                 # Modelos de datos
│   ├── dataset.py
│   ├── evaluation.py
│   ├── metric.py
│   ├── project.py
│   └── user.py
├── schemas/                # Esquemas de validación
├── scripts/                # Scripts utilitarios
├── services/               # Servicios de negocio
│   ├── dataset_service.py  # Servicio de datasets
│   ├── evaluation_service.py # Servicio de evaluaciones
│   ├── export_service.py   # Servicio de exportación
│   └── minio_service.py    # Servicio de almacenamiento
├── tasks/                  # Tareas asíncronas
│   ├── __init__.py
│   └── evaluation_tasks.py # Tareas de evaluación
├── app.py                  # Punto de entrada principal
├── celery_app.py           # Configuración de Celery
├── config_module.py        # Configuración de la aplicación
├── extensions.py           # Extensiones de Flask
└── requirements.txt        # Dependencias
```

## Configuración

### Archivos de Configuración

- **config_module.py**: Define las clases de configuración para diferentes entornos (desarrollo, pruebas, producción)
- **.env**: Almacena variables de entorno (no incluido en el repositorio)

### Clases de Configuración

- **Config**: Configuración base
- **DevelopmentConfig**: Configuración para desarrollo
- **TestingConfig**: Configuración para pruebas
- **ProductionConfig**: Configuración para producción

### Variables de Entorno Principales

- `FLASK_ENV`: Entorno de ejecución (development, testing, production)
- `SECRET_KEY`: Clave secreta para Flask
- `DATABASE_URL`: URL de conexión a la base de datos
- `MINIO_URL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`: Configuración de MinIO
- `REDIS_URL`: URL de conexión a Redis
- `JWT_SECRET_KEY`: Clave para tokens JWT

## Modelos de Datos

### Diagrama de Entidad-Relación

```
User 1--N Project 1--N Dataset 1--N Evaluation 1--N Issue
                                    |
                                    N
                                    |
                                  Metric
```

### Modelos Principales

#### User
Representa a los usuarios del sistema.
- **Campos**: id, username, email, password_hash, first_name, last_name, organization, role
- **Relaciones**: projects (1:N)

#### Project
Representa un proyecto que puede contener múltiples conjuntos de datos.
- **Campos**: id, name, description, owner_id, metrics_config, created_at, updated_at
- **Relaciones**: datasets (1:N), owner (N:1 con User)

#### Dataset
Representa un conjunto de datos cargado en el sistema.
- **Campos**: id, name, description, project_id, file_path, file_size, row_count, column_count, schema
- **Relaciones**: project (N:1), evaluations (1:N)

#### Evaluation
Representa una evaluación de calidad realizada sobre un conjunto de datos.
- **Campos**: id, dataset_id, status, metrics_config, results, quality_score, started_at, completed_at
- **Relaciones**: dataset (N:1), issues (1:N)

#### Issue
Representa un problema detectado durante una evaluación.
- **Campos**: id, evaluation_id, metric_id, severity, description, affected_columns, affected_rows
- **Relaciones**: evaluation (N:1), metric (N:1)

#### Metric
Representa una métrica de calidad de datos.
- **Campos**: id, name, description, category, parameters
- **Relaciones**: issues (1:N)

## API REST

### Estructura de Endpoints

- **/api/auth/**: Autenticación y gestión de usuarios
- **/api/projects/**: Gestión de proyectos
- **/api/datasets/**: Gestión de conjuntos de datos
- **/api/metrics/**: Gestión de métricas y plantillas
- **/api/evaluations/**: Gestión de evaluaciones

### Endpoints Principales

#### Autenticación
- `POST /api/auth/register`: Registro de nuevos usuarios
- `POST /api/auth/login`: Inicio de sesión
- `POST /api/auth/refresh`: Renovación de token JWT
- `GET /api/auth/me`: Obtener perfil del usuario actual

#### Proyectos
- `GET /api/projects`: Listar proyectos
- `POST /api/projects`: Crear nuevo proyecto
- `GET /api/projects/{id}`: Obtener detalles de un proyecto
- `PUT /api/projects/{id}`: Actualizar proyecto
- `DELETE /api/projects/{id}`: Eliminar proyecto

#### Datasets
- `GET /api/projects/{project_id}/datasets`: Listar datasets de un proyecto
- `POST /api/projects/{project_id}/datasets`: Crear nuevo dataset
- `GET /api/datasets/{id}`: Obtener detalles de un dataset
- `DELETE /api/datasets/{id}`: Eliminar dataset

#### Métricas
- `GET /api/metrics`: Listar métricas disponibles
- `GET /api/metrics/templates`: Listar plantillas de métricas
- `POST /api/metrics/templates`: Crear nueva plantilla
- `GET /api/metrics/templates/{id}`: Obtener plantilla
- `PUT /api/metrics/templates/{id}`: Actualizar plantilla
- `DELETE /api/metrics/templates/{id}`: Eliminar plantilla

#### Evaluaciones
- `POST /api/datasets/{dataset_id}/evaluations`: Crear nueva evaluación
- `GET /api/evaluations/{id}`: Obtener detalles de una evaluación
- `GET /api/evaluations/{id}/issues`: Obtener problemas detectados

### Formato de Respuesta

Todas las respuestas siguen un formato estándar:

```json
{
  "success": true|false,
  "data": {...},  // Datos de respuesta (si success es true)
  "error": "...",  // Tipo de error (si success es false)
  "message": "..."  // Mensaje descriptivo
}
```

## Servicios

Los servicios implementan la lógica de negocio principal de la aplicación.

### DatasetService

Gestiona la carga, procesamiento y análisis de conjuntos de datos.

**Funcionalidades principales**:
- Carga de archivos (CSV, Excel, JSON, Parquet)
- Extracción de metadatos (esquema, estadísticas)
- Validación de datos
- Exportación de datos

### EvaluationService

Implementa la lógica para evaluar la calidad de los datos.

**Funcionalidades principales**:
- Ejecución de métricas de calidad
- Cálculo de puntuación de calidad
- Detección de problemas (valores nulos, duplicados, outliers)
- Generación de estadísticas y visualizaciones

### MinioService

Gestiona el almacenamiento de archivos en MinIO.

**Funcionalidades principales**:
- Carga de archivos
- Descarga de archivos
- Generación de URLs presignadas
- Gestión de buckets

### ExportService

Gestiona la exportación de datos y resultados.

**Funcionalidades principales**:
- Exportación de datasets
- Exportación de resultados de evaluación
- Generación de informes

## Middleware

### ErrorHandlers

Proporciona manejo centralizado de errores para la API.

**Funcionalidades**:
- Captura de excepciones HTTP
- Captura de errores de base de datos
- Formato estándar para respuestas de error
- Logging de errores

### PerformanceMonitor

Monitorea el rendimiento de la aplicación.

**Funcionalidades**:
- Medición de tiempos de respuesta
- Detección de solicitudes lentas
- Logging de métricas de rendimiento

### RequestMiddleware

Procesa las solicitudes HTTP.

**Funcionalidades**:
- Asignación de ID único a cada solicitud
- Logging de solicitudes
- Validación de encabezados

## Sistema de Tareas Asíncronas

### Celery

Se utiliza Celery para ejecutar tareas de larga duración de forma asíncrona.

**Configuración**:
- Broker: Redis
- Backend: Redis
- Tareas incluidas: evaluation_tasks

### Tareas Principales

#### EvaluationTask

Ejecuta evaluaciones de calidad de datos de forma asíncrona.

**Funcionalidades**:
- Ejecución de métricas configuradas
- Actualización de progreso
- Manejo de errores
- Notificación de resultados

## Almacenamiento de Archivos

### MinIO

Se utiliza MinIO como sistema de almacenamiento de objetos compatible con S3.

**Configuración**:
- Endpoint: Definido en variables de entorno
- Credenciales: Access Key y Secret Key
- Bucket: 'datasets' por defecto

### Estructura de Almacenamiento

```
datasets/
├── project_{id}/
│   └── dataset_{id}/
│       └── data.csv
```

## Flujo de Trabajo

### Carga de Datos

1. El usuario crea un proyecto
2. El usuario carga un dataset al proyecto
3. El sistema procesa el archivo y extrae metadatos
4. El archivo se almacena en MinIO
5. Los metadatos se guardan en la base de datos

### Evaluación de Calidad

1. El usuario configura métricas para un dataset
2. El usuario inicia una evaluación
3. El sistema crea una tarea asíncrona
4. La tarea descarga el dataset de MinIO
5. La tarea ejecuta las métricas configuradas
6. Los resultados se guardan en la base de datos
7. El usuario puede ver los resultados y problemas detectados

## Guía de Desarrollo

### Requisitos

- Python 3.8+
- PostgreSQL 12+
- Redis 6+
- MinIO

### Instalación

1. Clonar el repositorio
2. Crear un entorno virtual: `python -m venv venv`
3. Activar el entorno virtual: `source venv/bin/activate` (Linux/Mac) o `venv\Scripts\activate` (Windows)
4. Instalar dependencias: `pip install -r requirements.txt`
5. Configurar variables de entorno en `.env`
6. Inicializar la base de datos: `flask db upgrade`
7. Ejecutar la aplicación: `flask run`

### Ejecución con Docker

```bash
docker-compose up -d
```

### Desarrollo de Nuevas Funcionalidades

1. Crear una rama para la nueva funcionalidad
2. Implementar la funcionalidad
3. Escribir pruebas
4. Actualizar la documentación
5. Crear un pull request

### Convenciones de Código

- Usar docstrings para documentar funciones y clases
- Mantener la estructura modular del proyecto
- Implementar manejo de errores adecuado
