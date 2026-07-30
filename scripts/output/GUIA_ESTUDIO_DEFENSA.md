# Guía de estudio para la defensa — DataQualAI

Explicación de todo el repositorio de principio a fin: qué hace el sistema, con qué herramientas está construido, cómo fluyen los datos y dónde está cada pieza de código.

---

## 1. Qué es el sistema (elevator pitch)

**Plataforma web de evaluación de calidad de datos para proyectos de IA.** Un usuario crea un proyecto, sube datasets (CSV), configura métricas de calidad (completitud, unicidad, exactitud sintáctica...), lanza análisis que se ejecutan en segundo plano y consulta los resultados en dashboards interactivos: puntuación global, issues detectados, evolución temporal y veredicto pasa/no-pasa (Quality Gate).

La idea central es trasladar la filosofía de **SonarQube** (análisis estático de código) al mundo de los **datos**: cada análisis es un *snapshot* inmutable, comparable con un *baseline* anterior, que detecta issues con *fingerprints* para distinguir problemas nuevos, recurrentes y corregidos. A esta arquitectura la llamamos **Sonar-Lite**.

Las métricas se alinean con **ISO/IEC 25012** (características de calidad de datos), **ISO/IEC 25024** (medidas concretas) e **ISO/IEC 5259** (calidad de datos para ML). Ejemplos de correspondencia: completeness → Compl_04, syntactic_accuracy → Exac_01, uniqueness → Cons_03.

---

## 2. Stack tecnológico

| Capa | Tecnología | Para qué |
|---|---|---|
| Frontend | **Next.js 13** (Pages Router) + React 18 + TypeScript | UI, routing por ficheros |
| UI kit | **Material UI (MUI) 5** + Emotion | Componentes visuales |
| Datos en cliente | **axios** + **SWR** | Cliente HTTP y caché/revalidación de datos |
| Formularios | react-hook-form, react-dropzone | Validación de formularios, subida drag&drop |
| Extras UI | Monaco Editor (editor JSON de parámetros), three.js/@react-three (canvas de linaje) | Edición avanzada y visualización 3D/canvas |
| Backend | **Flask** (Python) con app factory + blueprints | API REST |
| ORM | **SQLAlchemy** + **Flask-Migrate (Alembic)** | Modelos y migraciones de BD |
| Auth | **Flask-JWT-Extended** | Tokens JWT (access + refresh) |
| Análisis de datos | **pandas** + **numpy** | Cálculo de métricas sobre DataFrames |
| BD | **PostgreSQL 14** | Persistencia principal (BD `dataquality`), JSONB para configs/resultados |
| Cola de tareas | **Celery** + **Redis** (broker y backend de resultados) | Ejecución asíncrona de análisis |
| Almacenamiento | **MinIO** (S3-compatible) | Ficheros de los datasets |
| Monitorización | **Flower** | Dashboard de tareas Celery |
| Infraestructura | **Docker Compose** | Orquestación de los 8 servicios |
| Tests | **pytest** (+ coverage) | Tests de backend |

---

## 3. Arquitectura de despliegue (docker-compose.yml)

8 servicios en una red bridge (`app-network`):

| Servicio | Puerto | Rol |
|---|---|---|
| `frontend` | 3000 | Next.js en modo dev, con hot-reload (volúmenes montados + polling) |
| `backend` | 5000 | API Flask; healthcheck en `GET /health` |
| `celery-worker` | — | Ejecuta las tareas (`celery -A celery_app.celery worker`) |
| `celery-beat` | — | Tareas programadas (scheduler) |
| `flower` | 5555 | Monitor de Celery |
| `postgres` | 5432 | BD con volumen persistente + `init.sql` |
| `minio` | 9000/9001 | Almacenamiento de datasets (consola web en 9001) |
| `redis` | 6379 | Broker de Celery y caché |

Puntos que conviene saber explicar:
- **Backend y worker comparten la misma imagen** (mismo `Dockerfile`, distinto `command`): el worker necesita el mismo código (modelos, servicios) para ejecutar las evaluaciones.
- `depends_on` con `condition: service_healthy`: el backend no arranca hasta que Postgres, MinIO y Redis pasan su healthcheck.
- El frontend habla con el backend mediante **rewrites de Next.js**: el código usa URLs relativas `/api/...` y Next las redirige a `localhost:5000` (dev) o `http://backend:5000` (Docker). Así se evita CORS desde el navegador y no se hardcodea la URL del backend.

---

## 4. Backend: estructura y arranque

### 4.1 App factory (`backend/app.py`)

`create_app()` construye la aplicación:
1. Carga configuración por entorno (`config/`: development, testing, production).
2. Registra middlewares propios (`middleware/`): logging de peticiones, manejadores de errores y monitor de rendimiento (umbrales de petición lenta: 500 ms).
3. Inicializa extensiones: CORS, SQLAlchemy (`extensions.py` expone `db`), Flask-Migrate, JWT y **rate limiting** (Flask-Limiter, 100 req/min por IP).
4. Configura JWT: tokens en cabecera `Authorization: Bearer`, *blacklist* de tokens revocados (logout) y callbacks para respuestas 401 uniformes (`token_expired`, `invalid_token`...).
5. Registra las rutas (`api/routes.py`) y el endpoint `GET /health` (sin prefijo `/api`).

Al final del módulo se configura **Celery** con el contexto de Flask (`celery_app.configure_celery(app)`) y se arranca el **evaluation watchdog**.

### 4.2 API por blueprints (`backend/api/`)

Todos cuelgan de un blueprint padre con prefijo `/api`:

| Blueprint | Endpoints principales |
|---|---|
| `auth/` | `POST /register`, `POST /login`, `POST /refresh`, `GET/PUT /me` |
| `projects/` | CRUD de proyectos; `GET/PUT /<id>/quality-gate`; `GET/POST /<id>/config` (config de métricas) |
| `datasets/` | `POST /upload`, `GET /<id>`, `GET /<id>/preview`, `GET /<id>/profiling`, `GET /<id>/columns`, `GET /<id>/duplicates`, `DELETE /<id>` |
| `datasets/` (versionado) | `GET /<id>/versions`, `POST /<id>/new-version`, `GET /<id>/compare/<otro>`, `PATCH /<id>/version-tag` |
| `evaluations/` | Legacy: `POST /datasets/<id>` (lanzar), `GET /<id>`, `/<id>/status`, `/<id>/issues`, `/<id>/export`, `/compare` |
| `evaluations/` (Sonar-Lite) | `POST /projects/<id>/analyze` (lanzar AnalysisRun), `GET /analysis/<run_id>`, `/analysis/<run_id>/status`, `/analysis/<run_id>/issues`, `GET /projects/<id>/analysis_runs`, `/projects/<id>/latest_analysis` |
| `metrics/` | Catálogo de métricas y CRUD de plantillas (`/templates`) |
| `patterns/` | CRUD de patrones de validación regex reutilizables |
| `dashboard/` | `GET /summary` (KPIs, tendencias) |
| `admin/` | `/performance`, `/health` |

### 4.3 Servicios (`backend/services/`)

Lógica de negocio separada de las rutas:
- **`evaluation_service.py`** — el corazón del sistema: ejecuta métricas, calcula el Quality Score, evalúa el Quality Gate y hace el diff con el baseline (ver §7-§9).
- **`dataset_service.py`** — parsing de CSV, perfilado (profiling), inferencia de esquema.
- **`minio_service.py`** — subida/descarga de ficheros a MinIO.
- **`export_service.py`** — exportación de resultados de evaluaciones.
- **`services/metrics/`** — el motor de métricas plugable (ver §6).

### 4.4 Middleware (`backend/middleware/`)

- `error_handlers.py` — respuestas de error JSON uniformes (`{success, error, message, data}`).
- `request_middleware.py` — logging de cada petición con request ID.
- `performance_monitor.py` — mide tiempos y avisa de peticiones lentas.
- `evaluation_watchdog.py` — **hilo en segundo plano** que cada 60 s busca evaluaciones estancadas en `pending`/`processing` más de 5 minutos y las marca como fallidas. Es la red de seguridad si un worker muere a mitad de tarea.

---

## 5. Modelo de datos (backend/models/)

```
User ──1:N── Project ──1:N── Dataset ──1:N── AnalysisRun ──1:N── DataQualityIssue
                │                │                │
                │                └── self-ref     └── self-ref (baseline_analysis_id)
                │                    (parent_dataset_id, versionado)
                ├──1:1── QualityGate
                ├── metrics_config (JSONB en Project)
                └──1:N── Evaluation (legacy) ──1:N── Issue (legacy)

Metric / MetricTemplate  → catálogo de métricas y plantillas
ValidationPattern        → patrones regex reutilizables (email, DNI, teléfono...)
```

Detalles clave por entidad:

- **`Dataset`**: metadatos (nombre, `file_path` en MinIO, `row_count`, `column_count`, `schema` JSON) + **versionado**: `parent_dataset_id` (autorreferencia), `version` (entero), `version_tag` (etiqueta libre), `is_latest`. También `sensitive_columns` (JSONB): columnas cuyos valores se enmascaran (`***`) en previews y resultados.
- **`AnalysisRun`** (núcleo Sonar-Lite): estado técnico (`PENDING → RUNNING → COMPLETED/FAILED`), veredicto (`quality_gate_status`: PASSED/WARNING/FAILED), `quality_score` (0-100), contadores de issues (`total`, `critical`, `new`, `fixed`), `baseline_analysis_id` (autorreferencia al run de comparación), `metrics_config` y `results` (JSON completos, para que el snapshot sea **inmutable y reproducible**), y campos de seguimiento asíncrono (`task_id`, `progress`, `current_step`).
- **`DataQualityIssue`**: `fingerprint` (hash SHA-256 truncado a 16 chars, indexado), `issue_type`, `severity` (critical/major/minor/info — en el motor: critical/high/medium/low), descripción, columnas y filas afectadas, `is_new`, `rule_key`, valores actual/esperado.
- **`QualityGate`**: 1:1 con proyecto (unique constraint sobre `project_id`); `thresholds` en JSON. Umbrales por defecto: `min_score: 70`, `max_critical_issues: 0`, `max_new_issues: 10`, `warning_margin: 10`.
- **`Evaluation` / `Issue`**: sistema **legacy** anterior a Sonar-Lite; se mantiene por compatibilidad y ambos modelos se actualizan en paralelo durante una ejecución.

Las migraciones están en `backend/migrations/` (Alembic vía Flask-Migrate): `flask db migrate` + `flask db upgrade`.

---

## 6. Motor de métricas (backend/services/metrics/)

Diseño **plugable con patrón Registry + Strategy**:

- **`base.py`** define:
  - `MetricResult` (dataclass): `metric_id`, `score` (0.0-1.0 o None), `results` (dict detallado), `issues` (lista de dicts).
  - `BaseMetric` (ABC): toda métrica implementa `evaluate(df, parameters, dataset, evaluation_id, metrics_map) -> MetricResult`. Aporta utilidades compartidas:
    - `calculate_dynamic_severity()` — severidad según distancia al umbral (con escalas específicas por tipo de métrica).
    - `apply_null_patterns()` — convierte a NaN valores que "parecen nulos" (`"N/A"`, `"null"`, `"-"`, cadena vacía, solo espacios...) mediante presets + regex personalizadas. Clave para que la completitud no se infle con nulos disfrazados.
    - `infer_column_type()`, `generate_histogram()`, `mask_sensitive()`.
- **`registry.py`**: dict `METRIC_REGISTRY` que mapea `metric_id` → clase. Añadir una métrica nueva = crear una clase + registrarla (extensibilidad, principio open/closed).

Las **7 métricas registradas** (cada una en su fichero):

| metric_id | Qué mide | Alineación ISO |
|---|---|---|
| `completeness` | % de celdas no nulas (tras null-patterns) | 25012 Completitud / 25024 Compl_04 |
| `uniqueness` | Filas/valores duplicados | 25024 Cons_03 |
| `syntactic_accuracy` | Conformidad con patrones regex (email, fechas, DNI...) | 25012 Exactitud / 25024 Exac_01 |
| `logical_consistency` | Reglas entre columnas (ej. `fecha_fin >= fecha_inicio`) | 25012 Consistencia |
| `class_balance` | Balance de clases de la variable objetivo (para ML) | ISO 5259 |
| `currentness` | Antigüedad de los datos frente a un umbral | 25012 Actualidad |
| `diversity` | Diversidad/representatividad de valores | ISO 5259 |

**`outliers`** existe (`outliers.py`) pero **no está en el registro**: dejó de considerarse dimensión de calidad puntuable (alineado con ISO 5259) y se reutiliza solo desde el Data Profiling.

---

## 7. Flujo completo de un análisis (de inicio a fin)

1. **Subida**: el usuario sube un CSV → `POST /api/datasets/upload` → el fichero va a **MinIO**, los metadatos (esquema inferido, filas, columnas) a **PostgreSQL**.
2. **Configuración**: en el proyecto se configuran métricas y parámetros (columnas, umbrales, regex, null-patterns) → se guarda como JSONB (`metrics_config`). El frontend ofrece un diálogo inteligente (`SmartMetricConfigDialog`) con sugerencias por tipo de columna.
3. **Lanzamiento**: `POST /api/evaluations/projects/<id>/analyze` crea un `AnalysisRun` en estado `PENDING` (y una `Evaluation` legacy) y encola la tarea Celery `tasks.run_evaluation` en **Redis**.
4. **Ejecución (celery-worker)** — `EvaluationService.run_evaluation()`:
   - Marca el run como `RUNNING`, guarda `task_id` y `started_at`.
   - Descarga el CSV de MinIO y lo carga en un **DataFrame de pandas** (progreso 10-20 %).
   - **Por cada métrica configurada**: `get_metric(metric_id)` → `evaluate(...)` → acumula scores, resultados e issues (progreso 25-70 %). Errores en una métrica no abortan el análisis (se loguean y se continúa).
   - **Perfilado por columna** (progreso 75-90 %): completitud, unicidad, nulos, estadísticos (min/max/media/mediana/std) e histogramas para numéricas.
   - **Quality Score** (progreso 92 %, ver §8).
   - **Diff con baseline** (ver §9) y **Quality Gate** (ver §10).
   - Persiste todo: `results` JSON, issues con fingerprint, contadores, estado `COMPLETED`.
5. **Consulta**: el frontend hace *polling* a `/analysis/<run_id>/status` (progreso + paso actual) y al terminar carga resultados, issues y dashboard.

El progreso se escribe con **SQL directo (`UPDATE ... SET progress`)** en vez del ORM: la tarea corre en una transacción larga y así los commits de progreso son visibles inmediatamente para la API que hace polling.

## 8. Quality Score (fórmula)

El score **no** es la media de las métricas: es un modelo de **penalización por issues** con corrección por dimensionalidad:

```
raw_penalty  = Σ (nº issues de severidad s × peso s)
               pesos: critical 0.12 | high 0.05 | medium 0.01 | low 0.003
column_scale = sqrt(max(10, nº columnas) / 10)
quality_score = max(0, 1 − min(0.97, raw_penalty / column_scale))   # ×100 para escala 0-100
```

Justificaciones que suelen preguntar:
- **¿Por qué no la media de ratios?** Los scores por ratio diluyen errores concentrados: 3 fechas imposibles en 200 filas apenas mueven el ratio, pero inutilizan el dataset para series temporales. Contar issues ponderados por severidad lo captura mejor. La media de métricas se conserva como dato **diagnóstico** (`diagnostic_base_score`) pero no puntúa.
- **¿Por qué `sqrt(cols/10)`?** Datasets más anchos generan naturalmente más issues; la raíz cuadrada normaliza para que la misma *densidad* de problemas dé la misma nota independientemente del ancho.
- **¿Por qué cap a 0.97?** Para que el score nunca sea exactamente 0 por acumulación y conserve capacidad de discriminación entre datasets muy malos.
- El desglose completo (`score_breakdown`) se guarda en `results` para transparencia en la UI.

## 9. Fingerprinting y comparación con baseline (el "diff")

- Cada issue recibe un **fingerprint determinista** (`utils/fingerprint_utils.py`): SHA-256 de `issue_type | column | row_identifier | rule_key | extra_params` (valores normalizados: minúsculas, listas ordenadas), truncado a 16 caracteres (64 bits).
- Al terminar un run, `_compare_issues_with_baseline()` compara conjuntos de fingerprints:
  - fingerprint en ambos → **recurrente** (`is_new=False`)
  - solo en el actual → **nuevo**
  - solo en el baseline → **corregido** (fixed)
- **Elección del baseline** (`_get_baseline_for_analysis`): 1º el `baseline_analysis_id` explícito; si no, el último run `COMPLETED` del mismo proyecto; para datasets versionados, se busca automáticamente el último análisis del dataset **padre** (auto-baseline entre versiones).

Esto habilita la narrativa Sonar-Lite: "esta versión introduce 3 issues nuevos y corrige 5".

## 10. Quality Gate (veredicto)

`_evaluate_quality_gate()` lee los umbrales del `QualityGate` del proyecto (o defaults) y aplica, en orden:
1. **Issues críticos** > `max_critical_issues` → **FAILED** inmediato.
2. `quality_score` < `min_score` → **FAILED**.
3. Issues nuevos > `max_new_issues` → FAILED/WARNING.
4. Score dentro del margen (`min_score` a `min_score + warning_margin`) → **WARNING**.
5. En otro caso → **PASSED**.

Es el mismo concepto que el quality gate de SonarQube: convertir muchas medidas en **una decisión accionable**.

---

## 11. Versionado de datasets

- `POST /datasets/<id>/new-version` crea un dataset hijo (`parent_dataset_id`), incrementa `version`, mueve el flag `is_latest`.
- `GET /datasets/<id>/versions` devuelve el linaje; el frontend lo pinta como árbol en **`DatasetLineageCanvas`**.
- `GET /datasets/<id>/compare/<otro>` compara dos versiones (esquema, filas, métricas).
- Combinado con el auto-baseline (§9): al analizar la versión N, se compara automáticamente contra el último análisis de la versión N-1 → evolución de calidad entre versiones (`VersionEvolutionChart`).

---

## 12. Frontend (frontend/src/)

Next.js 13 con **Pages Router** (routing por ficheros) y TypeScript.

- **`pages/`**: `login`, `register`, `dashboard`, `projects/` (lista, detalle `[id]`, edición, nuevo), `datasets/` (lista, detalle, subida, comparación), `evaluations/` (lista, detalle), `metrics/`, `profile`, `settings`.
- **`contexts/AuthContext`**: estado global de autenticación; guarda el JWT y lo inyecta en cada petición (`Authorization: Bearer`). Con refresh token para renovar sesión.
- **`services/api.ts`**: cliente axios centralizado contra `/api/...` (las rewrites de Next hacen de proxy → sin CORS en el navegador).
- **SWR** para data fetching con caché y revalidación (y polling del estado de análisis en curso).
- **Componentes** destacados:
  - Dashboard: `KpiCard`, `ProjectHealthTimeline`, `IssueSeverityChart`, `AttentionTable`, `QualityTrendChart`.
  - Análisis: `AnalysisDashboardPanel`, `AnalysisHistory`, `QualityScoreGauge`, `QualityGateBadge`, `IssuesSummary`, `ViolationsDrawer`, y un detalle por métrica (`CompletenessDetail`, `UniquenessDetail`, `SyntacticAccuracyDetail`, `LogicalConsistencyDetail`, `ClassBalanceDetail`, `CurrentnessDetail`...).
  - Configuración: `SmartMetricConfigDialog` (asistente de configuración por métrica con selección de columnas), `LogicalConsistencyRuleEditor`, `JsonParameterEditor` (Monaco), `TemplateCard` (plantillas de métricas).
  - Datasets: `DataProfilingTab`, `DatasetVersionHistory`, `DatasetLineageCanvas`, `VersionEvolutionChart`, `DatasetSelector`.
- **i18n**: `i18n.ts` + `locales/` (interfaz multiidioma).

---

## 13. Seguridad

- **JWT** con access token (expira) + refresh token; blacklist en logout; callbacks 401 uniformes.
- **Autorización por propiedad**: cada endpoint verifica que el recurso pertenece al usuario del token (hay tests específicos anti-**IDOR**: `test_idor_authorization.py`).
- **Rate limiting**: 100 peticiones/minuto por IP (Flask-Limiter).
- **Columnas sensibles**: `sensitive_columns` por dataset → valores enmascarados (`***`) en previews, perfilado y resultados; las estadísticas de esas columnas se redactan del esquema expuesto.
- CORS restringido a los orígenes configurados (`CORS_ORIGINS`).
- Secretos por variables de entorno (`.env`, no comprometidas en el repo).

---

## 14. Fiabilidad del procesamiento asíncrono

- Celery con `acks_late=True` + `reject_on_worker_lost=True`: si un worker muere, la tarea se reencola.
- `max_retries=3` con backoff de 60 s; `task_time_limit=3600` (1 h máximo).
- **Watchdog** (hilo en el backend): detecta evaluaciones estancadas >5 min y las marca `failed` para que la UI no se quede en "processing" para siempre.
- **Flower** (puerto 5555) para inspeccionar la cola en vivo.
- La tarea crea su **propia app Flask mínima** (`get_flask_app()`) para tener contexto de BD en el proceso del worker.

---

## 15. Tests (backend/tests/)

Con pytest y una BD de test (fixtures en `conftest.py`):

| Fichero | Cubre |
|---|---|
| `test_auth.py` | Registro, login, refresh |
| `test_projects_api.py` | CRUD de proyectos |
| `test_dataset_versioning(_api).py` | Versionado y linaje (modelo y API) |
| `test_metrics_engine(_extended).py` | Motor de métricas y casos límite |
| `test_quality_score.py` | Fórmula del score |
| `test_quality_gate(_verdict).py` | Umbrales y veredicto |
| `test_fingerprinting.py` | Determinismo de fingerprints |
| `test_diff_baseline.py` | Diff nuevo/recurrente/corregido |
| `test_analysis_run.py` | Ciclo de vida del AnalysisRun |
| `test_idor_authorization.py` | Autorización entre usuarios |

Ejecución: `cd backend && pytest` (con cobertura: `pytest --cov=. tests/`). El proyecto además tiene `sonar-project.properties` para análisis con SonarQube.

---

## 16. Preguntas probables en la defensa (con respuesta corta)

**¿Por qué Celery y no ejecutar el análisis en la petición HTTP?**
Un análisis puede tardar minutos (descarga de MinIO + pandas sobre miles de filas). Bloquearía el worker HTTP y daría timeouts. Con Celery la API responde al instante con el `run_id` y el cliente hace polling del progreso.

**¿Por qué PostgreSQL + MinIO y no todo en la BD?**
Los ficheros grandes no deben vivir en la BD relacional (rendimiento, backups). MinIO da API S3 estándar; PostgreSQL guarda metadatos y resultados, con JSONB para estructuras flexibles (configs, resultados) sin sacrificar consultas.

**¿Por qué los resultados se guardan como JSON en el AnalysisRun?**
Para que cada run sea un snapshot **inmutable y autocontenido**: aunque cambie la configuración del proyecto después, el run conserva exactamente qué métricas se ejecutaron, con qué parámetros y qué salió.

**¿Cómo sabes que un issue es "el mismo" entre dos análisis?**
Por el fingerprint determinista (hash de tipo + columna + regla + parámetros normalizados). Mismos datos de entrada → mismo hash → issue recurrente; si desaparece → corregido.

**¿Qué aporta frente a Great Expectations / Soda / Deequ?**
Enfoque de producto integrado tipo SonarQube: gestión de proyectos y usuarios, versionado de datasets con auto-baseline, quality gate configurable, seguimiento de issues entre ejecuciones y dashboards, todo vía web sin escribir código; y alineación explícita con ISO 25012/25024/5259.

**¿Cómo añadirías una métrica nueva?**
Clase que hereda de `BaseMetric`, implementa `evaluate()` devolviendo un `MetricResult`, y se añade una línea al `METRIC_REGISTRY`. El resto (score, gate, issues, UI genérica) funciona sin tocar el pipeline.

**¿Por qué dos sistemas de evaluación (Evaluation y AnalysisRun)?**
`Evaluation` es el sistema inicial (legacy); `AnalysisRun` llegó con la arquitectura Sonar-Lite (baseline, gate, fingerprints). Se mantienen sincronizados por compatibilidad retroactiva de la API y la UI antiguas; la migración completa a AnalysisRun es línea futura.

**¿Escalabilidad?**
Horizontal en el punto caliente: más réplicas de `celery-worker` consumiendo de la misma cola Redis. La API es stateless (JWT), también replicable. Postgres y MinIO escalan de forma independiente.

**¿Limitaciones actuales?**
Solo CSV (pandas en memoria → datasets limitados por RAM del worker), fingerprints a nivel columna/regla más que fila a fila en todos los casos, y el sistema legacy duplicado pendiente de retirar.

---

## 17. Chuleta rápida (números y nombres)

- 8 servicios Docker; puertos: front 3000, API 5000, Postgres 5432, Redis 6379, MinIO 9000/9001, Flower 5555.
- 7 métricas registradas (completeness, uniqueness, syntactic_accuracy, logical_consistency, class_balance, currentness, diversity); outliers fuera del registro (solo profiling).
- Pesos del score: 0.12 / 0.05 / 0.01 / 0.003 (critical/high/medium/low); cap 0.97; escala `sqrt(cols/10)`.
- Gate por defecto: score ≥ 70, 0 críticos, ≤ 10 nuevos, margen de warning 10.
- Fingerprint: SHA-256 truncado a 16 hex chars (64 bits).
- Estados del run: PENDING → RUNNING → COMPLETED / FAILED; veredicto: PASSED / WARNING / FAILED.
- Watchdog: chequeo cada 60 s, umbral de estancamiento 300 s.
- Rate limit: 100 req/min. Tarea Celery: 3 reintentos, límite 1 h.
