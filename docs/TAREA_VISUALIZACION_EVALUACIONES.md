# Tarea: Completar la Visualización de Evaluaciones

## Estado Actual

### ✅ Lo que YA existe

#### Backend (Endpoints disponibles)
| Endpoint | Método | Descripción | Estado |
|----------|--------|-------------|--------|
| `/api/evaluations/` | GET | Lista evaluaciones con paginación | ✅ Funcional |
| `/api/evaluations/<id>` | GET | Obtiene una evaluación específica | ✅ Funcional |
| `/api/evaluations/<id>/status` | GET | Estado y progreso de evaluación | ✅ Funcional |
| `/api/evaluations/<id>/issues` | GET | Issues de una evaluación | ✅ Funcional |
| `/api/evaluations/datasets/<id>` | POST | Crear nueva evaluación | ✅ Funcional |
| `/api/evaluations/<id>` | DELETE | Eliminar evaluación | ✅ Funcional |
| `/api/evaluations/compare` | GET | Comparar dos evaluaciones | ✅ Funcional |

#### Frontend (Componentes existentes)
- **`pages/datasets/[id].tsx`**: Página de detalle de dataset con:
  - Tab "Evaluations": Lista básica de evaluaciones (ID, status, fecha, issues count)
  - Tab "Issues": Lista básica de issues (severity, type, column, description)
  - Botón "Run Evaluation" con polling de estado
  - Botón "View Issues" por evaluación

#### Datos disponibles en la respuesta de evaluación
```typescript
interface Evaluation {
  id: number;
  dataset_id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  metrics_config: { metrics: MetricConfig[], options: {} };
  results: {
    overall: {
      quality_score: number;
      metrics_processed: string[];
      completeness?: number;
      uniqueness?: number;
      // ... otras métricas
    };
    column_metrics: {
      [columnName: string]: {
        completeness: number;
        uniqueness: number;
        type: string;
        min?: number;
        max?: number;
        mean?: number;
        median?: number;
        std?: number;
        histogram?: { bins: number[], counts: number[] };
      }
    }
  };
  quality_score: number;
  progress: number;
  current_step: string;
  task_id: string;
  error?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  issue_count: number;
}
```

---

## ❌ Lo que FALTA implementar

### 1. Página dedicada de detalle de evaluación (`/evaluations/[id]`)
**Prioridad: ALTA**

Actualmente no existe una página dedicada para ver los resultados completos de una evaluación. Los usuarios solo ven una tabla básica en el tab "Evaluations" del dataset.

**Debe incluir:**
- Header con información básica (ID, dataset, fecha, duración)
- **Quality Score** prominente con indicador visual (gauge/circular progress)
- Resumen de métricas procesadas
- Desglose por métrica con valores y umbrales
- Lista de issues agrupadas por severidad
- Métricas por columna con estadísticas
- Histogramas para columnas numéricas

### 2. Componentes de visualización
**Prioridad: ALTA**

| Componente | Descripción | Estado |
|------------|-------------|--------|
| `QualityScoreGauge` | Indicador circular del quality_score (0-100%) | ❌ Falta |
| `MetricCard` | Tarjeta para mostrar una métrica individual | ❌ Falta |
| `MetricsSummary` | Resumen de todas las métricas | ❌ Falta |
| `IssuesList` | Lista mejorada de issues con filtros | ⚠️ Básico |
| `ColumnMetricsTable` | Tabla de métricas por columna | ❌ Falta |
| `HistogramChart` | Gráfico de histograma para columnas | ❌ Falta |
| `EvaluationProgress` | Barra de progreso durante evaluación | ⚠️ Básico |

### 3. Mejoras en la API del frontend
**Prioridad: MEDIA**

```typescript
// Añadir a evaluationsAPI en api.ts:
getEvaluationStatus: (id: number) => 
  api.get(`/api/evaluations/${id}/status`),

compareEvaluations: (id1: number, id2: number) =>
  api.get(`/api/evaluations/compare?evaluation_id_1=${id1}&evaluation_id_2=${id2}`),
```

### 4. Actualizar tipos TypeScript
**Prioridad: MEDIA**

El tipo `Evaluation` en `types/index.ts` necesita actualizarse para reflejar la estructura real:

```typescript
// Actualizar EvaluationResults
export interface EvaluationResults {
  overall: {
    quality_score: number;
    metrics_processed: string[];
    completeness?: number;
    uniqueness?: number;
    outliers?: Record<string, OutlierInfo>;
    [key: string]: any; // Para métricas dinámicas
  };
  column_metrics: Record<string, ColumnMetrics>;
}

// Añadir tipo para outliers
export interface OutlierInfo {
  count: number;
  indices: number[];
}

// Actualizar Evaluation para incluir campos de progreso
export interface Evaluation {
  // ... campos existentes ...
  progress?: number;
  current_step?: string;
  task_id?: string;
  error?: string;
}
```

---

## Plan de Implementación

### Fase 1: Preparación (30 min)
1. [x] Revisar endpoints existentes del backend
2. [x] Revisar componentes existentes del frontend
3. [x] Documentar estructura de datos
4. [ ] Actualizar tipos TypeScript

### Fase 2: Componentes Base (1-2 horas)
1. [ ] Crear `components/evaluations/QualityScoreGauge.tsx`
2. [ ] Crear `components/evaluations/MetricCard.tsx`
3. [ ] Crear `components/evaluations/MetricsSummary.tsx`
4. [ ] Crear `components/evaluations/ColumnMetricsTable.tsx`

### Fase 3: Página de Detalle (2-3 horas)
1. [ ] Crear `pages/evaluations/[id].tsx`
2. [ ] Implementar layout con secciones
3. [ ] Integrar componentes de visualización
4. [ ] Añadir navegación desde dataset

### Fase 4: Mejoras y Polish (1 hora)
1. [ ] Mejorar polling de progreso
2. [ ] Añadir animaciones/transiciones
3. [ ] Responsive design
4. [ ] Manejo de errores mejorado

---

## Archivos a Crear/Modificar

### Nuevos archivos
```
frontend/src/
├── pages/
│   └── evaluations/
│       └── [id].tsx                    # Página de detalle de evaluación
├── components/
│   └── evaluations/
│       ├── QualityScoreGauge.tsx       # Indicador circular de calidad
│       ├── MetricCard.tsx              # Tarjeta de métrica individual
│       ├── MetricsSummary.tsx          # Resumen de métricas
│       ├── ColumnMetricsTable.tsx      # Tabla de métricas por columna
│       └── IssuesSummary.tsx           # Resumen de issues por severidad
```

### Archivos a modificar
```
frontend/src/
├── types/index.ts                      # Actualizar tipos
├── services/api.ts                     # Añadir endpoints faltantes
└── pages/datasets/[id].tsx             # Añadir link a página de evaluación
```

---

## Dependencias Necesarias

Ya instaladas en el proyecto:
- `@mui/material` - Componentes UI
- `@mui/icons-material` - Iconos

Opcionales para gráficos (verificar si están instaladas):
- `recharts` o `chart.js` - Para histogramas y gráficos

---

## Mockup de la Página de Evaluación

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Back to Dataset                                    Delete  Export │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Evaluation #42                                                     │
│  Dataset: sales_data.csv | Completed: 25/01/2026 18:30             │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────────────────────────────┐  │
│  │                 │  │  Metrics Summary                        │  │
│  │   Quality Score │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │  │
│  │                 │  │  │Complete- │ │Uniqueness│ │Outliers  │ │  │
│  │      87%        │  │  │ness      │ │          │ │          │ │  │
│  │   ████████░░    │  │  │  95.2%   │ │  88.5%   │ │  12      │ │  │
│  │                 │  │  └──────────┘ └──────────┘ └──────────┘ │  │
│  └─────────────────┘  └─────────────────────────────────────────┘  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Issues (15)                                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 🔴 High (3)  │ 🟡 Medium (8)  │ 🟢 Low (4)                   │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ 🔴 Column 'email' has 15% null values                        │  │
│  │ 🔴 Column 'age' contains 5 outliers                          │  │
│  │ 🟡 Dataset contains 23 duplicate rows                        │  │
│  │ ...                                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Column Metrics                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Column      │ Type    │ Complete │ Unique │ Min  │ Max │ ... │  │
│  ├─────────────┼─────────┼──────────┼────────┼──────┼─────┼─────┤  │
│  │ id          │ int64   │ 100%     │ 100%   │ 1    │ 500 │     │  │
│  │ name        │ object  │ 98.5%    │ 95.2%  │ -    │ -   │     │  │
│  │ email       │ object  │ 85.0%    │ 99.1%  │ -    │ -   │     │  │
│  │ age         │ float64 │ 92.3%    │ 45.6%  │ 18   │ 85  │     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Próximo Paso

**Comenzar con la Fase 2**: Crear los componentes base de visualización.

El primer componente a crear es `QualityScoreGauge.tsx` ya que es el elemento visual más importante de la página.

---

*Documento creado: 25/01/2026*
