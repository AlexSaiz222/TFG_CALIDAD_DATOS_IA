# Documentación del Frontend - Plataforma de Evaluación de Calidad de Datos para IA

## Índice
1. [Arquitectura General](#arquitectura-general)
2. [Estructura de Directorios](#estructura-de-directorios)
3. [Configuración](#configuración)
4. [Sistema de Autenticación](#sistema-de-autenticación)
5. [Páginas](#páginas)
6. [Componentes Principales](#componentes-principales)
7. [Integración con API](#integración-con-api)
8. [Guía de Desarrollo](#guía-de-desarrollo)

---

## Arquitectura General

El frontend sigue una arquitectura basada en componentes con las siguientes capas:

1. **Capa de Presentación**: Componentes React y páginas Next.js
2. **Capa de Estado**: Contextos React para gestión de estado global
3. **Capa de Servicios**: Funciones para comunicación con la API
4. **Capa de Tipos**: TypeScript compartido con el dominio backend

### Tecnologías Principales

- **React + Next.js**: Framework de UI con routing basado en sistema de archivos
- **TypeScript**: Tipado estático en toda la codebase
- **Material-UI (MUI)**: Componentes de UI
- **Axios**: Cliente HTTP
- **SWR**: Caché y revalidación de datos remotos
- **React Hook Form**: Gestión de formularios

---

## Estructura de Directorios

```
frontend/src/
├── components/                  # Componentes reutilizables
│   ├── layout/                  # Navbar, Sidebar, Layout base
│   ├── metrics/                 # Componentes de configuración de métricas
│   │   ├── SmartMetricConfigDialog.tsx   # Diálogo unificado de configuración por métrica
│   │   ├── NullPatternsConfig.tsx        # UI de patrones de nulidad (presets + regex custom)
│   │   ├── MetricCard.tsx               # Tarjeta de resumen de una métrica
│   │   ├── MetricTemplateSelector.tsx   # Selector de plantillas de métricas
│   │   └── columnPicker/               # Flujo de selección de columnas y patrones
│   │       ├── ColumnPicker.tsx         # Selector de columnas de un dataset
│   │       ├── ColumnPatternMatrix.tsx  # Matriz columna × patrón para syntactic_accuracy
│   │       ├── DatasetSelector.tsx      # Selector de dataset para cargar su esquema
│   │       └── PatternEditor.tsx        # Editor/creador de patrones regex custom
│   ├── AnalysisDashboardPanel.tsx    # Panel de resumen de análisis Sonar-Lite
│   ├── AnalysisHistory.tsx           # Historial de AnalysisRuns con comparativas
│   ├── ConfirmDialog.tsx             # Diálogo de confirmación genérico
│   ├── DataProfilingTab.tsx          # Pestaña de EDA/profiling (~85KB, principal componente de análisis)
│   ├── DatasetLineageCanvas.tsx      # Canvas SVG para árbol de versiones/linaje de datasets
│   ├── DatasetSelector.tsx           # Selector de dataset para un proyecto
│   ├── DatasetStatusSnapshot.tsx     # Resumen de estado del dataset en un run
│   ├── DatasetVersionHistory.tsx     # Historial de versiones de un dataset
│   ├── IssuesList.tsx                # Lista de DataQualityIssue con filtros y severidad
│   ├── QualityGateBadge.tsx          # Badge visual PASSED/WARNING/FAILED
│   ├── QualityGateSettings.tsx       # Formulario de configuración de QualityGate por proyecto
│   ├── QualityTrendChart.tsx         # Gráfico de tendencia de calidad a lo largo de runs
│   └── VersionEvolutionChart.tsx     # Gráfico de evolución de métricas por versión
├── contexts/
│   └── AuthContext.tsx          # Estado de autenticación y usuario actual
├── pages/                       # Rutas Next.js (file-based routing)
│   ├── _app.tsx                 # Tema MUI, AuthContext provider
│   ├── index.tsx                # Redirect a /dashboard o /login
│   ├── auth.tsx                 # Página combinada login/registro
│   ├── login.tsx                # Página de login
│   ├── register.tsx             # Página de registro
│   ├── profile.tsx              # Perfil del usuario
│   ├── dashboard.tsx            # Panel principal con resumen de proyectos
│   ├── datasets/
│   │   ├── index.tsx            # Lista de todos los datasets
│   │   ├── [id].tsx             # Detalle de dataset (profiling, versiones, evaluaciones)
│   │   ├── compare.tsx          # Comparación entre dos datasets
│   │   └── upload.tsx           # Formulario de carga de dataset
│   ├── projects/
│   │   ├── index.tsx            # Lista de proyectos
│   │   ├── new.tsx              # Crear nuevo proyecto
│   │   ├── [id].tsx             # Detalle de proyecto (runs, métricas, quality gate)
│   │   ├── edit/[id].tsx        # Editar proyecto
│   │   └── [id]/runs/[runId].tsx  # Detalle de un AnalysisRun específico
│   ├── evaluations/
│   │   ├── index.tsx            # Lista de evaluaciones (sistema legacy)
│   │   └── [id].tsx             # Detalle de una evaluación legacy
│   ├── metrics/
│   │   └── configure/[id].tsx   # Configurar métricas de un proyecto
│   └── settings/
│       └── templates.tsx        # Gestión de plantillas de métricas
├── services/
│   └── api.ts                   # Todos los clientes de API (authAPI, projectsAPI, etc.)
├── types/
│   └── index.ts                 # Tipos TypeScript compartidos (Dataset, Project, AnalysisRun, ValidationPattern, etc.)
└── utils/                       # Helpers y utilidades
    ├── issueUtils.ts            # getLocalizedIssueDescription: texto i18n de issues desde campos estructurados
    └── metricColors.ts          # Colores y etiquetas por métrica (incluye null_patterns)
```

---

## Configuración

### Variables de entorno (`.env.local`)

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL base del backend (`http://localhost:5000` en dev) |
| `NEXT_PUBLIC_APP_ENV` | Entorno: `development` / `production` |
| `CHOKIDAR_USEPOLLING` | `true` en Windows para hot-reload dentro de Docker |
| `WATCHPACK_POLLING` | `true` en Windows para hot-reload dentro de Docker |

### Tema y Estilos (MUI)

Definido en `pages/_app.tsx`:

| Token | Valor |
|---|---|
| Color primario | `#00B37E` (verde) |
| Color secundario | `#FFB800` (amarillo) |
| Color de error | `#E5484D` (rojo) |
| Fondo | `#F8F9FA` (gris claro) |

### Next.js rewrites

En `next.config.js`, `/api/*` se redirige al backend. En desarrollo: `localhost:5000`; en Docker: `http://backend:5000`.

---

## Sistema de Autenticación

Gestionado por `AuthContext`. Almacena el token JWT en `localStorage`.

### Flujo
1. Usuario introduce credenciales → `authAPI.login()`
2. JWT almacenado en localStorage
3. `AuthContext` actualiza el estado de usuario
4. Redirección a `/dashboard`

### Protección de rutas
Cada página protegida llama `useAuth()` y redirige a `/login` si no hay sesión activa.

---

## Páginas

### Autenticación
- `/login`, `/register`, `/auth` — login y registro

### Dashboard
- `/dashboard` — resumen de proyectos, actividad reciente, quality gate status

### Proyectos
- `/projects` — lista de proyectos del usuario
- `/projects/new` — crear proyecto
- `/projects/[id]` — detalle: métricas configuradas, historial de AnalysisRuns, quality gate
- `/projects/edit/[id]` — editar proyecto
- `/projects/[id]/runs/[runId]` — detalle completo de un AnalysisRun: score, gate, issues nuevos/resueltos

### Datasets
- `/datasets` — lista global de datasets
- `/datasets/[id]` — detalle: profiling (EDA), versiones, evaluaciones, columnas sensibles
- `/datasets/upload` — carga de nuevo dataset
- `/datasets/compare` — comparación lado a lado de dos datasets

### Métricas
- `/metrics/configure/[id]` — configurar métricas activas y umbrales de un proyecto
- `/settings/templates` — gestión de plantillas de métricas

### Evaluaciones (legacy)
- `/evaluations` — lista de evaluaciones
- `/evaluations/[id]` — detalle de una evaluación legacy

---

## Componentes Principales

### Sonar-Lite / AnalysisRun

| Componente | Descripción |
|---|---|
| `AnalysisDashboardPanel` | Panel de resumen: score actual, badge de gate, tendencia |
| `AnalysisHistory` | Tabla de runs con score, gate status, nuevos/resueltos issues |
| `QualityGateBadge` | Chip visual PASSED (verde) / WARNING (amarillo) / FAILED (rojo) |
| `QualityGateSettings` | Formulario de umbrales (min_score, max_critical_issues, max_new_issues) |
| `QualityTrendChart` | Gráfico de línea: evolución del quality_score a lo largo de runs |
| `IssuesList` | Lista filtrable de DataQualityIssue con indicador is_new |

### Dataset y Versioning

| Componente | Descripción |
|---|---|
| `DataProfilingTab` | Pestaña de EDA completa: estadísticas, histogramas, correlaciones (~85KB) |
| `DatasetLineageCanvas` | Árbol SVG interactivo que muestra el linaje de versiones de un dataset |
| `DatasetVersionHistory` | Lista de versiones con metadatos (version_tag, fecha, tamaño) |
| `DatasetSelector` | Selector de dataset en el contexto de un proyecto |
| `DatasetStatusSnapshot` | Resumen del estado del dataset en un AnalysisRun concreto |
| `VersionEvolutionChart` | Gráfico comparativo de métricas entre versiones del mismo dataset |

### UI General

| Componente | Descripción |
|---|---|
| `ConfirmDialog` | Diálogo de confirmación genérico para acciones destructivas |

---

## Integración con API

Todos los clientes están en `services/api.ts`:

| Cliente | Endpoints cubiertos |
|---|---|
| `authAPI` | login, register, refresh, me |
| `projectsAPI` | CRUD proyectos, metrics config, quality gate |
| `datasetsAPI` | CRUD datasets, versioning, profiling, sensitive columns, columns |
| `metricsAPI` | Métricas disponibles, plantillas |
| `evaluationsAPI` | Evaluaciones legacy |
| `analysisRunsAPI` | AnalysisRuns: crear, listar, detalle, issues |
| `dashboardAPI` | Resumen global |
| `patternsAPI` | CRUD de patrones regex de usuario (ValidationPattern) |

### Características

- **Interceptores Axios**: Inyección automática del token JWT en cabeceras `Authorization`
- **Manejo de errores**: Centralizado — 401 redirige a login, resto a notificaciones de error
- **SWR**: Usado en páginas de lectura frecuente para caché automática y revalidación

---

## Guía de Desarrollo

### Requisitos

- Node.js 18+
- pnpm (recomendado) o npm

### Instalación

```bash
cd frontend
pnpm install
cp .env.local.example .env.local   # configurar variables
pnpm dev   # servidor en localhost:3000
```

### Scripts

| Comando | Descripción |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build para producción |
| `pnpm lint` | ESLint |

### Convenciones de código

- Componentes funcionales con hooks
- Props tipadas con TypeScript
- Importar tipos desde `types/index.ts`
- Llamadas API siempre a través de `services/api.ts`, nunca `fetch` directo
