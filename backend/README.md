# Backend de la Plataforma de Evaluación de Calidad de Datos

## Descripción General

Este componente implementa el backend de la Plataforma de Evaluación de Calidad de Datos para Proyectos de IA, proporcionando una API REST para la gestión de proyectos, datasets, evaluaciones y métricas de calidad.

## Tecnologías Principales

- **Flask**: Framework web para la API REST
- **PostgreSQL**: Base de datos relacional
- **Celery**: Procesamiento asíncrono de tareas
- **Redis**: Broker de mensajes y caché
- **MinIO**: Almacenamiento de archivos compatible con S3
- **SQLAlchemy**: ORM para acceso a base de datos
- **Marshmallow**: Validación y serialización de datos
- **JWT**: Autenticación basada en tokens

## Estructura del Proyecto

La estructura del proyecto sigue un patrón modular con separación clara de responsabilidades:

```
backend/
├── api/                  # Endpoints de la API REST
│   ├── admin/            # Endpoints administrativos y monitoreo
│   ├── auth/             # Autenticación y gestión de usuarios
│   ├── datasets/         # Gestión de datasets
│   ├── evaluations/      # Evaluaciones de calidad
│   ├── metrics/          # Configuración de métricas
│   └── projects/         # Gestión de proyectos
├── config/               # Configuración centralizada
│   └── logging_config.py # Configuración de logging
├── middleware/           # Middlewares para procesamiento de solicitudes
│   ├── error_handlers.py # Manejo centralizado de errores
│   ├── request_middleware.py # Procesamiento de solicitudes
│   └── performance_monitor.py # Monitoreo de rendimiento
├── models/               # Modelos de datos SQLAlchemy
├── schemas/              # Esquemas de validación (Marshmallow)
├── services/             # Servicios de lógica de negocio
├── tasks/                # Tareas asíncronas (Celery)
└── scripts/              # Scripts de utilidad y migraciones
```

## Características Principales

### 1. Evaluación Asíncrona de Calidad de Datos

El sistema permite ejecutar evaluaciones de calidad de datos de forma asíncrona utilizando Celery, lo que permite procesar grandes volúmenes de datos sin bloquear la API.

### 2. Manejo Centralizado de Errores

Implementa un sistema de manejo de errores que estandariza todas las respuestas de error en formato JSON con campos `success`, `error` y `message`.

### 3. Logging Estructurado

Sistema de logging avanzado que proporciona información detallada sobre cada solicitud, incluyendo ID único, usuario, tiempo de respuesta y más.

### 4. Monitoreo de Rendimiento

Middleware para monitorear el rendimiento de la API, identificar cuellos de botella y proporcionar métricas de tiempo de respuesta.

### 5. Validación de Datos con Esquemas

Utiliza Marshmallow para validar todas las entradas de datos, proporcionando mensajes de error claros y específicos.

## Configuración y Ejecución

### Requisitos Previos

- Python 3.9+
- PostgreSQL 13+
- Redis 6+
- MinIO o servicio S3 compatible

### Variables de Entorno

Copia el archivo `.env.example` a `.env` y configura las variables según tu entorno:

```bash
cp .env.example .env
```

### Instalación de Dependencias

```bash
pip install -r requirements.txt
```

### Ejecución en Desarrollo

```bash
# Terminal 1: API Flask
flask run --debug

# Terminal 2: Worker Celery
celery -A celery_app.celery worker --loglevel=info
```

### Ejecución con Docker Compose

```bash
docker-compose up -d
```

## Endpoints Administrativos

### Monitoreo de Rendimiento

```
GET /api/admin/performance
```

Proporciona métricas de rendimiento de la API, incluyendo tiempos de respuesta por endpoint y ruta.

### Verificación de Salud

```
GET /api/admin/health
```

Verifica el estado de salud del sistema y sus componentes.

## Documentación Adicional

Para más detalles sobre las mejoras implementadas, consulta el archivo `docs/backend_mejoras.md`.
