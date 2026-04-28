# Documentación del Backend - Plataforma de Evaluación de Calidad de Datos para IA

## Índice
1. [Arquitectura General](#arquitectura-general)
2. [Estructura de Directorios](#estructura-de-directorios)
3. [Configuración](#configuración)
4. [Modelos de Datos](#modelos-de-datos)
5. [API REST](#api-rest)
6. [Servicios](#servicios)
7. [Sistema de Tareas Asíncronas](#sistema-de-tareas-asíncronas)
8. [Middleware](#middleware)
9. [Almacenamiento de Archivos](#almacenamiento-de-archivos)
10. [Flujo de Trabajo](#flujo-de-trabajo)

---

## Arquitectura General

El backend sigue una arquitectura de capas:

1. **Capa de Presentación**: API REST implementada con Flask (blueprints por dominio)
2. **Capa de Lógica de Negocio**: Servicios que implementan la lógica principal
3. **Capa de Acceso a Datos**: Modelos SQLAlchemy y servicios de almacenamiento
4. **Infraestructura**: PostgreSQL, MinIO, Redis/Celery

### Componentes Principales

- **Flask**: Framework web para la API REST
- **SQLAlchemy + Flask-Migrate**: ORM y migraciones de base de datos
- **Celery**: Tareas asíncronas (evaluaciones)
- **MinIO**: Almacenamiento de objetos compatible con S3
- **Redis**: Broker de mensajes para Celery y caché
- **Pandas/NumPy**: Procesamiento y análisis estadístico de datasets

---

## Estructura de Directorios

```
backend/
├── api/                        # Blueprints de la API REST
│   ├── admin/routes.py         # Utilidades administrativas
│   ├── auth/routes.py          # Autenticación JWT (login, registro, refresh)
│   ├── dashboard/routes.py     # Resumen del dashboard (runs, tendencias)
│   ├── datasets/routes.py      # Gestión de datasets y versioning
│   ├── evaluations/routes.py   # Evaluaciones (sistema legacy)
│   ├── metrics/routes.py       # Métricas y plantillas
│   ├── patterns/routes.py      # CRUD de ValidationPattern (patrones regex de usuario)
│   ├── projects/routes.py      # Proyectos CRUD + config de métricas
│   └── routes.py               # Registro central de blueprints (10 blueprints)
├── config/
│   └── logging_config.py       # Configuración de logging
├── middleware/
│   ├── error_handlers.py       # Manejo centralizado de errores HTTP
│   ├── performance_monitor.py  # Monitoreo de tiempos de respuesta
│   └── request_middleware.py   # Logging de solicitudes y request IDs
├── migrations/                 # Alembic / Flask-Migrate
├── models/
│   ├── analysis.py             # AnalysisRun, QualityGate, DataQualityIssue (Sonar-Lite)
│   ├── dataset.py              # Dataset con versioning y sensitive_columns
│   ├── evaluation.py           # Evaluation, EvaluationRun (sistema legacy)
│   ├── metric.py               # Metric
│   ├── project.py              # Project
│   ├── user.py                 # User
│   └── validation_pattern.py   # ValidationPattern (patrones regex de sistema y usuario)
├── services/
│   ├── dataset_service.py      # Carga, procesamiento y análisis de datasets
│   ├── evaluation_service.py   # Lógica de evaluación (legacy)
│   ├── hybrid_evaluation_service.py  # Servicio que orquesta AnalysisRun + Celery
│   ├── export_service.py       # Exportación de datasets y resultados
│   ├── minio_service.py        # Operaciones sobre MinIO
│   └── metrics/                # Implementaciones de métricas individuales
│       ├── base.py             # BaseMetric: severidad, histograma, null-patterns
│       ├── registry.py         # Registro automático de métricas disponibles
│       ├── class_balance.py    # Métrica: balance de clases
│       ├── completeness.py     # Métrica: completitud
│       ├── currentness.py      # Métrica: actualidad
│       ├── logical_consistency.py  # Métrica: consistencia lógica
│       ├── outliers.py         # Métrica: detección de outliers (solo profiling)
│       ├── syntactic_accuracy.py   # Métrica: precisión sintáctica
│       └── uniqueness.py       # Métrica: unicidad
├── tasks/
│   └── evaluation_tasks.py     # Tareas Celery para ejecución asíncrona
├── tests/                      # Tests unitarios e integración
├── app.py                      # Punto de entrada principal
├── celery_app.py               # Configuración de Celery
├── config_module.py            # Clases de configuración (Dev/Test/Prod)
└── extensions.py               # Extensiones de Flask (db, jwt, etc.)
```

---

## Configuración

### Variables de Entorno (backend/.env)

| Variable | Descripción |
|---|---|
| `FLASK_APP` | Punto de entrada (`app.py`) |
| `FLASK_ENV` | Entorno: `development`, `testing`, `production` |
| `SECRET_KEY` | Clave secreta Flask |
| `DATABASE_URL` | URL de conexión PostgreSQL |
| `JWT_SECRET_KEY` | Clave para tokens JWT |
| `JWT_ACCESS_TOKEN_EXPIRES` | Expiración del access token (segundos) |
| `JWT_REFRESH_TOKEN_EXPIRES` | Expiración del refresh token (segundos) |
| `MINIO_URL` | Endpoint MinIO |
| `MINIO_ACCESS_KEY` | Credencial MinIO |
| `MINIO_SECRET_KEY` | Credencial MinIO |
| `MINIO_BUCKET` | Nombre del bucket (`datasets` por defecto) |
| `MINIO_SECURE` | `true`/`false` para TLS |
| `REDIS_URL` | URL de Redis |
| `CORS_ORIGINS` | Orígenes permitidos para CORS |

---

## Modelos de Datos

### Diagrama de relaciones

```
User 1──N Project 1──N Dataset 1──N Evaluation (legacy)
     |            |             └──N AnalysisRun ──N DataQualityIssue
     |            |
     |            └──1 QualityGate
     |            └──N Metric
     └──N ValidationPattern (sistema: owner_id = NULL; usuario: owner_id = user.id)
```

Dataset tiene auto-referencia para versioning: `parent_dataset_id → datasets.id`

AnalysisRun tiene auto-referencia para baseline: `baseline_analysis_id → analysis_runs.id`

---

### User
- **Campos**: id, username, email, password_hash, first_name, last_name, organization, role
- **Relaciones**: projects (1:N)

### Project
- **Campos**: id, name, description, owner_id, metrics_config (JSONB), created_at, updated_at
- **Relaciones**: datasets (1:N), quality_gate (1:1), owner (N:1 con User)

### Dataset
- **Campos**: id, name, description, project_id, file_path, file_size, row_count, column_count, schema (JSON)
- **Versioning**: parent_dataset_id, version (int), version_tag, is_latest (bool)
- **Privacidad**: sensitive_columns (JSONB — lista de nombres de columna)
- **Relaciones**: evaluations (1:N), analysis_runs (1:N), parent / versions (auto-ref)

### Evaluation / EvaluationRun *(sistema legacy)*
- Representan evaluaciones del sistema anterior
- **Evaluation**: id, dataset_id, status, metrics_config, results, quality_score, started_at, completed_at
- **EvaluationRun**: subdivisión de una Evaluation por métrica

### AnalysisRun *(Sonar-Lite — sistema actual)*
Snapshot inmutable de una ejecución de análisis sobre un proyecto.

- **Campos clave**: id, project_id, dataset_id, status (PENDING/RUNNING/COMPLETED/FAILED)
- **Veredicto**: quality_gate_status (PASSED/WARNING/FAILED)
- **Métricas resumen**: quality_score (0-100), critical_issues_count, total_issues_count
- **Diff vs baseline**: baseline_analysis_id, new_issues_count, fixed_issues_count
- **Async**: task_id, progress (0-100), current_step, error_message
- **Relaciones**: issues (1:N DataQualityIssue), baseline (auto-ref)

### QualityGate
Configuración de umbrales de calidad por proyecto (uno por proyecto).

- **Campos**: id, project_id (unique), name, thresholds (JSON), is_active
- **Umbrales por defecto**: `{"min_score": 70, "max_critical_issues": 0, "max_new_issues": 10}`

### DataQualityIssue
Issue individual detectado en un AnalysisRun.

- **Campos**: id, analysis_run_id, metric_id, fingerprint (hash para tracking entre runs)
- **Tipo/severidad**: issue_type, severity (critical/major/minor/info)
- **Contexto**: description, affected_columns (JSON), affected_rows (JSON), affected_row_count, affected_rows_pct
- **Tracking**: is_new (bool), rule_key, actual_value, expected_value

### ValidationPattern
Patrón regex de validación para la métrica de precisión sintáctica.

- **Campos**: id, key, name, description, regex, examples_valid (JSON), examples_invalid (JSON)
- **Propiedad**: owner_id (NULL = patrón de sistema/built-in; user.id = patrón de usuario)
- **Flags**: is_system (bool), created_at, updated_at
- **Restricción**: UNIQUE (owner_id, key) — clave única por propietario
- Los patrones de sistema se sembian con Alembic y no pueden editarse ni borrarse desde la API.
- Los patrones de usuario pueden sobreescribir la regex de un built-in compartiendo el mismo `key`.

---

## API REST

### Blueprints registrados

| Prefijo | Blueprint | Descripción |
|---|---|---|
| `/api/auth` | auth | Registro, login, token refresh, perfil |
| `/api/projects` | projects | CRUD proyectos + config métricas |
| `/api/datasets` | datasets | Carga, versioning, profiling, sensitive cols, columns |
| `/api/metrics` | metrics | Métricas disponibles + plantillas |
| `/api/evaluations` | evaluations | Evaluaciones legacy |
| `/api/dashboard` | dashboard | Resumen de runs y tendencias |
| `/api/admin` | admin | Utilidades administrativas |
| `/api/patterns` | patterns | CRUD de patrones regex de usuario |
| `/health` | — | Health check (`{"status": "ok"}`) |

### Endpoints principales

#### Autenticación
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`

#### Proyectos
- `GET/POST /api/projects`
- `GET/PUT/DELETE /api/projects/{id}`
- `GET/PUT /api/projects/{id}/metrics` — configuración de métricas
- `GET/PUT /api/projects/{id}/quality-gate` — configuración del Quality Gate

#### Datasets
- `GET/POST /api/projects/{project_id}/datasets`
- `GET/DELETE /api/datasets/{id}`
- `POST /api/datasets/{id}/version` — crear nueva versión
- `GET /api/datasets/{id}/versions` — historial de versiones
- `GET /api/datasets/{id}/profile` — perfil estadístico (EDA)
- `PUT /api/datasets/{id}/sensitive-columns` — marcar columnas sensibles
- `GET /api/datasets/{id}/columns` — lista de columnas del esquema almacenado (sin descargar el fichero)

#### Patrones de validación
- `GET /api/patterns/` — listar patrones de sistema + propios del usuario
- `POST /api/patterns/` — crear patrón personalizado
- `PUT /api/patterns/{id}` — editar patrón propio (los de sistema son inmutables)
- `DELETE /api/patterns/{id}` — eliminar patrón propio

#### Analysis Runs (Sonar-Lite)
- `POST /api/projects/{id}/analyze` — lanzar nuevo AnalysisRun
- `GET /api/projects/{id}/runs` — listar runs del proyecto
- `GET /api/projects/{id}/runs/{run_id}` — detalle de un run
- `GET /api/projects/{id}/runs/{run_id}/issues` — issues de un run

#### Dashboard
- `GET /api/dashboard/summary` — resumen global de actividad

#### Evaluaciones (legacy)
- `POST /api/datasets/{dataset_id}/evaluations`
- `GET /api/evaluations/{id}`
- `GET /api/evaluations/{id}/issues`

### Formato estándar de respuesta

```json
{
  "success": true,
  "data": { ... },
  "message": "..."
}
```

En caso de error:
```json
{
  "success": false,
  "error": "tipo_error",
  "message": "descripción del error"
}
```

---

## Servicios

### DatasetService
- Carga de archivos (CSV, Excel, JSON, Parquet)
- Extracción de metadatos (esquema, estadísticas)
- Lógica de versioning (creación de nuevas versiones, cadena parent→child)
- Profiling/EDA estadístico

### EvaluationService *(legacy)*
- Ejecución de métricas sobre un dataset
- Cálculo de puntuación de calidad
- Detección y almacenamiento de issues

### HybridEvaluationService *(Sonar-Lite)*
- Orquesta la creación de un `AnalysisRun`
- Delega la ejecución pesada a Celery
- Evalúa el `QualityGate` al finalizar y persiste el veredicto
- Calcula diff vs baseline (new/fixed issues usando fingerprints)

### MinioService
- Upload/download de archivos
- Generación de URLs presignadas
- Gestión de buckets

### ExportService
- Exportación de datasets y resultados de evaluación

---

## Sistema de Tareas Asíncronas

- **Broker/Backend**: Redis
- **Worker**: `celery-worker` (docker-compose)
- **Scheduler**: `celery-beat` (tareas periódicas)
- **Monitorización**: Flower en puerto 5555

### Tarea principal: `evaluation_tasks.py`
Ejecuta la evaluación (legacy o Sonar-Lite) de forma asíncrona:
1. Descarga el dataset de MinIO
2. Ejecuta las métricas configuradas
3. Persiste resultados e issues
4. Actualiza el estado del `AnalysisRun` / `Evaluation`

---

## Middleware

| Middleware | Función |
|---|---|
| `error_handlers.py` | Captura excepciones y devuelve respuestas de error en formato estándar |
| `performance_monitor.py` | Registra tiempos de respuesta y detecta solicitudes lentas |
| `request_middleware.py` | Asigna ID único a cada solicitud y registra entradas/salidas |

---

## Almacenamiento de Archivos

### Estructura en MinIO

```
{MINIO_BUCKET}/
└── project_{id}/
    └── dataset_{id}/
        └── data.csv
```

---

## Flujo de Trabajo

### Carga de datos
1. Usuario crea un proyecto
2. Usuario carga un dataset al proyecto
3. El sistema procesa el archivo y extrae metadatos
4. El archivo se almacena en MinIO; metadatos en PostgreSQL

### Evaluación Sonar-Lite (flujo actual)
1. Usuario configura métricas en el proyecto
2. Usuario lanza un análisis → se crea un `AnalysisRun` (estado PENDING)
3. Celery ejecuta las métricas → issues guardados en `DataQualityIssue`
4. Se calculan diffs vs baseline usando fingerprints
5. Se evalúa el `QualityGate` → veredicto PASSED/WARNING/FAILED
6. `AnalysisRun` pasa a estado COMPLETED
7. Usuario ve resultados en el dashboard de proyecto
