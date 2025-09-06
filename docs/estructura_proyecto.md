# Documentación de la Estructura del Proyecto: Plataforma de Evaluación de Calidad de Datos para Proyectos de IA

## Descripción General del Proyecto

La Plataforma de Evaluación de Calidad de Datos para Proyectos de IA es una solución integral diseñada para analizar, evaluar y mejorar la calidad de los conjuntos de datos utilizados en proyectos de inteligencia artificial. El sistema permite a los usuarios gestionar proyectos, cargar datasets, configurar métricas de evaluación, ejecutar evaluaciones de calidad y visualizar resultados a través de dashboards interactivos.

La arquitectura del proyecto sigue un patrón cliente-servidor con un frontend desarrollado en React/TypeScript (Next.js) y un backend en Python (Flask), utilizando PostgreSQL como base de datos, MinIO para almacenamiento de archivos, Redis para caché y procesamiento asíncrono, y Docker Compose para la orquestación de servicios.

## Mapa de la Estructura

```
TFG_CALIDAD_DATOS_IA/
├── backend/                  # Servidor API Flask
│   ├── api/                  # Endpoints de la API REST
│   │   ├── admin/            # Endpoints administrativos y monitoreo
│   │   ├── auth/             # Autenticación y gestión de usuarios
│   │   ├── datasets/         # Gestión de datasets
│   │   ├── evaluations/      # Evaluaciones de calidad
│   │   ├── metrics/          # Configuración de métricas
│   │   └── projects/         # Gestión de proyectos
│   ├── config/               # Configuración centralizada
│   │   └── logging_config.py # Configuración de logging
│   ├── middleware/           # Middlewares para procesamiento de solicitudes
│   │   ├── error_handlers.py # Manejo centralizado de errores
│   │   ├── request_middleware.py # Procesamiento de solicitudes
│   │   └── performance_monitor.py # Monitoreo de rendimiento
│   ├── models/               # Modelos de datos SQLAlchemy
│   ├── schemas/              # Esquemas de validación (Marshmallow)
│   ├── services/             # Servicios de lógica de negocio
│   ├── tasks/                # Tareas asíncronas (Celery)
│   ├── scripts/              # Scripts de utilidad y migraciones
│   ├── app.py                # Punto de entrada de la aplicación
│   ├── celery_app.py         # Configuración de Celery
│   ├── config.py             # Configuración de la aplicación
│   ├── extensions.py         # Extensiones de Flask
│   ├── requirements.txt      # Dependencias Python
│   └── Dockerfile            # Configuración para contenedor Docker
├── frontend/                 # Cliente web Next.js
│   ├── public/               # Archivos estáticos
│   ├── src/                  # Código fuente
│   │   ├── components/       # Componentes React reutilizables
│   │   ├── contexts/         # Contextos de React (estado global)
│   │   ├── hooks/            # Hooks personalizados
│   │   ├── pages/            # Páginas/rutas de la aplicación
│   │   ├── services/         # Servicios para comunicación con API
│   │   ├── styles/           # Estilos CSS/SCSS
│   │   ├── types/            # Definiciones de tipos TypeScript
│   │   └── utils/            # Utilidades y funciones auxiliares
│   ├── package.json          # Dependencias y scripts npm
│   └── Dockerfile            # Configuración para contenedor Docker
├── docker/                   # Configuraciones adicionales para Docker
├── docs/                     # Documentación del proyecto
└── docker-compose.yml        # Configuración de servicios Docker
```

## Detalles por Sección

### Backend (Flask)

#### Estructura Principal
- **app.py**: Punto de entrada de la aplicación Flask, configura la aplicación, registra rutas y extensiones.
- **celery_app.py**: Configuración de Celery para procesamiento asíncrono.
- **config.py**: Configuración de la aplicación basada en variables de entorno.
- **config/logging_config.py**: Configuración centralizada de logging.
- **extensions.py**: Inicialización de extensiones de Flask (SQLAlchemy, JWT, CORS).
- **.env**: Variables de entorno para desarrollo local.
- **.env.example**: Plantilla de variables de entorno para configuración.

#### API (Endpoints REST)
- **api/admin/**: Endpoints administrativos para monitoreo y gestión del sistema.
- **api/auth/**: Autenticación de usuarios (login, registro, gestión de tokens).
- **api/projects/**: CRUD de proyectos.
- **api/datasets/**: Gestión de conjuntos de datos (carga, listado, eliminación).
- **api/evaluations/**: Evaluaciones de calidad de datos (creación, consulta, resultados).
- **api/metrics/**: Configuración y gestión de métricas de calidad.

#### Modelos (SQLAlchemy)
- **models/user.py**: Modelo de usuario para autenticación y permisos.
- **models/project.py**: Modelo para proyectos que agrupan datasets.
- **models/dataset.py**: Modelo para conjuntos de datos.
- **models/evaluation.py**: Modelo para evaluaciones de calidad y resultados.
- **models/metric.py**: Modelo para métricas y configuraciones.

#### Servicios (Lógica de Negocio)
- **services/dataset_service.py**: Operaciones con datasets (carga, validación).
- **services/evaluation_service.py**: Lógica de evaluación de calidad de datos.
- **services/minio_service.py**: Gestión de almacenamiento de archivos con MinIO.

#### Tareas Asíncronas (Celery)
- **tasks/evaluation_tasks.py**: Tareas asíncronas para ejecutar evaluaciones de calidad.

#### Middleware
- **middleware/error_handlers.py**: Manejo centralizado de errores HTTP y excepciones.
  - Manejadores para errores HTTP estándar (400, 401, 403, 404, 405, 429)
  - Manejo de errores de base de datos (SQLAlchemyError)
  - Manejo de excepciones no capturadas con diferentes niveles de detalle según el entorno
  - Respuestas JSON estandarizadas con campos success, error, message

- **middleware/request_middleware.py**: Procesamiento de solicitudes y respuestas HTTP.
  - Asignación de ID único a cada solicitud para seguimiento
  - Registro de información contextual (IP, método, ruta, usuario)
  - Propagación del ID de solicitud a través de los logs
  - Inclusión del ID de solicitud en las cabeceras de respuesta

- **middleware/performance_monitor.py**: Monitoreo de rendimiento y tiempos de respuesta.
  - Medición de tiempo de respuesta para cada solicitud
  - Detección de solicitudes lentas (configurable mediante umbral)
  - Estadísticas por endpoint y ruta
  - Decorador para monitorear funciones específicas

#### Esquemas de Validación
- **schemas/evaluation_schema.py**: Esquemas Marshmallow para validación de evaluaciones.

#### Scripts y Utilidades
- **scripts/init_db.py**: Inicialización de la base de datos.
- **scripts/migrations/**: Scripts SQL para migraciones de esquema.

### Frontend (Next.js/React)

#### Estructura Principal
- **src/pages/**: Páginas de la aplicación (rutas Next.js).
- **src/components/**: Componentes React reutilizables.
- **src/contexts/**: Contextos para gestión de estado global.
- **src/hooks/**: Hooks personalizados para lógica reutilizable.
- **src/services/**: Servicios para comunicación con la API backend.
- **src/styles/**: Estilos CSS/SCSS para la aplicación.
- **src/types/**: Definiciones de tipos TypeScript.
- **src/utils/**: Utilidades y funciones auxiliares.

### Infraestructura (Docker)

- **docker-compose.yml**: Configuración de servicios (backend, frontend, PostgreSQL, MinIO, Redis, Celery).
- **docker/**: Configuraciones adicionales para contenedores.
- **backend/Dockerfile**: Configuración para construir la imagen del backend.
- **frontend/Dockerfile**: Configuración para construir la imagen del frontend.

## Dependencias Principales

### Backend (Python)

| Dependencia | Función |
|-------------|---------|
| Flask | Framework web para la API REST |
| Flask-SQLAlchemy | ORM para interacción con base de datos |
| Flask-JWT-Extended | Autenticación basada en tokens JWT |
| Flask-CORS | Soporte para CORS en la API |
| Flask-Limiter | Rate limiting para protección de API |
| Celery | Procesamiento asíncrono de tareas |
| Redis | Broker de mensajes para Celery y caché |
| SQLAlchemy | ORM para modelado de datos |
| psycopg2-binary | Driver para PostgreSQL |
| pandas | Análisis y manipulación de datos |
| scikit-learn | Algoritmos de ML para evaluación de datos |
| MinIO | Cliente para almacenamiento compatible con S3 |
| python-dotenv | Carga de variables de entorno |
| structlog | Logging estructurado |

### Frontend (JavaScript/TypeScript)

| Dependencia | Función |
|-------------|---------|
| Next.js | Framework React con SSR y enrutamiento |
| React | Biblioteca para interfaces de usuario |
| TypeScript | Tipado estático para JavaScript |
| Axios | Cliente HTTP para comunicación con API |
| React Query | Gestión de estado del servidor y caché |
| Tailwind CSS | Framework CSS utilitario |
| Chart.js | Visualización de datos |

## Patrones de Organización y Convenciones

1. **Arquitectura por Capas**:
   - Presentación: API REST (backend) y React (frontend)
   - Lógica de Negocio: Servicios y tareas
   - Acceso a Datos: Modelos SQLAlchemy

2. **Patrón Repositorio**:
   - Modelos definen la estructura de datos
   - Servicios encapsulan la lógica de negocio
   - API expone endpoints para interacción

3. **Convenciones de Nombres**:
   - Archivos Python en snake_case
   - Clases en PascalCase
   - Módulos organizados por funcionalidad
   - Endpoints API RESTful con nombres de recursos en plural

4. **Procesamiento Asíncrono**:
   - Tareas pesadas delegadas a workers Celery
   - Estado y progreso rastreados en base de datos
   - Endpoints para consultar estado de tareas

## Conclusiones y Mejoras Sugeridas

### Fortalezas de la Estructura Actual
- Clara separación de responsabilidades entre frontend y backend
- Organización modular que facilita el mantenimiento
- Implementación de procesamiento asíncrono para tareas pesadas
- Uso de contenedores Docker para facilitar el despliegue

### Mejoras Sugeridas

1. **Documentación de API**:
   - Implementar Swagger/OpenAPI para documentación automática de endpoints
   - Añadir docstrings completos a todas las funciones y clases

2. **Testing**:
   - Crear directorio `/tests` en backend y frontend
   - Implementar tests unitarios y de integración
   - Configurar CI/CD para ejecución automática de tests

3. **Gestión de Versiones de API**:
   - Implementar versionado de API (ej: `/api/v1/...`)
   - Preparar estrategia para migraciones futuras

4. **Monitoreo y Observabilidad**:
   - Añadir sistema de monitoreo para servicios
   - Implementar trazabilidad distribuida para depuración

5. **Seguridad**:
   - Implementar escaneo de dependencias
   - Añadir pruebas de seguridad automatizadas
   - Revisar y documentar políticas de seguridad

6. **Estructura de Carpetas Frontend**:
   - Organizar componentes por funcionalidad o características
   - Implementar patrón de diseño atómico para componentes UI

7. **Gestión de Estado**:
   - Evaluar uso de soluciones más robustas como Redux Toolkit o Zustand

Esta estructura proporciona una base sólida para el desarrollo y mantenimiento continuo de la plataforma, con un enfoque en la escalabilidad, mantenibilidad y separación clara de responsabilidades.
