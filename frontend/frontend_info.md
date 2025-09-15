# Documentación del Frontend - Plataforma de Evaluación de Calidad de Datos para IA

## Índice
1. [Introducción](#introducción)
2. [Arquitectura General](#arquitectura-general)
3. [Estructura de Directorios](#estructura-de-directorios)
4. [Configuración](#configuración)
5. [Sistema de Autenticación](#sistema-de-autenticación)
6. [Componentes Principales](#componentes-principales)
7. [Páginas](#páginas)
8. [Integración con API](#integración-con-api)
9. [Gestión de Estado](#gestión-de-estado)
10. [Manejo de Errores](#manejo-de-errores)
11. [Optimizaciones](#optimizaciones)
12. [Guía de Desarrollo](#guía-de-desarrollo)

## Introducción

El frontend de la Plataforma de Evaluación de Calidad de Datos para IA está construido con React y Next.js, utilizando TypeScript para proporcionar tipado estático. La interfaz de usuario está diseñada con Material-UI (MUI) para ofrecer una experiencia moderna y consistente.

### Objetivos del Frontend

- Proporcionar una interfaz intuitiva para gestionar proyectos y datasets
- Visualizar métricas de calidad de datos
- Facilitar la configuración de evaluaciones
- Mostrar resultados de manera clara y accionable
- Ofrecer una experiencia de usuario fluida y responsiva

## Arquitectura General

El frontend sigue una arquitectura basada en componentes con las siguientes capas:

1. **Capa de Presentación**: Componentes React y páginas Next.js
2. **Capa de Estado**: Contextos React para gestión de estado global
3. **Capa de Servicios**: Funciones para comunicación con la API
4. **Capa de Utilidades**: Funciones auxiliares y helpers

### Tecnologías Principales

- **React**: Biblioteca para construir interfaces de usuario
- **Next.js**: Framework de React para renderizado del lado del servidor y generación de sitios estáticos
- **TypeScript**: Superset de JavaScript con tipado estático
- **Material-UI**: Biblioteca de componentes de UI
- **Axios**: Cliente HTTP para comunicación con la API
- **SWR**: Biblioteca para manejo de caché y revalidación de datos
- **React Hook Form**: Biblioteca para manejo de formularios

## Estructura de Directorios

```
frontend/
├── public/                # Archivos estáticos
│   └── images/           # Imágenes y recursos gráficos
├── src/                  # Código fuente
│   ├── components/       # Componentes reutilizables
│   │   ├── layout/       # Componentes de layout
│   │   └── metrics/      # Componentes específicos para métricas
│   ├── contexts/         # Contextos de React para estado global
│   ├── pages/            # Páginas de Next.js
│   │   ├── api/          # Rutas de API de Next.js
│   │   ├── datasets/     # Páginas relacionadas con datasets
│   │   ├── metrics/      # Páginas relacionadas con métricas
│   │   └── projects/     # Páginas relacionadas con proyectos
│   ├── services/         # Servicios para comunicación con la API
│   ├── types/            # Definiciones de tipos TypeScript
│   └── utils/            # Utilidades y helpers
├── .env.local            # Variables de entorno locales
├── next.config.js        # Configuración de Next.js
├── package.json          # Dependencias y scripts
└── tsconfig.json         # Configuración de TypeScript
```

## Configuración

### Archivos de Configuración

- **next.config.js**: Configuración de Next.js
- **.env.local**: Variables de entorno locales
- **tsconfig.json**: Configuración de TypeScript

### Variables de Entorno Principales

- `NEXT_PUBLIC_API_URL`: URL base de la API del backend
- `NEXT_PUBLIC_APP_ENV`: Entorno de la aplicación (development, production)

### Tema y Estilos

El tema de la aplicación está definido en `src/pages/_app.tsx` utilizando la API de temas de Material-UI. Los colores principales son:

- **Color primario**: #00B37E (verde)
- **Color secundario**: #FFB800 (amarillo)
- **Color de error**: #E5484D (rojo)
- **Fondo**: #F8F9FA (gris claro)
- **Texto primario**: #1A1A1A (casi negro)
- **Texto secundario**: #555555 (gris)

## Sistema de Autenticación

La autenticación se gestiona a través del contexto `AuthContext` que proporciona funcionalidades para:

- **Login**: Autenticación de usuarios existentes
- **Registro**: Creación de nuevas cuentas
- **Logout**: Cierre de sesión
- **Actualización de perfil**: Modificación de datos del usuario
- **Verificación de autenticación**: Comprobación del estado de autenticación

### Flujo de Autenticación

1. El usuario introduce credenciales en el formulario de login
2. Se envían las credenciales a la API mediante `authAPI.login()`
3. Si la autenticación es exitosa, se almacena el token JWT en localStorage
4. Se actualiza el estado de autenticación en `AuthContext`
5. Se redirige al usuario al dashboard

### Protección de Rutas

Las rutas protegidas verifican el estado de autenticación a través del hook `useAuth()` y redirigen a la página de login si el usuario no está autenticado.

## Componentes Principales

### Componentes de Layout

- **Layout**: Estructura base para todas las páginas autenticadas
- **Navbar**: Barra de navegación superior
- **Sidebar**: Menú lateral con navegación principal

### Componentes de Métricas

- **MetricCard**: Tarjeta para mostrar una métrica individual
- **MetricConfigDialog**: Diálogo para configurar parámetros de métricas
- **MetricTemplateSelector**: Selector de plantillas de métricas

### Componentes de Formularios

- **ProjectForm**: Formulario para crear/editar proyectos
- **DatasetUploadForm**: Formulario para cargar datasets
- **MetricConfigForm**: Formulario para configurar métricas

### Componentes de Visualización

- **DataPreview**: Vista previa de datos de un dataset
- **QualityScoreChart**: Gráfico de puntuación de calidad
- **IssuesList**: Lista de problemas detectados en evaluaciones

## Páginas

### Autenticación

- **/login**: Página de inicio de sesión
- **/register**: Página de registro de nuevos usuarios

### Dashboard

- **/dashboard**: Panel principal con resumen de proyectos y actividad reciente

### Proyectos

- **/projects**: Lista de proyectos
- **/projects/new**: Creación de nuevo proyecto
- **/projects/[id]**: Detalles de un proyecto específico

### Datasets

- **/datasets**: Lista de todos los datasets
- **/datasets/[id]**: Detalles de un dataset específico
- **/projects/[id]/datasets**: Datasets de un proyecto específico

### Métricas

- **/metrics/configure/[id]**: Configuración de métricas para un proyecto
- **/metrics/templates**: Gestión de plantillas de métricas

### Evaluaciones

- **/evaluations/[id]**: Resultados de una evaluación específica

## Integración con API

La comunicación con la API del backend se realiza a través de servicios definidos en `src/services/api.ts`:

### Servicios Principales

- **authAPI**: Autenticación y gestión de usuarios
- **projectsAPI**: Gestión de proyectos
- **datasetsAPI**: Gestión de datasets
- **metricsAPI**: Configuración de métricas y plantillas
- **evaluationsAPI**: Ejecución y consulta de evaluaciones

### Características de la Integración

- **Interceptores**: Para manejo de tokens de autenticación y errores comunes
- **Deduplicación de solicitudes**: Evita solicitudes duplicadas en corto tiempo
- **Timeouts**: Previene solicitudes que nunca se resuelven
- **Manejo de errores**: Procesamiento centralizado de errores de API
- **Caché**: Almacenamiento en caché de respuestas frecuentes para mejorar rendimiento

## Gestión de Estado

### Contextos

- **AuthContext**: Estado de autenticación y usuario actual
- **Otros contextos específicos**: Para gestión de estado global en áreas específicas

### Estado Local

- Uso de hooks de React (`useState`, `useReducer`) para estado local de componentes
- Uso de `SWR` para estado derivado de la API con caché y revalidación automática

## Manejo de Errores

### Estrategias Implementadas

- **Captura centralizada**: Manejo de errores a nivel de servicio API
- **Fallbacks**: Valores por defecto cuando fallan las solicitudes
- **Reintentos**: Mecanismos de reintento con backoff exponencial
- **Timeouts**: Límites de tiempo para evitar solicitudes infinitas
- **Feedback visual**: Notificaciones y mensajes de error claros para el usuario

### Patrones de Manejo de Errores

- Uso de bloques try/catch para capturar errores
- Manejo de errores específicos de la API
- Logging detallado para facilitar depuración
- Estados de carga y error en componentes

## Optimizaciones

### Rendimiento

- **Memoización**: Uso de `React.memo`, `useMemo` y `useCallback` para evitar renderizados innecesarios
- **Code splitting**: División del código por rutas para reducir el tamaño inicial de carga
- **Lazy loading**: Carga diferida de componentes y recursos
- **Caché**: Almacenamiento en caché de respuestas de API frecuentes

### Experiencia de Usuario

- **Estados de carga**: Indicadores visuales durante operaciones asíncronas
- **Feedback inmediato**: Respuesta inmediata a acciones del usuario
- **Validación de formularios**: Validación en tiempo real para evitar envíos incorrectos
- **Navegación optimizada**: Transiciones suaves entre páginas

## Guía de Desarrollo

### Requisitos

- Node.js 14+
- npm o yarn

### Instalación

1. Clonar el repositorio
2. Instalar dependencias: `npm install` o `yarn install`
3. Configurar variables de entorno en `.env.local`
4. Iniciar servidor de desarrollo: `npm run dev` o `yarn dev`

### Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo
- `npm run build`: Construye la aplicación para producción
- `npm run start`: Inicia la aplicación construida
- `npm run lint`: Ejecuta el linter para verificar el código

### Convenciones de Código

- Usar componentes funcionales con hooks
- Seguir principios de diseño atómico para componentes
- Mantener componentes pequeños y enfocados en una sola responsabilidad
- Utilizar tipos TypeScript para todas las props y estados
- Documentar componentes complejos y funciones importantes

### Flujo de Trabajo de Desarrollo

1. Crear una rama para la nueva funcionalidad
2. Implementar la funcionalidad
3. Asegurar que pasa el linting y los tests
4. Crear un pull request
5. Revisar y mergear después de aprobación
