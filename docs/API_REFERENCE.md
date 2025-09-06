# Referencia de la API REST

## Introducción

Esta documentación describe la API REST de la Plataforma de Evaluación de Calidad de Datos para Proyectos de IA. La API proporciona acceso programático a todas las funcionalidades de la plataforma, permitiendo la gestión de usuarios, proyectos, datasets, métricas y evaluaciones de calidad.

### Base URL

```
Desarrollo: http://localhost:5000/api
Producción: https://[dominio-produccion]/api
```

### Formato de Respuestas

Todas las respuestas de la API siguen un formato consistente:

**Respuesta exitosa:**

```json
{
  "success": true,
  "data": {
    // Datos específicos de la respuesta
  },
  "message": "Operación completada con éxito"
}
```

**Respuesta de error:**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descripción del error"
  }
}
```

### Autenticación

La API utiliza autenticación basada en tokens JWT (JSON Web Tokens). Para acceder a endpoints protegidos, se debe incluir el token de acceso en el encabezado de la solicitud:

```
Authorization: Bearer <access_token>
```

El flujo de autenticación es el siguiente:

1. El usuario se registra o inicia sesión para obtener un par de tokens (access_token y refresh_token)
2. El access_token se utiliza para autenticar solicitudes a endpoints protegidos
3. Cuando el access_token expira, se utiliza el refresh_token para obtener un nuevo par de tokens
4. Si el refresh_token también expira, el usuario debe iniciar sesión nuevamente

## Índice de Endpoints

La documentación detallada de cada grupo de endpoints se encuentra en archivos separados:

1. [Endpoints de Autenticación](./API_AUTH.md)
   - Registro de usuario
   - Inicio de sesión
   - Renovación de token
   - Obtención de perfil
   - Actualización de perfil
   - Cambio de contraseña
   - Cierre de sesión

2. [Endpoints de Proyectos](./API_PROJECTS.md)
   - Listado de proyectos
   - Creación de proyecto
   - Detalles de proyecto
   - Actualización de proyecto
   - Eliminación de proyecto

3. [Endpoints de Datasets](./API_DATASETS.md)
   - Listado de datasets
   - Carga de dataset
   - Detalles de dataset
   - Vista previa de dataset
   - Eliminación de dataset

4. [Endpoints de Métricas](./API_METRICS.md)
   - Listado de métricas disponibles
   - Detalles de métrica
   - Plantillas de métricas
   - `GET /api/metrics/templates`: Listado de plantillas de métricas
   - `GET /api/metrics/templates/{id}`: Obtener una plantilla específica
   - `POST /api/metrics/templates`: Creación de plantilla personalizada
   - `PUT /api/metrics/templates/{id}`: Actualizar una plantilla existente
   - `DELETE /api/metrics/templates/{id}`: Eliminar una plantilla

5. [Endpoints de Evaluaciones](./API_EVALUATIONS.md)
   - Creación de evaluación
   - Listado de evaluaciones
   - Detalles de evaluación
   - Problemas detectados
   - Exportación de resultados

## Códigos de Error Comunes

| Código HTTP | Código de Error | Descripción |
|-------------|----------------|-------------|
| 400 | INVALID_DATA | Datos de solicitud inválidos o incompletos |
| 401 | UNAUTHORIZED | No autenticado o token inválido |
| 403 | FORBIDDEN | No tiene permisos para acceder al recurso |
| 404 | NOT_FOUND | Recurso no encontrado |
| 409 | CONFLICT | Conflicto con el estado actual del recurso |
| 422 | UNPROCESSABLE_ENTITY | Datos válidos pero no procesables |
| 429 | TOO_MANY_REQUESTS | Demasiadas solicitudes (rate limiting) |
| 500 | SERVER_ERROR | Error interno del servidor |

## Paginación

Para endpoints que devuelven listas de recursos, la API implementa paginación mediante parámetros de consulta:

```
GET /api/projects?page=1&per_page=10
```

La respuesta incluye metadatos de paginación:

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "per_page": 10,
      "total_items": 45,
      "total_pages": 5
    }
  },
  "message": "Recursos obtenidos correctamente"
}
```

## Filtrado y Ordenación

Muchos endpoints soportan filtrado y ordenación mediante parámetros de consulta:

```
GET /api/projects?sort=created_at:desc&filter=name:contains:calidad
```

## Versionado

La API está versionada mediante el prefijo en la URL. La versión actual es `v1` y está implícita en la base URL (`/api`).

## Límites de Tasa (Rate Limiting)

Para proteger la API contra abusos, se implementan límites de tasa:

- 100 solicitudes por minuto para endpoints públicos
- 300 solicitudes por minuto para endpoints autenticados

Las respuestas incluyen encabezados con información sobre los límites:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1629380000
```

## Ejemplos de Uso

### Flujo de Autenticación

```javascript
// 1. Registro de usuario
const registerResponse = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'usuario_ejemplo',
    email: 'usuario@ejemplo.com',
    password: 'contraseña_segura',
    first_name: 'Nombre',
    last_name: 'Apellido'
  })
});

const registerData = await registerResponse.json();
const { access_token, refresh_token } = registerData.data.tokens;

// 2. Uso del token para acceder a recursos protegidos
const projectsResponse = await fetch('/api/projects', {
  headers: { 'Authorization': `Bearer ${access_token}` }
});

// 3. Renovación de token cuando expira
const refreshResponse = await fetch('/api/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refresh_token })
});

const refreshData = await refreshResponse.json();
const newTokens = refreshData.data.tokens;
```

### Creación y Evaluación de un Dataset

```javascript
// 1. Crear un proyecto
const projectResponse = await fetch('/api/projects', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Proyecto de Ejemplo',
    description: 'Descripción del proyecto'
  })
});

const projectData = await projectResponse.json();
const projectId = projectData.data.project.id;

// 2. Subir un dataset
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('name', 'Dataset de Ejemplo');
formData.append('description', 'Descripción del dataset');

const datasetResponse = await fetch(`/api/projects/${projectId}/datasets/upload`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${access_token}` },
  body: formData
});

const datasetData = await datasetResponse.json();
const datasetId = datasetData.data.dataset.id;

// 3. Crear una evaluación
const evaluationResponse = await fetch(`/api/datasets/${datasetId}/evaluations`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    metrics_config: {
      completeness: { enabled: true, threshold: 95 },
      uniqueness: { enabled: true, columns: ['id', 'email'] }
    }
  })
});

const evaluationData = await evaluationResponse.json();
const evaluationId = evaluationData.data.evaluation.id;

// 4. Consultar resultados de la evaluación
const resultsResponse = await fetch(`/api/evaluations/${evaluationId}`, {
  headers: { 'Authorization': `Bearer ${access_token}` }
});

const resultsData = await resultsResponse.json();
console.log(resultsData.data.evaluation.results);
```

## Herramientas y Recursos

- [Colección de Postman](./postman_collection.json): Colección de Postman con ejemplos de todas las llamadas a la API
- [Swagger UI](http://localhost:5000/api/docs): Documentación interactiva de la API (solo en entorno de desarrollo)
- [Ejemplos de Código](./examples): Ejemplos de código en diferentes lenguajes

## Soporte y Contacto

Si encuentras problemas con la API o tienes preguntas, por favor contacta al equipo de desarrollo:

- Email: soporte@dataquality.example.com
- GitHub: [Reportar un problema](https://github.com/ejemplo/data-quality-platform/issues)
