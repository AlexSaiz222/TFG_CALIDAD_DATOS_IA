# Arquitectura del Sistema: Plataforma de Evaluación de Calidad de Datos

## Índice
1. [Visión General](#visión-general)
2. [Arquitectura de Componentes](#arquitectura-de-componentes)
3. [Flujo de Datos](#flujo-de-datos)
4. [Patrones de Diseño](#patrones-de-diseño)
5. [Comunicación entre Componentes](#comunicación-entre-componentes)
6. [Escalabilidad](#escalabilidad)
7. [Seguridad](#seguridad)
8. [Despliegue](#despliegue)
9. [Monitorización](#monitorización)
10. [Consideraciones Técnicas](#consideraciones-técnicas)

## Visión General

La Plataforma de Evaluación de Calidad de Datos para Proyectos de IA sigue una arquitectura moderna de microservicios, con separación clara entre frontend y backend. Esta arquitectura permite el desarrollo independiente de componentes, facilita el escalado horizontal y vertical, y mejora la mantenibilidad del sistema.

### Diagrama de Arquitectura de Alto Nivel

```
+------------------+        +------------------+        +------------------+
|                  |        |                  |        |                  |
|    Frontend      |<------>|     Backend      |<------>|    Database      |
|  (Next.js/React) |   API  |     (Flask)      |   ORM  |  (PostgreSQL)    |
|                  |        |                  |        |                  |
+------------------+        +------------------+        +------------------+
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

## Arquitectura de Componentes

### Frontend (Next.js/React)

El frontend está construido como una Single Page Application (SPA) utilizando React y Next.js, lo que proporciona renderizado del lado del servidor (SSR) y generación estática (SSG) para mejorar el rendimiento y SEO.

#### Componentes Principales:

1. **Páginas**: Componentes de nivel superior que representan rutas de la aplicación
2. **Componentes**: Elementos reutilizables de la interfaz de usuario
3. **Contextos**: Gestión de estado global utilizando React Context API
4. **Servicios**: Módulos para comunicación con la API del backend
5. **Hooks**: Lógica reutilizable para componentes funcionales
6. **Utilidades**: Funciones auxiliares para operaciones comunes

#### Estructura de Directorios:

```
frontend/
├── public/              # Archivos estáticos
├── src/
│   ├── components/      # Componentes reutilizables
│   │   ├── common/      # Componentes genéricos
│   │   ├── forms/       # Componentes de formularios
│   │   ├── layout/      # Componentes de estructura
│   │   └── charts/      # Componentes de visualización
│   ├── contexts/        # Contextos de React
│   ├── hooks/           # Hooks personalizados
│   ├── pages/           # Páginas de la aplicación
│   ├── services/        # Servicios para API
│   ├── styles/          # Estilos globales
│   ├── types/           # Definiciones de tipos
│   └── utils/           # Utilidades
└── ...
```

### Backend (Flask)

El backend está implementado como una API RESTful utilizando Flask, con una estructura modular que separa claramente las responsabilidades.

#### Componentes Principales:

1. **API Routes**: Endpoints HTTP para interacción con el frontend
2. **Models**: Definiciones de modelos de datos y esquemas
3. **Services**: Lógica de negocio y procesamiento
4. **Extensions**: Configuración de extensiones de Flask
5. **Utils**: Funciones auxiliares y utilidades

#### Estructura de Directorios:

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
│   ├── data_processing/ # Procesamiento de datos
│   ├── evaluation/      # Evaluación de calidad
│   ├── storage/         # Gestión de almacenamiento
│   └── notification/    # Notificaciones
├── utils/               # Utilidades
├── app.py               # Punto de entrada
├── config.py            # Configuración
└── extensions.py        # Extensiones de Flask
```

### Base de Datos (PostgreSQL)

PostgreSQL se utiliza como sistema de gestión de base de datos relacional, proporcionando durabilidad, transacciones ACID y soporte para tipos de datos avanzados como JSON y arrays.

#### Esquema de Base de Datos:

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

### Almacenamiento (MinIO)

MinIO proporciona almacenamiento compatible con S3 para datasets, informes y archivos temporales.

#### Estructura de Buckets:

- **datasets**: Almacena los archivos de datos subidos por los usuarios
- **reports**: Almacena informes generados en formato PDF/Excel
- **temp**: Almacenamiento temporal para procesamiento

### Caché y Cola (Redis)

Redis se utiliza para caché de resultados frecuentes y como sistema de cola para tareas asíncronas.

#### Usos Principales:

- **Caché**: Resultados de evaluaciones, datos de sesión
- **Cola**: Tareas de evaluación de calidad en segundo plano
- **Pub/Sub**: Notificaciones en tiempo real
- **Rate Limiting**: Limitación de tasa de peticiones

## Flujo de Datos

### Carga y Evaluación de Datasets

```
+-------------+     +-------------+     +-------------+     +-------------+
|             |     |             |     |             |     |             |
|  Frontend   |---->|   Backend   |---->|   Storage   |---->|  Processing |
|  (Upload)   |     |   (API)     |     |   (MinIO)   |     |  Service    |
|             |     |             |     |             |     |             |
+-------------+     +-------------+     +-------------+     +-------------+
                                                                  |
                                                                  v
+-------------+     +-------------+     +-------------+     +-------------+
|             |     |             |     |             |     |             |
|  Frontend   |<----|   Backend   |<----|  Database   |<----|  Evaluation |
| (Dashboard) |     |   (API)     |     | (PostgreSQL)|     |  Results    |
|             |     |             |     |             |     |             |
+-------------+     +-------------+     +-------------+     +-------------+
```

1. El usuario sube un dataset a través de la interfaz web
2. El frontend envía el archivo al backend mediante una solicitud HTTP multipart
3. El backend valida el archivo y lo almacena en MinIO
4. El backend registra el dataset en la base de datos
5. El usuario configura y ejecuta una evaluación de calidad
6. El backend encola la tarea de evaluación en Redis
7. Un worker procesa la evaluación en segundo plano
8. Los resultados se almacenan en la base de datos
9. El frontend consulta los resultados y los muestra en dashboards

### Autenticación y Autorización

```
+-------------+     +-------------+     +-------------+
|             |     |             |     |             |
|  Frontend   |---->|   Backend   |---->|  Database   |
|  (Login)    |     |   (Auth)    |     |  (Users)    |
|             |     |             |     |             |
+-------------+     +-------------+     +-------------+
       ^                   |
       |                   v
       |            +-------------+
       |            |             |
       +------------| JWT Tokens  |
                    |             |
                    +-------------+
```

1. El usuario envía credenciales (username/password)
2. El backend valida las credenciales contra la base de datos
3. Si son válidas, genera tokens JWT (access + refresh)
4. Los tokens se envían al frontend
5. El frontend almacena los tokens y los incluye en solicitudes posteriores
6. El backend valida los tokens en cada solicitud protegida

## Patrones de Diseño

### Patrón MVC (Modelo-Vista-Controlador)

- **Modelo**: Representado por los modelos SQLAlchemy en el backend
- **Vista**: Componentes React en el frontend
- **Controlador**: Rutas de API en el backend

### Patrón Repositorio

Implementado para abstraer el acceso a datos y separar la lógica de negocio de la capa de persistencia.

```python
# Ejemplo de implementación del patrón repositorio
class DatasetRepository:
    def get_by_id(self, dataset_id):
        return Dataset.query.get(dataset_id)
    
    def get_by_project(self, project_id):
        return Dataset.query.filter_by(project_id=project_id).all()
    
    def create(self, dataset_data):
        dataset = Dataset(**dataset_data)
        db.session.add(dataset)
        db.session.commit()
        return dataset
    
    def update(self, dataset_id, dataset_data):
        dataset = self.get_by_id(dataset_id)
        for key, value in dataset_data.items():
            setattr(dataset, key, value)
        db.session.commit()
        return dataset
    
    def delete(self, dataset_id):
        dataset = self.get_by_id(dataset_id)
        db.session.delete(dataset)
        db.session.commit()
```

### Patrón Fachada

Implementado en los servicios del backend para proporcionar una interfaz simplificada a subsistemas complejos.

```python
# Ejemplo de implementación del patrón fachada
class EvaluationService:
    def __init__(self):
        self.dataset_repository = DatasetRepository()
        self.metric_repository = MetricRepository()
        self.storage_service = StorageService()
        self.processor_factory = DataProcessorFactory()
    
    def evaluate_dataset(self, dataset_id, metrics_config):
        dataset = self.dataset_repository.get_by_id(dataset_id)
        data = self.storage_service.load_dataset(dataset.file_path)
        
        processor = self.processor_factory.get_processor(dataset.file_type)
        processed_data = processor.process(data)
        
        results = {}
        for metric_id, config in metrics_config.items():
            metric = self.metric_repository.get_by_id(metric_id)
            metric_service = MetricServiceFactory.create(metric.category)
            results[metric_id] = metric_service.calculate(processed_data, config)
        
        return results
```

### Patrón Estrategia

Utilizado para implementar diferentes algoritmos de evaluación de calidad de datos.

```python
# Ejemplo de implementación del patrón estrategia
class CompletenessStrategy:
    def calculate(self, data, config):
        # Implementación específica para métricas de completitud
        pass

class UniquenessStrategy:
    def calculate(self, data, config):
        # Implementación específica para métricas de unicidad
        pass

class MetricStrategyFactory:
    @staticmethod
    def create_strategy(category):
        if category == 'completeness':
            return CompletenessStrategy()
        elif category == 'uniqueness':
            return UniquenessStrategy()
        # Más estrategias...
```

### Patrón Observador

Implementado mediante React Context y hooks en el frontend para gestionar el estado y las actualizaciones.

```typescript
// Ejemplo de implementación del patrón observador con React Context
const EvaluationContext = createContext<EvaluationContextType | undefined>(undefined);

export const EvaluationProvider: React.FC = ({ children }) => {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchEvaluations = async (datasetId: number) => {
    setLoading(true);
    try {
      const response = await evaluationsAPI.getEvaluations(datasetId);
      setEvaluations(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch evaluations');
    } finally {
      setLoading(false);
    }
  };
  
  // Más funciones...
  
  return (
    <EvaluationContext.Provider value={{ 
      evaluations, 
      loading, 
      error, 
      fetchEvaluations 
    }}>
      {children}
    </EvaluationContext.Provider>
  );
};

// Hook personalizado para usar el contexto
export const useEvaluation = () => {
  const context = useContext(EvaluationContext);
  if (context === undefined) {
    throw new Error('useEvaluation must be used within an EvaluationProvider');
  }
  return context;
};
```

## Comunicación entre Componentes

### API RESTful

La comunicación entre frontend y backend se realiza mediante una API RESTful con los siguientes endpoints principales:

#### Autenticación

- `POST /api/auth/register`: Registro de nuevos usuarios
- `POST /api/auth/login`: Inicio de sesión
- `POST /api/auth/refresh`: Renovación de token de acceso
- `GET /api/auth/me`: Obtención de perfil de usuario

#### Proyectos

- `GET /api/projects`: Listado de proyectos
- `POST /api/projects`: Creación de proyecto
- `GET /api/projects/:id`: Detalles de proyecto
- `PUT /api/projects/:id`: Actualización de proyecto
- `DELETE /api/projects/:id`: Eliminación de proyecto

#### Datasets

- `GET /api/projects/:id/datasets`: Listado de datasets por proyecto
- `POST /api/projects/:id/datasets/upload`: Carga de dataset
- `GET /api/datasets/:id`: Detalles de dataset
- `GET /api/datasets/:id/preview`: Vista previa de dataset
- `DELETE /api/datasets/:id`: Eliminación de dataset

#### Métricas

- `GET /api/metrics`: Listado de métricas disponibles
- `GET /api/metric-templates`: Listado de plantillas de métricas
- `POST /api/metric-templates`: Creación de plantilla personalizada

#### Evaluaciones

- `POST /api/datasets/:id/evaluations`: Creación de evaluación
- `GET /api/datasets/:id/evaluations`: Listado de evaluaciones por dataset
- `GET /api/evaluations/:id`: Detalles de evaluación
- `GET /api/evaluations/:id/issues`: Problemas detectados en evaluación

### Formato de Respuestas

Todas las respuestas de la API siguen un formato consistente:

```json
{
  "success": true,
  "data": {
    // Datos específicos de la respuesta
  },
  "message": "Operación completada con éxito"
}
```

En caso de error:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descripción del error"
  }
}
```

### Manejo de Errores

La API implementa un manejo de errores consistente con códigos HTTP apropiados:

- `400 Bad Request`: Errores de validación
- `401 Unauthorized`: Errores de autenticación
- `403 Forbidden`: Errores de autorización
- `404 Not Found`: Recurso no encontrado
- `409 Conflict`: Conflicto (ej. duplicado)
- `422 Unprocessable Entity`: Datos válidos pero no procesables
- `500 Internal Server Error`: Errores internos del servidor

## Escalabilidad

La arquitectura está diseñada para escalar horizontal y verticalmente:

### Escalado Horizontal

- **Frontend**: Despliegue en múltiples instancias detrás de un balanceador de carga
- **Backend**: API stateless que permite múltiples instancias
- **Workers**: Procesamiento distribuido de tareas mediante Redis
- **Base de Datos**: Replicación y particionamiento

### Escalado Vertical

- **Optimización de Recursos**: Configuración de límites de memoria y CPU
- **Caché**: Implementación de estrategias de caché para reducir carga
- **Procesamiento Asíncrono**: Tareas intensivas ejecutadas en segundo plano

### Estrategias de Escalabilidad

1. **Procesamiento por Lotes**: División de datasets grandes en fragmentos manejables
2. **Evaluación Incremental**: Procesamiento de cambios en lugar de datasets completos
3. **Caché Multinivel**: Caché de resultados frecuentes en diferentes niveles
4. **Compresión**: Reducción del tamaño de datos transferidos

## Seguridad

### Autenticación y Autorización

- **JWT**: Tokens de acceso de corta duración y tokens de refresco
- **RBAC**: Control de acceso basado en roles (Admin, User, Guest)
- **Validación**: Verificación de permisos en cada operación

### Protección de Datos

- **Encriptación en Tránsito**: HTTPS para todas las comunicaciones
- **Encriptación en Reposo**: Datos sensibles encriptados en la base de datos
- **Sanitización**: Validación y limpieza de todas las entradas de usuario

### Medidas de Seguridad Adicionales

- **Rate Limiting**: Limitación de tasa de peticiones para prevenir abusos
- **CORS**: Configuración adecuada de Cross-Origin Resource Sharing
- **CSP**: Content Security Policy para prevenir XSS
- **Auditoría**: Registro de acciones críticas para trazabilidad

## Despliegue

### Entorno de Desarrollo

```
+-------------+     +-------------+     +-------------+
|             |     |             |     |             |
|  Frontend   |     |   Backend   |     |  Database   |
|  (npm dev)  |     |  (Flask)    |     | (PostgreSQL)|
|             |     |             |     |             |
+-------------+     +-------------+     +-------------+
      |                   |                   |
      v                   v                   v
+-----------------------------------------------------+
|                                                     |
|                  Docker Compose                     |
|                                                     |
+-----------------------------------------------------+
```

### Entorno de Producción

```
+-------------+     +-------------+     +-------------+
|             |     |             |     |             |
|   Nginx     |---->| API Server  |---->|  Database   |
| (Frontend)  |     | (Backend)   |     | (PostgreSQL)|
|             |     |             |     |             |
+-------------+     +-------------+     +-------------+
                          |
                          v
                  +-------------+     +-------------+
                  |             |     |             |
                  |   Workers   |<--->|    Redis    |
                  |             |     |             |
                  +-------------+     +-------------+
                          |
                          v
                  +-------------+
                  |             |
                  |    MinIO    |
                  |             |
                  +-------------+
```

### Configuración de Docker Compose

```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=/api
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - FLASK_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/dataquality
      - REDIS_URL=redis://redis:6379/0
      - MINIO_URL=minio:9000
      - MINIO_ACCESS_KEY=minioadmin
      - MINIO_SECRET_KEY=minioadmin
    depends_on:
      - postgres
      - redis
      - minio

  worker:
    build: ./backend
    command: python worker.py
    environment:
      - FLASK_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/dataquality
      - REDIS_URL=redis://redis:6379/0
      - MINIO_URL=minio:9000
      - MINIO_ACCESS_KEY=minioadmin
      - MINIO_SECRET_KEY=minioadmin
    depends_on:
      - postgres
      - redis
      - minio

  postgres:
    image: postgres:13
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=dataquality
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  minio:
    image: minio/minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

## Monitorización

### Healthchecks

Cada componente expone un endpoint de healthcheck para verificar su estado:

- **Frontend**: `/api/health`
- **Backend**: `/health`
- **Base de Datos**: Verificación de conexión
- **Redis**: Verificación de ping
- **MinIO**: Verificación de acceso a buckets

### Logging

Sistema de logging centralizado con diferentes niveles:

- **ERROR**: Errores críticos que requieren atención inmediata
- **WARNING**: Situaciones anómalas pero no críticas
- **INFO**: Información general sobre operaciones
- **DEBUG**: Información detallada para depuración

### Métricas

Recopilación de métricas clave para monitorizar el rendimiento:

- **Tiempos de Respuesta**: Latencia de endpoints de API
- **Tasas de Error**: Porcentaje de solicitudes fallidas
- **Uso de Recursos**: CPU, memoria, disco, red
- **Métricas de Negocio**: Usuarios activos, evaluaciones realizadas, etc.

## Consideraciones Técnicas

### Gestión de Dependencias

- **Frontend**: npm/yarn para gestión de paquetes JavaScript
- **Backend**: pip/requirements.txt para gestión de paquetes Python
- **Versionado**: Especificación explícita de versiones para evitar incompatibilidades

### Compatibilidad de Navegadores

- Soporte para navegadores modernos (últimas 2 versiones)
- Polyfills para funcionalidades no soportadas en navegadores antiguos
- Diseño responsivo para diferentes dispositivos y tamaños de pantalla

### Rendimiento

- **Code Splitting**: División del código JavaScript para carga bajo demanda
- **Lazy Loading**: Carga diferida de componentes y recursos
- **Optimización de Imágenes**: Compresión y formatos modernos (WebP)
- **Minificación**: Reducción del tamaño de archivos CSS y JavaScript

### Accesibilidad

- Cumplimiento de WCAG 2.1 nivel AA
- Estructura semántica de HTML
- Soporte para lectores de pantalla
- Navegación por teclado

---

## Conclusión

La arquitectura del sistema de la Plataforma de Evaluación de Calidad de Datos para Proyectos de IA está diseñada para proporcionar una solución robusta, escalable y mantenible. La separación clara de responsabilidades, el uso de patrones de diseño probados y la implementación de buenas prácticas de desarrollo garantizan un sistema que puede evolucionar y adaptarse a las necesidades cambiantes.

La combinación de tecnologías modernas como React/Next.js en el frontend y Flask en el backend, junto con servicios complementarios como PostgreSQL, MinIO y Redis, proporciona una base sólida para la implementación de todas las funcionalidades requeridas, desde la gestión de usuarios y proyectos hasta la evaluación de calidad de datos y la visualización de resultados.
