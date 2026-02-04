# Sonar-Lite API Documentation

## Resumen

Sonar-Lite es el sistema de análisis de calidad de datos que proporciona:
- **Quality Gate**: Semáforo visual (PASSED/WARNING/FAILED)
- **Quality Score**: Puntuación 0-100%
- **Issue Tracking**: Seguimiento de issues nuevos, corregidos y recurrentes
- **Baseline Comparison**: Comparación con análisis anteriores

---

## Endpoints

### 1. Iniciar Análisis

```http
POST /api/evaluations/projects/{project_id}/analyze
```

**Request Body:**
```json
{
  "dataset_id": 1,
  "metrics": [
    {"id": "completeness", "parameters": {"threshold": 0.95}},
    {"id": "uniqueness", "parameters": {"threshold": 1.0}}
  ],
  "options": {}
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "analysis_run_id": 42,
    "status": "PENDING",
    "evaluation_id": 15,
    "task_id": "abc123"
  },
  "message": "Análisis iniciado correctamente"
}
```

---

### 2. Obtener Estado del Análisis (Polling)

```http
GET /api/evaluations/analysis/{run_id}/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis_run_id": 42,
    "status": "RUNNING",
    "quality_gate_status": null,
    "progress": 45,
    "current_step": "Evaluando completitud",
    "quality_score": null,
    "total_issues_count": 0,
    "critical_issues_count": 0,
    "error_message": null,
    "started_at": "2026-02-03T12:00:00Z",
    "completed_at": null,
    "estimated_completion": "2026-02-03T12:05:00Z"
  }
}
```

---

### 3. Obtener Detalle del Análisis

```http
GET /api/evaluations/analysis/{run_id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis_run": {
      "id": 42,
      "project_id": 1,
      "dataset_id": 5,
      "status": "COMPLETED",
      "quality_gate_status": "PASSED",
      "quality_score": 85.5,
      "total_issues_count": 12,
      "critical_issues_count": 1,
      "new_issues_count": 3,
      "fixed_issues_count": 5,
      "recurrent_issues_count": 9,
      "baseline_analysis_id": 41,
      "created_at": "2026-02-03T12:00:00Z",
      "completed_at": "2026-02-03T12:03:45Z",
      "dataset_name": "ventas_2026.csv",
      "issues_by_severity": {
        "critical": 1,
        "major": 4,
        "minor": 5,
        "info": 2
      }
    }
  }
}
```

---

### 4. Obtener Issues del Análisis

```http
GET /api/evaluations/analysis/{run_id}/issues
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `severity` | string | Filtrar por severidad: `critical`, `major`, `minor`, `info` |
| `issue_type` | string | Filtrar por tipo: `completeness`, `uniqueness`, etc. |
| `page` | int | Página (default: 1) |
| `per_page` | int | Items por página (default: 50, max: 100) |

**Response:**
```json
{
  "success": true,
  "data": {
    "issues": [
      {
        "id": 101,
        "analysis_run_id": 42,
        "fingerprint": "abc123def456",
        "issue_type": "completeness",
        "severity": "major",
        "description": "Columna 'email' tiene 15.3% de valores nulos",
        "affected_columns": [{"column": "email", "null_rate": 0.153}],
        "affected_row_count": 1530,
        "is_new": true,
        "rule_key": "completeness_check",
        "created_at": "2026-02-03T12:03:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 50,
      "total": 12,
      "pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

---

### 5. Historial de Análisis de un Proyecto

```http
GET /api/evaluations/projects/{project_id}/analysis_runs
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filtrar por estado: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED` |
| `page` | int | Página (default: 1) |
| `per_page` | int | Items por página (default: 20, max: 100) |

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis_runs": [
      {
        "id": 42,
        "project_id": 1,
        "dataset_id": 5,
        "status": "COMPLETED",
        "quality_gate_status": "PASSED",
        "quality_score": 85.5,
        "new_issues_count": 3,
        "fixed_issues_count": 5,
        "recurrent_issues_count": 9,
        "total_issues_count": 12,
        "baseline_analysis_id": 41,
        "created_at": "2026-02-03T12:00:00Z",
        "completed_at": "2026-02-03T12:03:45Z"
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 8,
      "pages": 1
    }
  }
}
```

---

### 6. Último Análisis Completado

```http
GET /api/evaluations/projects/{project_id}/latest_analysis
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis_run": {
      "id": 42,
      "status": "COMPLETED",
      "quality_gate_status": "PASSED",
      "quality_score": 85.5,
      ...
    }
  }
}
```

---

## Modelos de Datos

### AnalysisRun

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int | ID único |
| `project_id` | int | ID del proyecto |
| `dataset_id` | int | ID del dataset analizado |
| `status` | enum | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED` |
| `quality_gate_status` | enum | `PASSED`, `WARNING`, `FAILED` |
| `quality_score` | float | Puntuación 0-100 |
| `total_issues_count` | int | Total de issues detectados |
| `critical_issues_count` | int | Issues críticos |
| `new_issues_count` | int | Issues nuevos vs baseline |
| `fixed_issues_count` | int | Issues corregidos vs baseline |
| `recurrent_issues_count` | int | Issues que persisten |
| `baseline_analysis_id` | int | ID del análisis de referencia |
| `progress` | int | Progreso 0-100 |
| `current_step` | string | Paso actual del análisis |
| `error_message` | string | Mensaje de error si falló |

### DataQualityIssue

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int | ID único |
| `analysis_run_id` | int | ID del análisis |
| `fingerprint` | string | Hash único para tracking |
| `issue_type` | string | Tipo de issue |
| `severity` | enum | `critical`, `major`, `minor`, `info` |
| `description` | string | Descripción del problema |
| `affected_columns` | array | Columnas afectadas |
| `affected_row_count` | int | Filas afectadas |
| `is_new` | bool | Si es nuevo vs baseline |
| `rule_key` | string | Regla que detectó el issue |

---

## Quality Gate Status

| Status | Condición | Color |
|--------|-----------|-------|
| `PASSED` | Score ≥ 80% y 0 issues críticos | 🟢 Verde |
| `WARNING` | Score ≥ 60% o ≤ 2 issues críticos | 🟡 Naranja |
| `FAILED` | Score < 60% o > 2 issues críticos | 🔴 Rojo |

---

## Flujo de Uso

```
1. Usuario inicia análisis
   POST /projects/{id}/analyze
   
2. Frontend hace polling del estado
   GET /analysis/{id}/status (cada 2-3 segundos)
   
3. Cuando status = COMPLETED
   GET /analysis/{id} (detalle completo)
   GET /analysis/{id}/issues (lista de issues)
   
4. Para ver historial
   GET /projects/{id}/analysis_runs
   
5. Para dashboard de proyecto
   GET /projects/{id}/latest_analysis
```

---

## Componentes Frontend

| Componente | Ubicación | Descripción |
|------------|-----------|-------------|
| `QualityGateBadge` | `/components/QualityGateBadge.tsx` | Semáforo visual |
| `AnalysisHistory` | `/components/AnalysisHistory.tsx` | Tabla de historial |
| `QualityTrendChart` | `/components/QualityTrendChart.tsx` | Gráficos de tendencia |
| `IssuesList` | `/components/IssuesList.tsx` | Lista de issues filtrable |
| `AnalysisRunDetail` | `/pages/projects/[id]/runs/[runId].tsx` | Página de detalle |
