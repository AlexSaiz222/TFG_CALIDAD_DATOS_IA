# Revisión Completa del Código - TFG Calidad de Datos para IA

## Índice
1. [Visión General del Proyecto](#1-visión-general-del-proyecto)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Modelo de Datos](#3-modelo-de-datos)
4. [Backend - Explicación Detallada](#4-backend---explicación-detallada)
5. [Frontend - Explicación Detallada](#5-frontend---explicación-detallada)
6. [Flujos de Trabajo Principales](#6-flujos-de-trabajo-principales)
7. [Estado Actual del Desarrollo](#7-estado-actual-del-desarrollo)
8. [Próximos Pasos Sugeridos](#8-próximos-pasos-sugeridos)

---

## 1. Visión General del Proyecto

### ¿Qué es este proyecto?
Es una **Plataforma de Evaluación de Calidad de Datos para proyectos de IA**. Permite a usuarios técnicos y de negocio:
- Subir conjuntos de datos (datasets)
- Ejecutar evaluaciones de calidad usando métricas estándar
- Visualizar resultados mediante dashboards interactivos
- Consumir análisis vía API

### Objetivo Principal
Identificar, monitorear y resolver problemas de calidad de datos que podrían impactar negativamente en proyectos de minería de datos, machine learning e inteligencia artificial.

### Stack Tecnológico
| Componente | Tecnología |
|------------|------------|
| **Frontend** | React + TypeScript (Next.js) |
| **Backend** | Flask (Python) |
| **Base de Datos** | PostgreSQL |
| **Almacenamiento** | MinIO (compatible con S3) |
| **Cache/Cola** | Redis |
| **Tareas Asíncronas** | Celery |
| **Infraestructura** | Docker Compose |

---

## 2. Arquitectura del Sistema

### Diagrama de Componentes
```
┌─────────────────────────────────────────────────────────────────────┐
│                         USUARIO (Navegador)                         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js - Puerto 3000)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Pages     │  │ Components  │  │  Services   │  │  Contexts  │ │
│  │ (Páginas)   │  │ (UI)        │  │  (API)      │  │  (Estado)  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ HTTP/REST
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Flask - Puerto 5000)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  API Routes │  │  Services   │  │   Models    │  │ Middleware │ │
│  │ (Endpoints) │  │ (Lógica)    │  │  (Datos)    │  │ (Seguridad)│ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │     MinIO       │  │     Redis       │
│  (Base Datos)   │  │ (Archivos)      │  │ (Cache/Cola)    │
│  Puerto: 5432   │  │ Puerto: 9000    │  │ Puerto: 6379    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                                                   │
                                                   ▼
                              ┌─────────────────────────────────────┐
                              │        CELERY WORKERS               │
                              │  (Procesamiento asíncrono de        │
                              │   evaluaciones de calidad)          │
                              └─────────────────────────────────────┘
```

### Servicios Docker
El archivo `docker-compose.yml` define 7 servicios:

1. **frontend**: Aplicación Next.js (puerto 3000)
2. **backend**: API Flask (puerto 5000)
3. **celery-worker**: Procesador de tareas asíncronas
4. **celery-beat**: Programador de tareas periódicas
5. **flower**: Monitor de Celery (puerto 5555)
6. **postgres**: Base de datos PostgreSQL (puerto 5432)
7. **minio**: Almacenamiento de archivos (puertos 9000, 9001)
8. **redis**: Cache y broker de mensajes (puerto 6379)

---

## 3. Modelo de Datos

### Diagrama Entidad-Relación
```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│     USER     │       │   PROJECT    │       │   DATASET    │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │──1:N──│ id (PK)      │──1:N──│ id (PK)      │
│ username     │       │ name         │       │ name         │
│ email        │       │ description  │       │ description  │
│ password_hash│       │ owner_id(FK) │       │ project_id(FK│
│ first_name   │       │ metrics_config│      │ file_path    │
│ last_name    │       │ created_at   │       │ file_size    │
│ organization │       │ updated_at   │       │ row_count    │
│ role         │       └──────────────┘       │ column_count │
│ created_at   │                              │ schema (JSON)│
│ updated_at   │                              │ created_at   │
└──────────────┘                              │ updated_at   │
                                              └──────────────┘
                                                     │
                                                    1:N
                                                     │
                                              ┌──────────────┐
                                              │  EVALUATION  │
                                              ├──────────────┤
                                              │ id (PK)      │
                                              │ dataset_id(FK│
                                              │ status       │──────┐
                                              │ metrics_config│     │
                                              │ results(JSON)│      │
                                              │ quality_score│     1:N
                                              │ task_id      │      │
                                              │ progress     │      │
                                              │ current_step │      │
                                              │ error        │      │
                                              │ started_at   │      │
                                              │ completed_at │      │
                                              └──────────────┘      │
                                                                    │
┌──────────────┐                              ┌──────────────┐      │
│    METRIC    │                              │    ISSUE     │◄─────┘
├──────────────┤                              ├──────────────┤
│ id (PK)      │──────────────────────────────│ id (PK)      │
│ name         │                              │ evaluation_id│
│ description  │                              │ metric_id(FK)│
│ category     │                              │ severity     │
│ parameters   │                              │ description  │
│ created_at   │                              │ affected_cols│
│ updated_at   │                              │ affected_rows│
└──────────────┘                              │ created_at   │
                                              └──────────────┘

┌──────────────────┐
│ METRIC_TEMPLATE  │
├──────────────────┤
│ id (PK)          │
│ name             │
│ description      │
│ metrics (JSON)   │
│ created_at       │
│ updated_at       │
└──────────────────┘
```

### Descripción de Entidades

#### **User** (`backend/models/user.py`)
Representa a los usuarios del sistema.
- **Campos principales**: `id`, `username`, `email`, `password_hash`, `role`
- **Relación**: Un usuario puede tener múltiples proyectos (1:N)

#### **Project** (`backend/models/project.py`)
Organiza los datasets y evaluaciones.
- **Campos principales**: `id`, `name`, `description`, `owner_id`, `metrics_config`
- **Relación**: Un proyecto pertenece a un usuario y puede tener múltiples datasets

#### **Dataset** (`backend/models/dataset.py`)
Almacena metadatos de los conjuntos de datos subidos.
- **Campos principales**: `id`, `name`, `file_path`, `row_count`, `column_count`, `schema`
- **Relación**: Un dataset pertenece a un proyecto y puede tener múltiples evaluaciones

#### **Evaluation** (`backend/models/evaluation.py`)
Representa una evaluación de calidad ejecutada sobre un dataset.
- **Campos principales**: `id`, `status`, `metrics_config`, `results`, `quality_score`, `progress`
- **Estados posibles**: `pending`, `processing`, `completed`, `failed`
- **Relación**: Una evaluación pertenece a un dataset y puede generar múltiples issues

#### **Issue** (`backend/models/evaluation.py`)
Representa un problema de calidad detectado.
- **Campos principales**: `id`, `severity`, `description`, `affected_columns`, `affected_rows`
- **Severidades**: `low`, `medium`, `high`

#### **Metric** (`backend/models/metric.py`)
Define las métricas de calidad disponibles.
- **Campos principales**: `id`, `name`, `description`, `category`, `parameters`

#### **MetricTemplate** (`backend/models/metric.py`)
Agrupa métricas en plantillas reutilizables.
- **Campos principales**: `id`, `name`, `description`, `metrics` (JSON array)

---

## 4. Backend - Explicación Detallada

### Estructura de Carpetas
```
backend/
├── api/                    # Endpoints de la API REST
│   ├── auth/               # Autenticación (login, register, perfil)
│   ├── projects/           # CRUD de proyectos
│   ├── datasets/           # Gestión de datasets
│   ├── evaluations/        # Evaluaciones de calidad
│   ├── metrics/            # Métricas y plantillas
│   └── routes.py           # Registro centralizado de rutas
├── models/                 # Modelos SQLAlchemy (ORM)
├── services/               # Lógica de negocio
│   ├── dataset_service.py  # Carga y procesamiento de datos
│   ├── evaluation_service.py # Motor de evaluación
│   ├── minio_service.py    # Almacenamiento de archivos
│   └── export_service.py   # Exportación de resultados
├── tasks/                  # Tareas asíncronas Celery
│   └── evaluation_tasks.py # Tarea de evaluación
├── middleware/             # Middleware de Flask
│   ├── error_handlers.py   # Manejo de errores
│   └── performance_monitor.py # Monitoreo
├── config/                 # Configuración
├── app.py                  # Punto de entrada principal
└── celery_app.py           # Configuración de Celery
```

### Punto de Entrada: `app.py`
El archivo `app.py` es el corazón del backend. Hace lo siguiente:

1. **Crea la aplicación Flask** con `create_app()`
2. **Configura CORS** para permitir peticiones del frontend
3. **Inicializa la base de datos** con SQLAlchemy
4. **Configura JWT** para autenticación con tokens
5. **Registra middlewares** (errores, rendimiento, logging)
6. **Registra las rutas** de la API
7. **Configura Celery** para tareas asíncronas

### Servicio de Evaluación: `evaluation_service.py`
Este es el **componente más importante** del sistema. Implementa las métricas de calidad:

#### Métricas Implementadas:

1. **Completeness (Completitud)**
   - Mide el porcentaje de valores no nulos
   - Fórmula: `1 - (valores_nulos / total_valores)`
   - Genera issues si está por debajo del umbral (default: 95%)

2. **Uniqueness (Unicidad)**
   - Mide el porcentaje de valores únicos
   - Detecta filas duplicadas
   - Fórmula: `filas_únicas / total_filas`

3. **Consistency (Consistencia)**
   - Verifica que los datos sigan patrones específicos
   - Usa expresiones regulares para validar formatos
   - Ejemplo: validar formato de emails, fechas, etc.

4. **Outliers (Valores Atípicos)**
   - Detecta valores fuera del rango normal
   - Métodos: IQR (Rango Intercuartílico) o Z-Score
   - Genera issues para cada columna con outliers

#### Flujo de Evaluación:
```
1. Obtener evaluación de la BD
2. Cambiar estado a "processing"
3. Descargar dataset de MinIO
4. Leer con Pandas
5. Para cada métrica configurada:
   - Calcular el valor de la métrica
   - Detectar problemas (issues)
   - Acumular resultados
6. Calcular quality_score global
7. Guardar resultados y issues en BD
8. Cambiar estado a "completed"
```

### Tareas Asíncronas: `evaluation_tasks.py`
Las evaluaciones se ejecutan de forma asíncrona usando Celery:

```python
@shared_task(bind=True, name='tasks.run_evaluation', max_retries=3)
def run_evaluation(self, evaluation_id):
    # 1. Actualizar estado a "processing"
    # 2. Crear EvaluationService
    # 3. Ejecutar evaluación
    # 4. Actualizar progreso periódicamente
    # 5. Manejar errores y reintentos
```

**Beneficios de usar Celery:**
- No bloquea el servidor web durante evaluaciones largas
- Permite reintentos automáticos en caso de fallo
- Monitoreo con Flower
- Escalabilidad horizontal (múltiples workers)

---

## 5. Frontend - Explicación Detallada

### Estructura de Carpetas
```
frontend/src/
├── pages/                  # Páginas de Next.js (rutas automáticas)
│   ├── _app.tsx            # Configuración global (tema, providers)
│   ├── index.tsx           # Página principal (redirige a login)
│   ├── login.tsx           # Inicio de sesión
│   ├── register.tsx        # Registro de usuarios
│   ├── dashboard.tsx       # Panel principal
│   ├── profile.tsx         # Perfil de usuario
│   ├── projects/           # Páginas de proyectos
│   ├── datasets/           # Páginas de datasets
│   └── metrics/            # Configuración de métricas
├── components/             # Componentes reutilizables
│   ├── layout/             # Layout, Navbar, Sidebar
│   └── metrics/            # Componentes de métricas
├── contexts/               # Contextos de React (estado global)
│   └── AuthContext.tsx     # Contexto de autenticación
├── services/               # Comunicación con la API
│   └── api.ts              # Cliente Axios configurado
├── types/                  # Definiciones TypeScript
└── utils/                  # Utilidades y helpers
```

### Sistema de Autenticación
El archivo `contexts/AuthContext.tsx` maneja:
- **Login**: Envía credenciales, recibe token JWT, lo guarda en localStorage
- **Logout**: Limpia token y redirige a login
- **Verificación**: Comprueba si el token es válido al cargar la app
- **Protección de rutas**: Redirige a login si no hay sesión

### Cliente API: `services/api.ts`
Este archivo es crucial. Configura Axios con:

1. **Interceptor de Request**:
   - Añade token JWT a cada petición
   - Implementa deduplicación de requests (evita peticiones duplicadas)
   - Genera IDs únicos para debugging

2. **Interceptor de Response**:
   - Maneja errores 401 (token expirado) → redirige a login
   - Limpia requests pendientes
   - Logging de errores

3. **APIs Exportadas**:
   - `authAPI`: login, register, getProfile, updateProfile
   - `projectsAPI`: CRUD de proyectos (con caché)
   - `datasetsAPI`: CRUD de datasets, upload, preview
   - `metricsAPI`: métricas, plantillas, configuraciones
   - `evaluationsAPI`: crear y consultar evaluaciones

### Páginas Principales

#### Dashboard (`pages/dashboard.tsx`)
- Muestra resumen de proyectos
- Lista de datasets recientes
- Estadísticas generales
- Accesos rápidos a funcionalidades

#### Proyectos (`pages/projects/`)
- Lista de proyectos del usuario
- Crear/editar/eliminar proyectos
- Ver datasets de un proyecto
- Configurar métricas del proyecto

#### Datasets (`pages/datasets/`)
- Lista de todos los datasets
- Subir nuevos datasets (CSV, Excel, JSON, Parquet)
- Vista previa de datos
- Ejecutar evaluaciones

#### Métricas (`pages/metrics/`)
- Configurar métricas para un proyecto
- Seleccionar plantillas predefinidas
- Ajustar parámetros (umbrales, columnas, etc.)

---

## 6. Flujos de Trabajo Principales

### Flujo 1: Registro y Login
```
Usuario                    Frontend                   Backend
   │                          │                          │
   │──[Datos registro]───────►│                          │
   │                          │──POST /api/auth/register─►│
   │                          │                          │──Crear usuario en BD
   │                          │◄─────────{success}───────│
   │◄─────[Redirigir login]───│                          │
   │                          │                          │
   │──[username, password]───►│                          │
   │                          │──POST /api/auth/login───►│
   │                          │                          │──Verificar credenciales
   │                          │                          │──Generar JWT
   │                          │◄─────────{token}─────────│
   │                          │──Guardar en localStorage │
   │◄─────[Redirigir dashboard]│                         │
```

### Flujo 2: Subir Dataset
```
Usuario                    Frontend                   Backend                MinIO
   │                          │                          │                      │
   │──[Seleccionar archivo]──►│                          │                      │
   │──[Nombre, descripción]──►│                          │                      │
   │                          │──POST /api/projects/{id}/│                      │
   │                          │  datasets/upload─────────►│                      │
   │                          │  (multipart/form-data)   │──Subir archivo──────►│
   │                          │                          │◄─────{file_path}─────│
   │                          │                          │──Leer con Pandas     │
   │                          │                          │──Extraer metadatos   │
   │                          │                          │──Guardar en BD       │
   │                          │◄─────────{dataset}───────│                      │
   │◄─────[Mostrar dataset]───│                          │                      │
```

### Flujo 3: Ejecutar Evaluación
```
Usuario                Frontend               Backend              Celery Worker
   │                      │                      │                      │
   │──[Iniciar evaluación]►│                      │                      │
   │                      │──POST /api/datasets/ │                      │
   │                      │  {id}/evaluations───►│                      │
   │                      │                      │──Crear Evaluation    │
   │                      │                      │  (status=pending)    │
   │                      │                      │──Encolar tarea──────►│
   │                      │◄───{evaluation_id}───│                      │
   │◄──[Mostrar progreso]──│                      │                      │
   │                      │                      │                      │──Descargar dataset
   │                      │                      │                      │──Ejecutar métricas
   │                      │──GET /api/evaluations│                      │──Actualizar progreso
   │                      │  /{id} (polling)────►│◄─────────────────────│
   │◄──[Actualizar UI]─────│◄───{progress: 50%}──│                      │
   │                      │                      │                      │──Guardar resultados
   │                      │──GET /api/evaluations│                      │──Crear issues
   │                      │  /{id}──────────────►│◄─────────────────────│
   │◄──[Mostrar resultados]│◄───{status:completed}│                      │
```

---

## 7. Estado Actual del Desarrollo

### ✅ Funcionalidades Completadas

#### Backend
- [x] Autenticación JWT (login, registro, refresh token)
- [x] CRUD completo de proyectos
- [x] CRUD completo de datasets
- [x] Subida de archivos a MinIO
- [x] Modelo de evaluaciones con estados
- [x] Servicio de evaluación con métricas:
  - [x] Completeness (completitud)
  - [x] Uniqueness (unicidad)
  - [x] Consistency (consistencia de patrones)
  - [x] Outliers (detección de valores atípicos)
- [x] Sistema de issues (problemas detectados)
- [x] Tareas asíncronas con Celery
- [x] Middleware de errores y logging
- [x] Monitoreo de rendimiento

#### Frontend
- [x] Sistema de autenticación con contexto
- [x] Páginas de login y registro
- [x] Dashboard principal
- [x] Gestión de proyectos (listar, crear, editar, eliminar)
- [x] Gestión de datasets (listar, subir, previsualizar, eliminar)
- [x] Cliente API con interceptores y manejo de errores
- [x] Caché de proyectos para mejor rendimiento
- [x] Manejo de timeouts y fallbacks

#### Infraestructura
- [x] Docker Compose con todos los servicios
- [x] PostgreSQL configurado
- [x] MinIO configurado
- [x] Redis configurado
- [x] Celery workers y beat
- [x] Flower para monitoreo

### 🔄 En Progreso / Parcialmente Implementado

- [ ] Visualización completa de resultados de evaluación
- [ ] Gráficos y dashboards de métricas
- [ ] Configuración avanzada de métricas por proyecto
- [ ] Plantillas de métricas personalizables
- [ ] Exportación de resultados (PDF, Excel)

### ❌ Pendiente de Implementar

- [ ] Evaluaciones programadas (cron jobs)
- [ ] Notificaciones por email
- [ ] Comparación entre evaluaciones
- [ ] Historial de cambios en datasets
- [ ] Roles y permisos avanzados
- [ ] API pública documentada (Swagger/OpenAPI)
- [ ] Tests unitarios y de integración
- [ ] CI/CD pipeline

---

## 8. Próximos Pasos Sugeridos

### Prioridad Alta (Core Functionality)

1. **Completar la visualización de evaluaciones**
   - Crear página `/evaluations/[id]` con resultados detallados
   - Mostrar quality_score con gráfico circular
   - Listar issues por severidad
   - Mostrar métricas por columna

2. **Mejorar la configuración de métricas**
   - UI para seleccionar métricas a ejecutar
   - Configurar umbrales personalizados
   - Seleccionar columnas específicas

3. **Implementar polling de progreso**
   - Mostrar barra de progreso durante evaluación
   - Actualizar automáticamente cuando complete

### Prioridad Media (User Experience)

4. **Dashboard mejorado**
   - Gráficos de tendencia de calidad
   - Resumen de issues por proyecto
   - Actividad reciente

5. **Exportación de resultados**
   - Descargar informe en PDF
   - Exportar datos a Excel/CSV

6. **Plantillas de métricas**
   - Crear/editar plantillas
   - Aplicar plantilla a proyecto

### Prioridad Baja (Nice to Have)

7. **Evaluaciones programadas**
   - Configurar frecuencia (diaria, semanal)
   - Notificaciones de resultados

8. **Comparación de evaluaciones**
   - Ver evolución de calidad en el tiempo
   - Detectar regresiones

9. **Documentación API**
   - Swagger/OpenAPI
   - Ejemplos de uso

---

## Resumen

Este TFG implementa una plataforma completa para evaluar la calidad de datos en proyectos de IA. La arquitectura es moderna y escalable, usando:

- **Frontend React/Next.js** con TypeScript para una UI robusta
- **Backend Flask** con arquitectura en capas (API → Services → Models)
- **Celery** para procesamiento asíncrono de evaluaciones
- **PostgreSQL** para persistencia
- **MinIO** para almacenamiento de archivos
- **Docker** para despliegue consistente

El código está bien estructurado y documentado. Las funcionalidades core están implementadas, quedando pendiente principalmente la mejora de la UI de visualización de resultados y algunas características avanzadas.

**Archivos clave para entender el sistema:**
- `backend/app.py` - Configuración del servidor
- `backend/services/evaluation_service.py` - Motor de evaluación
- `backend/tasks/evaluation_tasks.py` - Tareas asíncronas
- `frontend/src/services/api.ts` - Cliente API
- `frontend/src/contexts/AuthContext.tsx` - Autenticación
- `docker-compose.yml` - Infraestructura

---

*Documento generado el 25 de enero de 2026*
