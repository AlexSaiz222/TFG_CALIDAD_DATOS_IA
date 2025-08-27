# Arquitectura de la Plataforma de Evaluación de Calidad de Datos

Este documento describe la arquitectura completa de la Plataforma de Evaluación de Calidad de Datos para proyectos de IA, incluyendo la estructura de directorios, componentes principales, infraestructura y flujo de datos.

## Índice

1. [Visión General](#visión-general)
2. [Arquitectura del Backend](#arquitectura-del-backend)
3. [Arquitectura del Frontend](#arquitectura-del-frontend)
4. [Infraestructura Docker](#infraestructura-docker)
5. [Flujo de Datos y Comunicación](#flujo-de-datos-y-comunicación)
6. [Acceso a Servicios](#acceso-a-servicios)

## Visión General

La plataforma es una aplicación web con una arquitectura de microservicios containerizada, utilizando Docker Compose para orquestar todos los componentes. La aplicación consta de:

- **Frontend**: Aplicación React/Next.js con TypeScript
- **Backend**: API REST en Flask (Python)
- **Base de datos**: PostgreSQL para almacenamiento persistente
- **Almacenamiento de objetos**: MinIO (compatible con S3) para datasets
- **Procesamiento asíncrono**: Celery para tareas en segundo plano
- **Broker de mensajes**: Redis para comunicación entre servicios
- **Monitorización**: Flower para supervisar tareas de Celery

### Diagrama de Componentes

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│  PostgreSQL │
│  (Next.js)  │◀────│   (Flask)   │◀────│  (Database) │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐     ┌─────────────┐
                    │    Redis    │────▶│    Celery   │
                    │   (Broker)  │◀────│   (Worker)  │
                    └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │    MinIO    │
                                        │  (Storage)  │
                                        └─────────────┘
```

## Arquitectura del Backend

El backend está implementado en Flask (Python) y sigue una estructura modular para facilitar el mantenimiento y la escalabilidad.

### Estructura de Directorios

```
backend/
├── api/                    # Endpoints de la API REST
│   ├── admin/              # Rutas administrativas
│   ├── auth/               # Autenticación y gestión de usuarios
│   ├── datasets/           # Gestión de datasets
│   └── routes.py           # Registro de rutas
├── config/                 # Configuración de la aplicación
│   ├── __init__.py
│   └── logging_config.py   # Configuración de logging
├── middleware/             # Middlewares de Flask
│   ├── __init__.py
│   ├── error_handlers.py   # Manejadores de errores
│   ├── performance_monitor.py # Monitoreo de rendimiento
│   └── request_middleware.py  # Procesamiento de solicitudes
├── models/                 # Modelos de datos (SQLAlchemy)
│   ├── dataset.py
│   ├── evaluation.py
│   ├── metric.py
│   ├── project.py
│   └── user.py
├── schemas/                # Esquemas de validación (Marshmallow)
│   ├── dataset_schema.py
│   ├── evaluation_schema.py
│   └── user_schema.py
├── services/               # Lógica de negocio
│   ├── dataset_service.py
│   ├── evaluation_service.py
│   └── metric_service.py
├── tasks/                  # Tareas asíncronas (Celery)
│   ├── __init__.py
│   └── evaluation_tasks.py # Tareas de evaluación
├── app.py                  # Punto de entrada principal de Flask
├── celery_app.py           # Configuración de Celery
├── config.py               # Variables de configuración
├── extensions.py           # Extensiones de Flask (DB, etc.)
└── run_flower.py           # Script para iniciar Flower
```

### Componentes Principales del Backend

1. **API (api/)**: Define los endpoints REST organizados por dominio funcional.
   - `admin/`: Endpoints para administración y monitoreo
   - `auth/`: Autenticación, registro y gestión de usuarios
   - `datasets/`: Gestión de datasets (subida, descarga, visualización)

2. **Modelos (models/)**: Define las entidades de la base de datos usando SQLAlchemy.
   - `dataset.py`: Modelo para datasets
   - `evaluation.py`: Modelo para evaluaciones de calidad
   - `metric.py`: Modelo para métricas de calidad
   - `project.py`: Modelo para proyectos
   - `user.py`: Modelo para usuarios

3. **Middleware (middleware/)**: Componentes que procesan solicitudes HTTP.
   - `error_handlers.py`: Manejo centralizado de errores
   - `performance_monitor.py`: Monitoreo de rendimiento
   - `request_middleware.py`: Procesamiento de solicitudes

4. **Tareas (tasks/)**: Tareas asíncronas ejecutadas por Celery.
   - `evaluation_tasks.py`: Procesamiento asíncrono de evaluaciones

5. **Servicios (services/)**: Lógica de negocio reutilizable.
   - `dataset_service.py`: Operaciones con datasets
   - `evaluation_service.py`: Lógica de evaluación
   - `metric_service.py`: Gestión de métricas

6. **Configuración (config/)**: Configuración de la aplicación.
   - `logging_config.py`: Configuración del sistema de logging

### Flujo de Ejecución del Backend

1. Las solicitudes HTTP llegan al servidor Flask (`app.py`)
2. Pasan por los middlewares de procesamiento y monitoreo
3. Se enrutan a los controladores específicos en `api/`
4. Los controladores utilizan servicios para la lógica de negocio
5. Las tareas pesadas se delegan a Celery para procesamiento asíncrono
6. Los resultados se almacenan en PostgreSQL y/o MinIO
7. Las respuestas se devuelven al cliente con formato JSON estandarizado

## Arquitectura del Frontend

El frontend está implementado con Next.js (React + TypeScript) y sigue una estructura modular basada en componentes.

### Estructura de Directorios

```
frontend/
├── public/                 # Archivos estáticos
│   └── images/             # Imágenes y recursos gráficos
├── src/                    # Código fuente
│   ├── components/         # Componentes React reutilizables
│   │   ├── common/         # Componentes genéricos (botones, inputs, etc.)
│   │   ├── layout/         # Componentes de estructura (header, sidebar, etc.)
│   │   ├── datasets/       # Componentes específicos para datasets
│   │   ├── metrics/        # Componentes para métricas y evaluaciones
│   │   └── projects/       # Componentes para gestión de proyectos
│   ├── contexts/           # Contextos de React (estado global)
│   │   └── AuthContext.tsx # Contexto de autenticación
│   ├── hooks/              # Hooks personalizados
│   │   ├── useApi.ts       # Hook para llamadas a la API
│   │   └── useAuth.ts      # Hook para autenticación
│   ├── pages/              # Páginas de Next.js (rutas)
│   │   ├── _app.tsx        # Componente raíz de la aplicación
│   │   ├── dashboard.tsx   # Dashboard principal
│   │   ├── index.tsx       # Página de inicio
│   │   ├── login.tsx       # Página de login
│   │   └── register.tsx    # Página de registro
│   ├── services/           # Servicios para comunicación con API
│   │   └── api.ts          # Cliente API con Axios
│   ├── styles/             # Estilos CSS/SCSS
│   ├── types/              # Definiciones de tipos TypeScript
│   └── utils/              # Utilidades y helpers
├── .env                    # Variables de entorno
├── next.config.js          # Configuración de Next.js
├── package.json            # Dependencias y scripts
└── tsconfig.json           # Configuración de TypeScript
```

### Componentes Principales del Frontend

1. **Páginas (pages/)**: Rutas de la aplicación definidas por Next.js.
   - `_app.tsx`: Componente raíz que envuelve toda la aplicación
   - `dashboard.tsx`: Dashboard principal con resumen de proyectos
   - `login.tsx` y `register.tsx`: Autenticación de usuarios

2. **Componentes (components/)**: Bloques de UI reutilizables.
   - `common/`: Componentes genéricos (botones, formularios, etc.)
   - `layout/`: Componentes estructurales (header, sidebar, etc.)
   - Componentes específicos por dominio (datasets, metrics, projects)

3. **Contextos (contexts/)**: Estado global compartido.
   - `AuthContext.tsx`: Gestión del estado de autenticación

4. **Servicios (services/)**: Comunicación con el backend.
   - `api.ts`: Cliente Axios configurado con interceptores para:
     - Manejo de tokens de autenticación
     - Deduplicación de solicitudes
     - Manejo de errores
     - Caché de respuestas

5. **Hooks (hooks/)**: Lógica reutilizable para componentes.
   - `useApi.ts`: Hook para realizar llamadas a la API
   - `useAuth.ts`: Hook para gestionar la autenticación

### Flujo de Datos en el Frontend

1. El usuario interactúa con componentes de UI
2. Los componentes utilizan hooks y contextos para acceder al estado
3. Las acciones del usuario desencadenan llamadas a la API mediante servicios
4. Las respuestas de la API actualizan el estado local o global
5. Los cambios de estado provocan re-renderizados de componentes

## Infraestructura Docker

La aplicación utiliza Docker Compose para orquestar todos los servicios necesarios, facilitando el desarrollo y despliegue.

### Servicios Docker

1. **Frontend (frontend)**
   - Imagen: Construida desde `./frontend/Dockerfile`
   - Puertos: 3000:3000
   - Volúmenes: Monta el código fuente para desarrollo en tiempo real
   - Dependencias: Backend

2. **Backend (backend)**
   - Imagen: Construida desde `./backend/Dockerfile`
   - Puertos: 5000:5000
   - Volúmenes: Monta el código fuente para desarrollo en tiempo real
   - Dependencias: PostgreSQL, Redis, MinIO
   - Variables de entorno: Configuración de base de datos, Redis, MinIO, etc.

3. **Celery Worker (celery-worker)**
   - Imagen: Misma que el backend
   - Comando: `celery -A celery_app.celery worker --loglevel=info`
   - Dependencias: Backend, Redis
   - Variables de entorno: Similares al backend

4. **Celery Beat (celery-beat)**
   - Imagen: Misma que el backend
   - Comando: `celery -A celery_app.celery beat --loglevel=info`
   - Dependencias: Celery Worker, Redis
   - Propósito: Programación de tareas periódicas

5. **Flower (flower)**
   - Imagen: Construida desde `./backend/Dockerfile.flower`
   - Puertos: 5555:5555
   - Dependencias: Celery Worker, Redis
   - Propósito: Monitorización de tareas Celery

6. **PostgreSQL (postgres)**
   - Imagen: postgres:14
   - Puertos: 5432:5432
   - Volúmenes: Volumen nombrado para persistencia de datos
   - Variables de entorno: Credenciales y nombre de base de datos

7. **MinIO (minio)**
   - Imagen: minio/minio
   - Puertos: 9000:9000 (API), 9001:9001 (Consola)
   - Volúmenes: Volumen nombrado para persistencia de datos
   - Propósito: Almacenamiento de objetos compatible con S3

8. **Redis (redis)**
   - Imagen: redis:6
   - Puertos: 6379:6379
   - Volúmenes: Volumen nombrado para persistencia de datos
   - Propósito: Broker de mensajes para Celery y caché

### Redes y Volúmenes

- **Red**: `app-network` (bridge) para comunicación entre contenedores
- **Volúmenes**:
  - `postgres-data`: Persistencia de la base de datos
  - `minio-data`: Persistencia de archivos de MinIO
  - `redis-data`: Persistencia de datos de Redis

### Script de Despliegue

El archivo `deploy.bat` facilita el despliegue de la aplicación:
- Detiene contenedores existentes
- Reconstruye imágenes si es necesario
- Inicia todos los servicios
- Muestra información de acceso a los servicios

## Flujo de Datos y Comunicación

### Flujo de Evaluación de Datasets

1. **Subida de Dataset**:
   - El usuario sube un dataset desde el frontend
   - El archivo se envía al backend mediante una solicitud multipart
   - El backend almacena el archivo en MinIO
   - Se crea un registro en la base de datos PostgreSQL

2. **Configuración de Métricas**:
   - El usuario configura las métricas a aplicar
   - La configuración se envía al backend y se almacena en PostgreSQL

3. **Ejecución de Evaluación**:
   - El usuario inicia una evaluación
   - El backend crea un registro de evaluación en PostgreSQL
   - Se envía una tarea asíncrona a Celery
   - El frontend puede consultar el estado de la evaluación

4. **Procesamiento Asíncrono**:
   - Celery Worker recibe la tarea
   - Descarga el dataset desde MinIO
   - Aplica las métricas configuradas
   - Actualiza el progreso en PostgreSQL
   - Almacena los resultados en PostgreSQL

5. **Visualización de Resultados**:
   - El frontend consulta los resultados de la evaluación
   - Se muestran gráficos y estadísticas al usuario

### Comunicación entre Componentes

1. **Frontend ↔ Backend**:
   - Comunicación REST a través de HTTP/HTTPS
   - Autenticación mediante tokens JWT
   - Formato de datos: JSON
   - Gestión de errores estandarizada

2. **Backend ↔ PostgreSQL**:
   - Conexión mediante SQLAlchemy ORM
   - Transacciones para operaciones críticas
   - Migraciones para gestión de esquema

3. **Backend ↔ MinIO**:
   - API compatible con S3 para almacenamiento de objetos
   - Operaciones: upload, download, delete

4. **Backend ↔ Celery**:
   - Comunicación a través de Redis como broker
   - Tareas serializadas en formato JSON
   - Resultados almacenados en Redis temporalmente

5. **Celery ↔ Flower**:
   - Monitorización de tareas y workers
   - Estadísticas en tiempo real
   - Interfaz web para visualización

## Acceso a Servicios

### Endpoints Principales

- **Frontend**: http://localhost:3000
  - Interfaz de usuario principal

- **Backend API**: http://localhost:5000
  - API REST para todas las operaciones
  - Documentación: http://localhost:5000/docs (si está habilitada)

- **Flower Dashboard**: http://localhost:5555
  - Monitorización de tareas Celery
  - Visualización de workers y colas

- **MinIO Console**: http://localhost:9001
  - Gestión de buckets y objetos
  - Credenciales: minioadmin / minioadmin

### Acceso a PostgreSQL

- **Host**: localhost
- **Puerto**: 5432
- **Usuario**: postgres
- **Contraseña**: postgres
- **Base de datos**: dataquality

Conexión mediante herramientas como pgAdmin o DBeaver:
1. Crear una nueva conexión con los datos anteriores
2. Conectar directamente al puerto expuesto

### Acceso a Redis

- **Host**: localhost
- **Puerto**: 6379

Conexión mediante redis-cli o herramientas gráficas:
```
redis-cli -h localhost -p 6379
```

---

## Conclusión

Esta arquitectura proporciona una base sólida para la Plataforma de Evaluación de Calidad de Datos, con separación clara de responsabilidades, procesamiento asíncrono para tareas pesadas, y una infraestructura containerizada que facilita el desarrollo y despliegue.

La combinación de Flask, React, PostgreSQL, MinIO, Redis y Celery permite crear una aplicación robusta y escalable, capaz de manejar grandes volúmenes de datos y proporcionar análisis detallados de calidad.
