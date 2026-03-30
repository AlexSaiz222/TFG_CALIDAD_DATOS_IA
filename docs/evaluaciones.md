# Sistema de Evaluaciones de Calidad de Datos

Este documento explica en detalle cómo funciona el proceso de evaluación de calidad de datos, desde que el usuario lo inicia hasta que se muestran los resultados en el dashboard.

---

## 1. Visión general

Una **evaluación** es el proceso de ejecutar un conjunto de métricas de calidad sobre un dataset para obtener:

1. Un **Quality Score** global (0–100) que resume la calidad del dataset.
2. Una lista de **issues** (problemas detectados) con su severidad.
3. Un veredicto del **Quality Gate** (PASSED / WARNING / FAILED).
4. Una **comparación con el baseline** (issues nuevos vs corregidos vs recurrentes).

```
Usuario lanza evaluación
        │
        ▼
┌─────────────────────────────────┐
│   EvaluationService             │
│   .run_evaluation()             │
│                                 │
│  1. Descarga dataset de MinIO   │
│  2. Lee CSV en DataFrame        │
│  3. Ejecuta cada métrica        │
│  4. Calcula métricas por col.   │
│  5. Calcula Quality Score       │
│  6. Persiste issues en BD       │
│  7. Evalúa Quality Gate         │
│  8. Compara con baseline        │
└─────────────────────────────────┘
        │
        ▼
  Resultados visibles en dashboard
```

---

## 2. Flujo paso a paso

### 2.1 Inicio (0–10%)

El usuario selecciona un dataset y las métricas a ejecutar. La configuración se almacena como JSON:

```json
{
  "metrics": [
    { "id": "completeness",  "parameters": { "threshold": 0.95 }, "weight": 1.0 },
    { "id": "uniqueness",    "parameters": { "threshold": 1.0 },  "weight": 1.0 },
    { "id": "outliers",      "parameters": { "method": "iqr", "factor": 1.5 }, "weight": 0.8 }
  ]
}
```

Se crea un registro `Evaluation` (tabla legacy) y un `AnalysisRun` (tabla nueva). La tarea se encola en **Celery** para ejecución asíncrona.

### 2.2 Descarga y lectura del dataset (10–25%)

El servicio descarga el archivo desde **MinIO** (almacenamiento S3) y lo lee como un DataFrame de pandas. A partir de aquí, todas las operaciones trabajan sobre este DataFrame en memoria.

### 2.3 Ejecución de métricas (25–70%)

Para cada métrica configurada, el servicio:

1. Obtiene la instancia de la métrica del **registro** (`MetricRegistry`).
2. Inyecta el `weight` en los parámetros.
3. Llama a `metric.evaluate(df, parameters, dataset, evaluation_id, metrics_map)`.
4. Recoge el `MetricResult` con: score, resultados detallados e issues.

Cada métrica hereda de `BaseMetric` e implementa su lógica de evaluación independiente.

### 2.4 Métricas por columna (75–90%)

Independientemente de las métricas configuradas, se calculan estadísticas descriptivas por cada columna del dataset:

- **Completitud** (% de valores no nulos)
- **Unicidad** (% de valores únicos)
- **Estadísticas numéricas** (min, max, media, mediana, std, histograma)
- **Tipo de dato**

Estas estadísticas se muestran en el detalle de la evaluación y son independientes de las métricas de calidad.

### 2.5 Cálculo del Quality Score (92%)

El Quality Score es la puntuación global que resume la calidad del dataset. Se calcula en dos fases:

#### Fase 1: Media ponderada de métricas

Cada métrica devuelve un score en escala `[0.0, 1.0]` multiplicado por su peso (`weight`). El score base se calcula como **media ponderada**:

```
                     Σ (score_i × weight_i)
base_score = ─────────────────────────────────
                       Σ weight_i
```

**Ejemplo con 3 métricas:**

| Métrica | Score bruto | Peso | Score × Peso |
|---------|-------------|------|--------------|
| completeness | 0.90 | 1.0 | 0.90 |
| uniqueness | 0.95 | 1.0 | 0.95 |
| outliers | 0.80 | 0.8 | 0.64 |

```
base_score = (0.90 + 0.95 + 0.64) / (1.0 + 1.0 + 0.8)
           = 2.49 / 2.8
           = 0.8893
```

#### Fase 2: Penalización por issues

Los issues detectados aplican una penalización sobre el score base, proporcional a su severidad:

| Severidad del issue | Penalización por issue |
|---------------------|------------------------|
| `high` | −0.05 (5%) |
| `medium` | −0.025 (2.5%) |
| `low` | −0.01 (1%) |

```
penalización = (nº_high × 0.05) + (nº_medium × 0.025) + (nº_low × 0.01)
```

#### Resultado final

```
quality_score = max(0.0, min(1.0, base_score − penalización))
```

El score se almacena en escala 0.0–1.0 internamente, pero se muestra al usuario en escala **0–100** (multiplicado × 100).

**Ejemplo completo:**

```
base_score = 0.8893

Issues detectados: 2 high, 3 medium, 1 low
penalización = (2 × 0.05) + (3 × 0.025) + (1 × 0.01) = 0.185

quality_score = max(0.0, min(1.0, 0.8893 − 0.185))
              = 0.7043

Mostrado al usuario: 70.43 / 100
```

---

## 3. Sistema de pesos

Cada métrica tiene un campo `weight` (por defecto `1.0`) que controla su importancia relativa en el Quality Score:

| Weight | Efecto |
|--------|--------|
| `1.0` | Importancia estándar |
| `0.5` | La mitad de importancia |
| `1.5` | 50% más importante |
| `0.0` | La métrica se ejecuta y genera issues, pero no afecta al score |

El peso se aplica **dentro de cada métrica** (el score devuelto ya lo incluye) y la agregación en `EvaluationService` divide por la suma total de pesos para obtener una media ponderada correcta.

---

## 4. Generación de issues

Cada métrica puede generar uno o más **issues** (problemas detectados). Un issue contiene:

| Campo | Descripción |
|-------|-------------|
| `severity` | Severidad: `critical`, `high`, `medium`, `low` |
| `description` | Descripción legible del problema |
| `issue_type` | Tipo de métrica que lo generó |
| `affected_columns` | Columnas involucradas con detalles |
| `affected_rows` | Filas afectadas (con muestra, si aplica) |
| `fingerprint` | Hash estable para comparación entre ejecuciones |

### 4.1 Cálculo de severidad

La severidad se calcula dinámicamente según la distancia entre el valor real y el umbral esperado:

**Para métricas donde mayor es mejor** (completeness, uniqueness, syntactic_accuracy):

| Condición | Severidad |
|-----------|-----------|
| `valor ≥ umbral` | `low` |
| `valor < 0.50` | `critical` |
| `valor < 0.70` | `high` |
| `umbral − valor > 0.15` | `high` |
| `umbral − valor > 0.05` | `medium` |
| en otro caso | `low` |

**Para outliers** (basado en proporción de valores atípicos):

| Proporción outliers | Severidad |
|---------------------|-----------|
| `≥ 20%` | `critical` |
| `≥ 10%` | `high` |
| `≥ 5%` | `medium` |
| `< 5%` | `low` |

**Para class_balance** (basado en proporción de clase dominante):

| Proporción clase dominante | Severidad |
|---------------------------|-----------|
| `≥ 99%` | `critical` |
| `≥ 95%` | `high` |
| `≥ 90%` | `medium` |

**Para timeliness** (basado en ratio antigüedad/umbral):

| Ratio = días / umbral | Severidad |
|------------------------|-----------|
| `≥ 10` | `critical` |
| `≥ 3` | `high` |
| `≥ 1` | `medium` |
| `< 1` | `low` |

### 4.2 Columnas sensibles

Los datasets pueden marcar columnas como sensibles (PII, credenciales, etc.). Todas las métricas respetan esta configuración:

- Los **samples** de filas problemáticas muestran `"***"` en lugar del valor real.
- Las **estadísticas descriptivas** se omiten para columnas sensibles en outliers.
- Las **etiquetas de clase** se enmascaran en class_balance.

---

## 5. Sistema de fingerprints

Cada issue lleva un **fingerprint**: un hash SHA-256 (truncado a 16 caracteres) derivado de las propiedades estables del issue:

- Tipo de issue
- Columna afectada
- Parámetros de la regla (umbral, patrón, método, etc.)

El fingerprint es **determinista**: el mismo problema en el mismo dataset genera siempre el mismo hash, independientemente de cuándo se ejecute la evaluación.

### 5.1 Comparación con baseline

Al finalizar una evaluación, el servicio busca la evaluación anterior más reciente (`baseline`) y compara fingerprints:

```
                   Evaluación actual        Baseline
                   ┌──────────────┐    ┌──────────────┐
                   │ FP-001  ●────┼────┼──── FP-001   │  → Recurrente
                   │ FP-002  ●────┼────┼──── FP-002   │  → Recurrente
                   │ FP-003  ●    │    │     FP-004 ●  │  → FP-003 = Nuevo
                   └──────────────┘    └──────────────┘    FP-004 = Corregido
```

| Clasificación | Significado |
|---------------|-------------|
| **Nuevo** | Fingerprint presente ahora pero no en el baseline |
| **Recurrente** | Fingerprint presente en ambas evaluaciones |
| **Corregido** | Fingerprint presente en el baseline pero no ahora |

Los contadores se almacenan en `AnalysisRun`:
- `new_issues_count`
- `fixed_issues_count`
- `recurrent_issues_count`

---

## 6. Quality Gates

Un Quality Gate es una puerta de calidad configurable por proyecto que determina si un dataset cumple los estándares mínimos. Se evalúa al final de cada evaluación.

### 6.1 Criterios de evaluación

| Criterio | Valor por defecto | Descripción |
|----------|-------------------|-------------|
| `min_score` | 70% | Quality Score mínimo para pasar |
| `max_critical_issues` | 0 | Máximo de issues críticos permitidos |

### 6.2 Estados posibles

| Estado | Condición |
|--------|-----------|
| `PASSED` | Todos los criterios se cumplen |
| `WARNING` | Algún criterio está cerca del límite |
| `FAILED` | Al menos un criterio no se cumple |

### 6.3 Ejemplo

```
Quality Score: 75.0
Issues críticos: 0
Umbral min_score: 70%
Umbral max_critical: 0

→ 75.0 ≥ 70.0 ✓
→ 0 ≤ 0 ✓
→ Resultado: PASSED
```

---

## 7. Las 7 métricas disponibles

Cada métrica evalúa un aspecto diferente de la calidad del dataset. Para documentación detallada de cada una, consulta `docs/metricas/`.

| Métrica | Qué mide | Score | Issues típicos |
|---------|----------|-------|----------------|
| **Completeness** | % de valores no nulos | `1 − media(ratio_nulos)` | Dataset/columna con baja completitud |
| **Uniqueness** | Filas duplicadas y variabilidad | `filas_únicas / total` | Duplicados, baja variabilidad, ID no único |
| **Outliers** | Valores atípicos numéricos (IQR/Z-score) | `1 − ratio_outliers × 3` | Columna con outliers (con % y muestra) |
| **Syntactic Accuracy** | Formato correcto según tipo (email, fecha, etc.) | `media(conformance_rates)` | Columna con valores que no cumplen el patrón |
| **Logical Consistency** | Reglas de negocio IF-THEN / violación directa | `media(compliance_rates)` | Regla de negocio violada (con filas de ejemplo) |
| **Class Balance** | Distribución de categorías (entropía Shannon) | `balance_index / 100` | Clase dominante (≥90%), clase minoritaria (≤5%) |
| **Timeliness** | Frescura de columnas de fecha | `media(freshness_scores)` | Datos obsoletos, baja tasa de parseo de fechas |

### 7.1 Cómo contribuye cada métrica al score final

```
                    ┌───────────────┐
                    │ Completeness  │──── score × weight ──┐
                    ├───────────────┤                      │
                    │ Uniqueness    │──── score × weight ──┤
                    ├───────────────┤                      │
                    │ Outliers      │──── score × weight ──┤    Media
                    ├───────────────┤                      ├──► ponderada ──► base_score
                    │ Syntactic Acc │──── score × weight ──┤    (÷ Σweights)
                    ├───────────────┤                      │
                    │ Logical Cons  │──── score × weight ──┤
                    ├───────────────┤                      │
                    │ Class Balance │──── score × weight ──┤
                    ├───────────────┤                      │
                    │ Timeliness    │──── score × weight ──┘
                    └───────────────┘

                    base_score ─── penalización por issues ──► quality_score (0-100)
```

---

## 8. Persistencia de resultados

Los resultados se almacenan en dos sistemas paralelos por compatibilidad:

### Tabla legacy: `evaluations`
- `results` (JSONB): todos los resultados en un único objeto JSON.
- `quality_score` (float): score en escala 0–100.
- `status`: `pending` → `processing` → `completed` / `failed`.

### Tablas nuevas (Sonar-Lite): `analysis_runs` + `data_quality_issues`
- `AnalysisRun`: metadatos de la ejecución, score, contadores de issues, estado del Quality Gate.
- `DataQualityIssue`: cada issue como registro individual con fingerprint, severidad mapeada (`high` → `major`, `medium` → `minor`, `low` → `info`).

### Estructura del JSON de resultados

```json
{
  "overall": {
    "quality_score": 0.7043,
    "metrics_processed": ["completeness", "uniqueness", "outliers"],
    "score_breakdown": {
      "metric_scores": {
        "completeness": 0.9000,
        "uniqueness": 0.9500,
        "outliers": 0.6400
      },
      "base_score": 0.8893,
      "issue_penalty": 0.1850,
      "penalty_detail": {
        "high_issues": 2,
        "medium_issues": 3,
        "low_issues": 1,
        "high_weight": 0.05,
        "medium_weight": 0.025,
        "low_weight": 0.01
      },
      "final_score": 0.7043
    },
    "completeness": 0.90,
    "uniqueness": { ... },
    "outliers": { ... }
  },
  "column_metrics": {
    "columna_1": {
      "completeness": 0.98,
      "uniqueness": 0.75,
      "n_nulls": 2,
      "n_non_nulls": 98,
      "n_unique": 75,
      "type": "float64",
      "min": 0.5,
      "max": 100.0,
      "mean": 45.2,
      "median": 42.0,
      "std": 15.3
    }
  },
  "diff": {
    "baseline_analysis_id": 5,
    "new_issues_count": 1,
    "fixed_issues_count": 2,
    "recurrent_issues_count": 4,
    "has_baseline": true
  }
}
```

---

## 9. Progreso en tiempo real

Durante la ejecución, el servicio actualiza el progreso para que el frontend pueda mostrar una barra de avance:

| Progreso | Paso |
|----------|------|
| 5% | Inicializar evaluación |
| 10% | Descargar dataset de MinIO |
| 20% | Leer CSV en DataFrame |
| 25–70% | Ejecutar métricas (proporcional al número de métricas) |
| 75–90% | Calcular métricas por columna |
| 92% | Calcular Quality Score |
| 95% | Guardar resultados en base de datos |
| 98% | Evaluar Quality Gate |
| 100% | Evaluación completada |

El frontend consulta `/api/evaluations/<id>/status` periódicamente para actualizar la interfaz.

---

## 10. Ejemplo completo de evaluación

### Configuración

```json
{
  "metrics": [
    { "id": "completeness",  "parameters": { "threshold": 0.95 }, "weight": 1.0 },
    { "id": "uniqueness",    "parameters": {},                    "weight": 1.0 },
    { "id": "outliers",      "parameters": { "method": "iqr" },   "weight": 0.8 }
  ]
}
```

### Dataset de ejemplo (100 filas)

- 3 columnas: `id`, `nombre`, `salario`
- 5 filas con `nombre` nulo
- 2 filas duplicadas
- 3 outliers en `salario`

### Ejecución de métricas

**Completeness:**
```
score_bruto = 1 − (0 + 5 + 0) / (3 × 100) = 0.9833
score = 0.9833 × 1.0 = 0.9833

Issues: 1 (columna 'nombre' < 98% completitud)
  → severidad: low (distancia = 0.98 − 0.95 = 0.03)
```

**Uniqueness:**
```
filas_únicas = 98 / 100 = 0.98
score = 0.98 × 1.0 = 0.98

Issues: 1 (2 filas duplicadas)
  → severidad: medium (distancia = 1.0 − 0.98 = 0.02... pero > 0.0 con threshold 1.0)
```

**Outliers:**
```
salario: 3 outliers de 100 = 3%
col_score = max(0, 1 − 0.03 × 3) = 0.91
score = 0.91 × 0.8 = 0.728

Issues: 1 (3% outliers en salario)
  → severidad: low (< 5%)
```

### Cálculo del Quality Score

```
Scores ponderados: [0.9833, 0.98, 0.728]
Pesos: [1.0, 1.0, 0.8]

base_score = (0.9833 + 0.98 + 0.728) / (1.0 + 1.0 + 0.8)
           = 2.6913 / 2.8
           = 0.9612

Issues: 0 high, 1 medium, 2 low
penalización = (0 × 0.05) + (1 × 0.025) + (2 × 0.01) = 0.045

quality_score = max(0.0, min(1.0, 0.9612 − 0.045)) = 0.9162

Mostrado al usuario: 91.62 / 100
```

### Quality Gate

```
quality_score = 0.9162 (91.62%) ≥ 0.70 (70%) → ✓
critical_issues = 0 ≤ 0 → ✓

Resultado: PASSED ✅
```
