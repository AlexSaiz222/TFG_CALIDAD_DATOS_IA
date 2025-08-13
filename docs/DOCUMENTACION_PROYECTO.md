# Documentación del Proyecto: Plataforma de Evaluación de Calidad de Datos para Proyectos de IA

## Índice
1. [Introducción](#introducción)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Componentes Principales](#componentes-principales)
   - [Frontend](#frontend)
   - [Backend](#backend)
   - [Base de Datos](#base-de-datos)
   - [Almacenamiento](#almacenamiento)
   - [Caché y Cola](#caché-y-cola)
4. [Funcionalidades](#funcionalidades)
   - [Autenticación y Gestión de Usuarios](#autenticación-y-gestión-de-usuarios)
   - [Gestión de Proyectos](#gestión-de-proyectos)
   - [Gestión de Datasets](#gestión-de-datasets)
   - [Configuración de Métricas](#configuración-de-métricas)
   - [Ejecución de Evaluaciones](#ejecución-de-evaluaciones)
   - [Visualización de Resultados](#visualización-de-resultados)
5. [Flujos de Trabajo](#flujos-de-trabajo)
6. [Buenas Prácticas Implementadas](#buenas-prácticas-implementadas)
7. [Guía de Instalación y Despliegue](#guía-de-instalación-y-despliegue)
8. [Guía de Desarrollo](#guía-de-desarrollo)
9. [Pruebas](#pruebas)
10. [Seguridad](#seguridad)
11. [Escalabilidad y Rendimiento](#escalabilidad-y-rendimiento)
12. [Mantenimiento y Evolución](#mantenimiento-y-evolución)

## Introducción

La Plataforma de Evaluación de Calidad de Datos para Proyectos de IA es una solución integral diseñada para ayudar a equipos técnicos y de negocio a evaluar, monitorizar y mejorar la calidad de los datos utilizados en proyectos de minería de datos, aprendizaje automático e inteligencia artificial.

### Objetivos del Proyecto

- Proporcionar una plataforma centralizada para la evaluación de calidad de datos
- Facilitar la identificación temprana de problemas de calidad en los datos
- Ofrecer métricas estandarizadas y personalizables para diferentes tipos de datos
- Permitir la visualización intuitiva de resultados mediante dashboards interactivos
- Automatizar el proceso de evaluación de calidad para grandes volúmenes de datos
- Integrar la evaluación de calidad en el flujo de trabajo de proyectos de IA

### Alcance

El proyecto abarca el desarrollo de un MVP (Producto Mínimo Viable) con las siguientes capacidades:

- Sistema de autenticación y gestión de usuarios
- Gestión de proyectos y datasets
- Configuración de reglas y métricas de calidad
- Ejecución de evaluaciones de calidad
- Visualización de resultados mediante dashboards interactivos
- API para consumo de análisis y resultados

## Arquitectura del Sistema

La plataforma sigue una arquitectura de microservicios moderna, con separación clara entre frontend y backend, utilizando tecnologías estándar de la industria.

### Diagrama de Arquitectura

```
+-------------------+      +-------------------+      +-------------------+
|                   |      |                   |      |                   |
|     Frontend      |<---->|     Backend       |<---->|     Database      |
|   (Next.js/React) |      |     (Flask)       |      |   (PostgreSQL)    |
|                   |      |                   |      |                   |
+-------------------+      +-------------------+      +-------------------+
                                    ^
                                    |
                           +--------+--------+
                           |                 |
                +----------v----------+    +-v------------------+
                |                     |    |                    |
                |      Storage        |    |    Cache/Queue     |
                |      (MinIO)        |    |      (Redis)       |
                |                     |    |                    |
                +---------------------+    +--------------------+
```

### Patrones de Diseño Aplicados

- **Arquitectura MVC (Modelo-Vista-Controlador)**: Separación clara entre la lógica de negocio, la presentación y el control.
- **Patrón Repositorio**: Abstracción del acceso a datos mediante modelos y servicios.
- **Inyección de Dependencias**: Uso de contextos en React y configuración modular en Flask.
- **Patrón Observador**: Implementado mediante hooks de React y eventos en el backend.
- **Patrón Estrategia**: Aplicado en la implementación de diferentes métricas de calidad.

## Componentes Principales

### Frontend

El frontend está desarrollado con React y TypeScript, utilizando Next.js como framework para renderizado del lado del servidor (SSR) y generación estática (SSG).

#### Estructura de Directorios

```
frontend/
├── public/              # Archivos estáticos
├── src/
│   ├── components/      # Componentes reutilizables
│   │   └── layout/      # Componentes de estructura
│   ├── contexts/        # Contextos de React (estado global)
│   ├── hooks/           # Hooks personalizados
│   ├── pages/           # Páginas de la aplicación
│   │   ├── datasets/    # Páginas relacionadas con datasets
│   │   └── projects/    # Páginas relacionadas con proyectos
│   ├── services/        # Servicios para comunicación con API
│   ├── styles/          # Estilos globales
│   ├── types/           # Definiciones de tipos TypeScript
│   └── utils/           # Utilidades y funciones auxiliares
├── .env.local           # Variables de entorno locales
├── next.config.js       # Configuración de Next.js
├── package.json         # Dependencias y scripts
└── tsconfig.json        # Configuración de TypeScript
```

#### Tecnologías Principales

- **React**: Biblioteca para construcción de interfaces de usuario
- **TypeScript**: Superset tipado de JavaScript
- **Next.js**: Framework React para SSR y SSG
- **Material-UI**: Biblioteca de componentes UI
- **Axios**: Cliente HTTP para comunicación con API
- **React Context API**: Gestión de estado global
- **React Hook Form**: Manejo de formularios

### Backend

El backend está desarrollado con Flask (Python), siguiendo una estructura modular y escalable.

#### Estructura de Directorios

```
backend/
├── api/                 # Endpoints de la API
│   ├── auth/            # Autenticación
│   ├── datasets/        # Gestión de datasets
│   ├── evaluations/     # Evaluaciones de calidad
│   ├── metrics/         # Métricas de calidad
│   └── projects/        # Gestión de proyectos
├── models/              # Modelos de datos
├── services/            # Servicios de negocio
├── app.py               # Punto de entrada de la aplicación
├── config.py            # Configuración
├── extensions.py        # Extensiones de Flask
└── requirements.txt     # Dependencias
```

#### Tecnologías Principales

- **Flask**: Framework web ligero para Python
- **SQLAlchemy**: ORM para acceso a base de datos
- **Flask-JWT-Extended**: Autenticación basada en tokens JWT
- **Flask-CORS**: Manejo de CORS
- **Pandas**: Análisis y manipulación de datos
- **Minio**: Cliente para almacenamiento compatible con S3
- **Redis**: Cliente para caché y cola de tareas

### Base de Datos

PostgreSQL es utilizado como sistema de gestión de base de datos relacional.

#### Modelo de Datos

```
+---------------+       +---------------+       +---------------+
|     User      |       |    Project    |       |    Dataset    |
+---------------+       +---------------+       +---------------+
| id            |<----->| id            |<----->| id            |
| username      |       | name          |       | name          |
| email         |       | description   |       | description   |
| password_hash |       | owner_id      |       | project_id    |
| first_name    |       | created_at    |       | file_path     |
| last_name     |       | updated_at    |       | file_size     |
| organization  |       |               |       | row_count     |
| role          |       |               |       | column_count  |
| created_at    |       |               |       | schema        |
| updated_at    |       |               |       | created_at    |
+---------------+       +---------------+       | updated_at    |
                                                +---------------+
                                                        |
                                                        v
+---------------+       +---------------+       +---------------+
|    Metric     |<----->|  Evaluation   |<----->|    Issue      |
+---------------+       +---------------+       +---------------+
| id            |       | id            |       | id            |
| name          |       | dataset_id    |       | evaluation_id |
| description   |       | status        |       | metric_id     |
| category      |       | metrics_config|       | severity      |
| parameters    |       | results       |       | description   |
| created_at    |       | quality_score |       | affected_cols |
| updated_at    |       | started_at    |       | affected_rows |
|               |       | completed_at  |       | created_at    |
|               |       | created_at    |       |               |
|               |       | updated_at    |       |               |
+---------------+       +---------------+       +---------------+
```

### Almacenamiento

MinIO se utiliza como sistema de almacenamiento compatible con S3 para los datasets y otros archivos.

#### Estructura de Buckets

- **datasets**: Almacena los archivos de datos subidos por los usuarios
- **reports**: Almacena informes generados en formato PDF/Excel
- **temp**: Almacenamiento temporal para procesamiento

### Caché y Cola

Redis se utiliza para caché y como sistema de cola para tareas asíncronas.

#### Usos Principales

- Caché de resultados de evaluaciones frecuentes
- Cola de tareas para evaluaciones de calidad en segundo plano
- Almacenamiento de sesiones de usuario
- Limitación de tasa de peticiones

## Funcionalidades

### Autenticación y Gestión de Usuarios

- **Registro de usuarios**: Creación de cuentas con validación de email
- **Inicio de sesión**: Autenticación mediante JWT
- **Gestión de perfiles**: Actualización de información personal
- **Roles y permisos**: Administrador, Usuario, Invitado
- **Recuperación de contraseña**: Flujo seguro de restablecimiento

### Gestión de Proyectos

- **Creación de proyectos**: Definición de nombre, descripción y configuración
- **Listado de proyectos**: Vista de todos los proyectos del usuario
- **Detalles de proyecto**: Información detallada y métricas agregadas
- **Actualización y eliminación**: Gestión del ciclo de vida del proyecto

### Gestión de Datasets

- **Carga de datasets**: Soporte para CSV, Excel, JSON, Parquet
- **Previsualización**: Vista previa de datos con estadísticas básicas
- **Metadatos**: Extracción automática de información estructural
- **Versionado**: Control de versiones de datasets

### Configuración de Métricas

- **Métricas predefinidas**: Conjunto estándar de métricas de calidad
- **Métricas personalizadas**: Definición de métricas específicas
- **Plantillas de métricas**: Agrupación de métricas para casos de uso comunes
- **Umbrales y alertas**: Configuración de niveles de severidad

#### Categorías de Métricas

1. **Completitud**: Valores nulos, vacíos, faltantes
2. **Unicidad**: Duplicados, cardinalidad
3. **Validez**: Conformidad con reglas de negocio, formatos
4. **Consistencia**: Coherencia entre campos relacionados
5. **Precisión**: Exactitud de los valores
6. **Integridad**: Referencias y relaciones
7. **Actualidad**: Frescura de los datos

### Ejecución de Evaluaciones

- **Evaluación manual**: Iniciada por el usuario
- **Evaluación programada**: Ejecución periódica automática
- **Evaluación parcial**: Sobre subconjuntos de datos o métricas
- **Monitorización**: Seguimiento del progreso en tiempo real

### Visualización de Resultados

- **Dashboard general**: Vista agregada de métricas de calidad
- **Informes detallados**: Análisis profundo por dataset
- **Visualizaciones interactivas**: Gráficos y tablas dinámicas
- **Exportación**: Descarga de informes en PDF, Excel, CSV

## Flujos de Trabajo

### Flujo de Registro y Autenticación

1. El usuario accede a la página de registro
2. Completa el formulario con sus datos personales
3. El sistema valida la información y crea la cuenta
4. Se envía un email de confirmación (opcional)
5. El usuario inicia sesión con sus credenciales
6. El sistema genera tokens JWT para autenticación
7. El usuario es redirigido al dashboard

### Flujo de Evaluación de Calidad

1. El usuario crea un nuevo proyecto
2. Sube un dataset al proyecto
3. Configura las métricas de calidad a evaluar
4. Inicia la evaluación
5. El sistema procesa el dataset y aplica las métricas
6. Se generan resultados y se identifican problemas
7. El usuario visualiza el informe de calidad
8. Puede exportar resultados o configurar alertas

## Buenas Prácticas Implementadas

### Arquitectura y Diseño

- **Separación de Responsabilidades**: Clara división entre componentes
- **Principio SOLID**: Aplicación de principios de diseño orientado a objetos
- **DRY (Don't Repeat Yourself)**: Reutilización de código mediante componentes y servicios
- **KISS (Keep It Simple, Stupid)**: Soluciones simples y directas
- **Arquitectura por Capas**: Presentación, lógica de negocio, acceso a datos

### Desarrollo Frontend

- **Componentes Atómicos**: Diseño modular y reutilizable
- **Tipado Estricto**: Uso consistente de TypeScript
- **Gestión de Estado**: Uso adecuado de Context API y hooks
- **Renderizado Eficiente**: Memoización y optimización de renderizado
- **Accesibilidad**: Cumplimiento de WCAG 2.1 AA
- **Diseño Responsivo**: Adaptación a diferentes dispositivos

### Desarrollo Backend

- **RESTful API**: Diseño de API siguiendo principios REST
- **Validación de Entrada**: Verificación rigurosa de datos de entrada
- **Manejo de Errores**: Respuestas de error estructuradas y descriptivas
- **Documentación de API**: Especificación OpenAPI/Swagger
- **Logging**: Registro detallado de actividades y errores
- **Transacciones**: Garantía de consistencia en operaciones de base de datos

### Seguridad

- **Autenticación JWT**: Tokens seguros con expiración
- **Protección CSRF**: Prevención de ataques Cross-Site Request Forgery
- **Sanitización de Entrada**: Prevención de inyección SQL y XSS
- **Encriptación de Contraseñas**: Uso de algoritmos seguros (bcrypt)
- **HTTPS**: Comunicación cifrada
- **Principio de Mínimo Privilegio**: Acceso restringido según roles

### Calidad de Código

- **Linting**: Uso de ESLint y Pylint
- **Formateo**: Prettier y Black para formato consistente
- **Convenciones de Nombrado**: Nomenclatura clara y descriptiva
- **Comentarios y Documentación**: Documentación de código y funciones
- **Control de Versiones**: Uso efectivo de Git con mensajes descriptivos

## Guía de Instalación y Despliegue

### Requisitos Previos

- Docker y Docker Compose
- Git
- Espacio en disco: mínimo 2GB
- Memoria RAM: mínimo 4GB

### Instalación Local

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/AlexSaiz222/TFG_CALIDAD_DATOS_IA.git
   cd TFG_CALIDAD_DATOS_IA
   ```

2. Configurar variables de entorno:
   ```bash
   cp frontend/.env.example frontend/.env.local
   cp backend/.env.example backend/.env
   ```

3. Iniciar los servicios con Docker Compose:
   ```bash
   docker-compose up -d
   ```

4. Acceder a la aplicación:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - MinIO Console: http://localhost:9001 (usuario: minioadmin, contraseña: minioadmin)

### Despliegue en Producción

Para un entorno de producción, se recomienda:

1. Utilizar un servicio de orquestación como Kubernetes
2. Configurar balanceadores de carga
3. Implementar monitorización con Prometheus/Grafana
4. Configurar copias de seguridad automatizadas
5. Utilizar certificados SSL válidos
6. Configurar variables de entorno seguras

## Guía de Desarrollo

### Configuración del Entorno de Desarrollo

#### Frontend

1. Instalar dependencias:
   ```bash
   cd frontend
   npm install
   ```

2. Iniciar servidor de desarrollo:
   ```bash
   npm run dev
   ```

#### Backend

1. Crear entorno virtual:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # En Windows: venv\Scripts\activate
   ```

2. Instalar dependencias:
   ```bash
   pip install -r requirements.txt
   ```

3. Iniciar servidor de desarrollo:
   ```bash
   python app.py
   ```

### Flujo de Trabajo Git

1. Crear rama para nueva funcionalidad:
   ```bash
   git checkout -b feature/nombre-funcionalidad
   ```

2. Realizar cambios y commits:
   ```bash
   git add .
   git commit -m "Descripción clara del cambio"
   ```

3. Enviar cambios al repositorio:
   ```bash
   git push origin feature/nombre-funcionalidad
   ```

4. Crear Pull Request para revisión

### Convenciones de Código

#### Frontend (JavaScript/TypeScript)

- Utilizar camelCase para variables y funciones
- Utilizar PascalCase para componentes React
- Utilizar UPPER_CASE para constantes
- Preferir funciones de flecha
- Documentar componentes con JSDoc

#### Backend (Python)

- Seguir PEP 8
- Utilizar snake_case para variables y funciones
- Utilizar CamelCase para clases
- Documentar funciones con docstrings
- Limitar líneas a 88 caracteres (Black)

## Pruebas

### Tipos de Pruebas

- **Pruebas Unitarias**: Verificación de componentes individuales
- **Pruebas de Integración**: Verificación de interacción entre componentes
- **Pruebas E2E**: Verificación de flujos completos
- **Pruebas de Rendimiento**: Verificación de tiempos de respuesta y carga

### Herramientas de Prueba

- **Frontend**: Jest, React Testing Library
- **Backend**: Pytest
- **E2E**: Cypress
- **Rendimiento**: Locust

### Ejecución de Pruebas

#### Frontend

```bash
cd frontend
npm test
```

#### Backend

```bash
cd backend
pytest
```

## Seguridad

### Mejores Prácticas Implementadas

- Autenticación basada en tokens JWT con expiración
- Almacenamiento seguro de contraseñas con bcrypt
- Validación y sanitización de entradas de usuario
- Protección contra ataques CSRF, XSS e inyección SQL
- Implementación de CORS con origen restringido
- Principio de mínimo privilegio en permisos

### Auditoría y Logging

- Registro de acciones críticas (login, cambios en datos)
- Timestamps precisos para todas las operaciones
- Información de contexto (IP, agente de usuario)
- Rotación de logs y retención configurables

## Escalabilidad y Rendimiento

### Estrategias de Escalabilidad

- Arquitectura de microservicios para escalado horizontal
- Caché de Redis para resultados frecuentes
- Procesamiento asíncrono para tareas intensivas
- Paginación y carga diferida de datos

### Optimizaciones de Rendimiento

- Indexación adecuada en base de datos
- Compresión de respuestas HTTP
- Lazy loading de componentes React
- Optimización de consultas SQL

## Mantenimiento y Evolución

### Monitorización

- Healthchecks para todos los servicios
- Métricas de rendimiento y uso
- Alertas automáticas para problemas críticos
- Dashboard de estado del sistema

### Actualizaciones y Versionado

- Versionado semántico (SemVer)
- Changelog detallado
- Migraciones de base de datos automatizadas
- Estrategia de despliegue blue-green

### Roadmap Futuro

- Integración con herramientas de BI
- Soporte para más formatos de datos
- Implementación de aprendizaje automático para detección de anomalías
- API pública con documentación completa
- Integración con sistemas CI/CD
- Soporte para múltiples idiomas

---

## Conclusión

La Plataforma de Evaluación de Calidad de Datos para Proyectos de IA proporciona una solución completa para la gestión y evaluación de la calidad de datos en proyectos de inteligencia artificial. Su arquitectura modular, enfoque en buenas prácticas de desarrollo y diseño centrado en el usuario la convierten en una herramienta valiosa para equipos técnicos y de negocio que buscan mejorar la calidad de sus datos y, por ende, el rendimiento de sus modelos de IA.

El proyecto sigue un enfoque de desarrollo iterativo, con un MVP inicial que cubre las funcionalidades esenciales y un roadmap claro para futuras mejoras y expansiones. La documentación detallada, las pruebas automatizadas y las prácticas de seguridad implementadas garantizan un producto robusto y mantenible a largo plazo.
