# Interfaz de Configuración de Métricas

Este documento describe la interfaz de usuario para la configuración de métricas de calidad de datos en la plataforma.

## Estructura General

La interfaz de configuración de métricas está organizada en tres pestañas principales:

1. **Métricas Disponibles**: Lista todas las métricas con opciones de filtrado por categoría y búsqueda
2. **Métricas Seleccionadas**: Muestra las métricas configuradas para el proyecto actual
3. **Plantillas**: Permite gestionar plantillas de configuraciones de métricas

## Navegación

El acceso a la configuración de métricas se realiza desde la página de detalles del proyecto mediante el botón "Configure Metrics". Este botón navega a la ruta `/metrics/configure/{project_id}`.

### Implementación de Navegación

La navegación implementa múltiples capas de seguridad para garantizar que el ID del proyecto siempre esté disponible:

```typescript
// En la página de detalles del proyecto
const handleConfigureMetrics = () => {
  // Obtener ID del proyecto de múltiples fuentes
  const projectIdToUse = project?.id || router.query.id || localStorage.getItem('currentProjectId');
  
  // Guardar ID en localStorage como respaldo
  if (projectIdToUse) {
    localStorage.setItem('currentProjectId', projectIdToUse.toString());
  }
  
  // Navegar a la página de configuración
  router.push(`/metrics/configure/${projectIdToUse}`);
};
```

## Pestaña de Métricas Disponibles

Esta pestaña muestra todas las métricas disponibles en el sistema, organizadas por categorías.

### Características:

- **Filtrado por Categoría**: Permite filtrar métricas por su categoría (completitud, unicidad, consistencia, etc.)
- **Búsqueda**: Permite buscar métricas por nombre o descripción
- **Selección**: Permite añadir métricas a la configuración del proyecto actual
- **Vista Detallada**: Muestra información detallada de cada métrica al hacer clic en ella

## Pestaña de Métricas Seleccionadas

Esta pestaña muestra las métricas que han sido seleccionadas para el proyecto actual.

### Características:

- **Lista de Métricas**: Muestra todas las métricas configuradas para el proyecto
- **Configuración de Parámetros**: Permite configurar los parámetros específicos de cada métrica mediante un diálogo dedicado
- **Configuración de Umbrales**: Permite establecer umbrales de advertencia y error para cada métrica
- **Eliminación**: Permite eliminar métricas de la configuración
- **Guardado**: Permite guardar la configuración actual en el servidor

### Diálogo de Configuración de Parámetros

Para cada métrica seleccionada, se puede abrir un diálogo que permite configurar sus parámetros específicos:

- Selección de columnas a evaluar
- Configuración de patrones de validación
- Establecimiento de umbrales específicos
- Otras opciones dependiendo del tipo de métrica

## Pestaña de Plantillas

Esta pestaña permite gestionar plantillas de configuraciones de métricas para reutilizarlas en diferentes proyectos.

### Características:

- **Lista de Plantillas**: Muestra todas las plantillas disponibles
- **Creación**: Permite crear nuevas plantillas basadas en la configuración actual
- **Aplicación**: Permite aplicar una plantilla al proyecto actual
- **Eliminación**: Permite eliminar plantillas existentes

## Manejo de Estados

La interfaz implementa un manejo robusto de diferentes estados:

### Estados de Carga

- **Carga Inicial**: Muestra un indicador de carga mientras se obtienen las métricas y la configuración
- **Guardado**: Muestra un indicador durante el proceso de guardado
- **Aplicación de Plantilla**: Muestra un indicador durante la aplicación de una plantilla

### Prevención de Carga Indefinida

Para evitar estados de carga indefinida, se implementan las siguientes medidas:

- **Timeouts**: Se establece un timeout de 15 segundos para las operaciones de carga
- **Seguimiento de Montaje**: Se utiliza una referencia para seguir si el componente está montado
- **Botón de Cancelación**: Se proporciona un botón para cancelar operaciones de larga duración
- **Carga en Paralelo**: Se utilizan Promise.allSettled para cargar datos en paralelo
- **Reintentos**: Se implementa un mecanismo de reintento con backoff exponencial

### Manejo de Errores

- **Errores de Carga**: Se muestran mensajes de error descriptivos cuando falla la carga de datos
- **Errores de Guardado**: Se notifican errores durante el guardado de configuraciones
- **Errores 404**: Se manejan silenciosamente los errores 404 en la carga de plantillas

## Obtención del ID del Proyecto

La interfaz implementa múltiples capas de fallback para garantizar que el ID del proyecto siempre esté disponible:

1. **Obtención desde URL**: Se extrae el ID del proyecto de router.query
2. **Fallback a localStorage**: Si no está en la URL, se obtiene de localStorage
3. **Actualización de URL**: Se actualiza la URL con el ID correcto sin recargar la página
4. **Redirección**: Si no se encuentra un ID válido, se redirige a la lista de proyectos

```typescript
// En la página de configuración de métricas
useEffect(() => {
  if (router.isReady) {
    // Primera capa: Obtener ID de la URL
    let projectIdFromUrl = router.query.id;
    
    // Validar el ID de la URL
    if (projectIdFromUrl === 'undefined' || !projectIdFromUrl) {
      // Segunda capa: Obtener ID de localStorage
      const storedId = localStorage.getItem('currentProjectId');
      
      if (storedId) {
        // Actualizar URL sin recargar la página
        router.push(`/metrics/configure/${storedId}`, undefined, { shallow: true });
        projectIdFromUrl = storedId;
      } else {
        // Redirección si no hay ID válido
        router.push('/projects');
        return;
      }
    }
    
    // Usar el ID para cargar datos
    loadMetricsConfiguration(projectIdFromUrl);
  }
}, [router.isReady, router.query.id]);
```

## Diseño Visual

La interfaz sigue el diseño establecido para la plataforma:

- **Colores**: Se utiliza el color primario (#00B37E) para acciones principales
- **Componentes**: Se utilizan tarjetas, pestañas, botones y diálogos consistentes con el resto de la aplicación
- **Feedback**: Se proporcionan indicadores visuales para acciones en curso y confirmaciones para acciones destructivas

## Integración con API

La interfaz se integra con los siguientes endpoints de la API:

- `GET /api/metrics`: Obtener todas las métricas disponibles
- `GET /api/projects/{project_id}/metrics/config`: Obtener configuración actual
- `PUT /api/projects/{project_id}/metrics/config`: Guardar configuración
- `GET /api/metrics/templates`: Obtener plantillas disponibles
- `POST /api/metrics/templates`: Crear nueva plantilla
- `PUT /api/metrics/templates/{template_id}`: Actualizar plantilla
- `DELETE /api/metrics/templates/{template_id}`: Eliminar plantilla
