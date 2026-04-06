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
    { "id": "completeness",       "parameters": { "threshold": 0.95 }, "weight": 1.0 },
    { "id": "uniqueness",         "parameters": { "threshold": 1.0 },  "weight": 1.0 },
    { "id": "syntactic_accuracy", "parameters": { "threshold": 0.95 }, "weight": 1.0 }
  ]
}
```

Se crea un registro `Evaluation` (tabla legacy) y un `AnalysisRun` (tabla nueva). La tarea se encola en **Celery** para ejecución asíncrona.

### 2.2 Descarga y lectura del dataset (10–25%)

El servicio descarga el archivo desde **MinIO** (almacenamiento S3) y lo lee como un DataFrame de pandas. A partir de aquí, todas las operaciones trabajan sobre este DataFrame en memoria.

### 2.3 Ejecución de métricas (25–70%)

Para cada métrica configurada, el servicio:

1. Obtiene la instancia de la métrica del **registro** (`MetricRegistry`).
2. Llama a `metric.evaluate(df, parameters, dataset, evaluation_id, metrics_map)`.
3. Recoge el `MetricResult` con: score de diagnóstico, resultados detallados e issues.

Cada métrica hereda de `BaseMetric` e implementa su lógica de evaluación independiente.

### 2.4 Métricas por columna (75–90%)

Independientemente de las métricas configuradas, se calculan estadísticas descriptivas por cada columna del dataset:

- **Completitud** (% de valores no nulos)
- **Unicidad** (% de valores únicos)
- **Estadísticas numéricas** (min, max, media, mediana, std, histograma)
- **Tipo de dato**

Estas estadísticas se muestran en el detalle de la evaluación y son independientes de las métricas de calidad.

### 2.5 Cálculo del Quality Score (92%)

El Quality Score es la puntuación global (0–100) que refleja la calidad del dataset. Funciona como un **sistema de calificación**: parte de 100 y se descuenta según los problemas encontrados.

#### Por qué no se usan directamente los scores de métrica

Las métricas calculan el **porcentaje de valores válidos** por dimensión (ratio de celdas). Este enfoque dilute problemas concentrados: 3 fechas imposibles en 200 filas apenas afectan al ratio (~1.5%) aunque hagan el dataset inutilizable para análisis temporal. Los **issues** capturan estos problemas cualitativos con mayor fidelidad.

Los scores de métrica se mantienen como **diagnóstico** (ayudan a localizar el origen del problema) pero no son los que determinan la nota final.

#### Fórmula del Quality Score

**Paso 1 — Penalización bruta por issues**

Cada issue detectado contribuye según su severidad:

| Severidad | Penalización por issue |
|-----------|------------------------|
| `critical` | −12 % |
| `high`     | −5 % |
| `medium`   | −1 % |
| `low`      | −0.3 % |

```
raw_penalty = critical × 0.12 + high × 0.05 + medium × 0.01 + low × 0.003
```

**Paso 2 — Normalización por dimensionalidad**

Datasets con más columnas generan más issues potenciales. Un factor de escala basado en la raíz cuadrada del número de columnas normaliza la penalización para que la misma densidad de problemas produzca la misma nota, independientemente de la amplitud del dataset:

```
column_scale = √(max(10, num_columns) / 10)
issue_penalty = min(0.97, raw_penalty / column_scale)
```

La referencia es 10 columnas (dataset estándar). La función `sqrt` amortigua el efecto en datasets muy anchos.

**Paso 3 — Score final**

```
quality_score = max(0.0, 1.0 − issue_penalty)
```

El score se almacena en escala `[0.0, 1.0]` internamente y se muestra al usuario en escala **0–100**.

#### Ejemplos

**Dataset con pocos problemas** (5 columnas, 0 críticos, 1 alto, 2 medios):
```
raw_penalty  = 1×0.05 + 2×0.01 = 0.07
column_scale = √(max(10,5)/10) = 1.0
issue_penalty = min(0.97, 0.07/1.0) = 0.07
quality_score = 1.0 − 0.07 = 0.93  →  93 / 100
```

**Dataset mediocre** (12 columnas, 1 crítico, 3 altos, 5 medios):
```
raw_penalty  = 1×0.12 + 3×0.05 + 5×0.01 = 0.32
column_scale = √(12/10) = 1.095
issue_penalty = min(0.97, 0.32/1.095) = 0.292
quality_score = 1.0 − 0.292 = 0.708  →  70.8 / 100
```

**Dataset deficiente** (12 columnas, 3 críticos, 5 altos, 10 medios, 8 bajos):
```
raw_penalty  = 3×0.12 + 5×0.05 + 10×0.01 + 8×0.003 = 0.734
column_scale = √(12/10) = 1.095
issue_penalty = min(0.97, 0.734/1.095) = 0.670
quality_score = 1.0 − 0.670 = 0.330  →  33.0 / 100
```

#### Escala orientativa de calificación

| Quality Score | Interpretación |
|---------------|----------------|
| 90–100 | Excelente — sin issues o únicamente bajos |
| 75–89  | Bueno — algunos issues medios o un issue alto |
| 60–74  | Aceptable — issues altos o combinación media/alta |
| 40–59  | Deficiente — issues críticos o muchos altos |
| 0–39   | Muy deficiente — múltiples críticos, dataset problemático |

---

## 3. Sistema de pesos por métrica

Cada métrica tiene un campo `weight` (por defecto `1.0`) que controla la importancia relativa de sus scores de **diagnóstico** (media ponderada mostrada en el panel de cálculo). El peso **no afecta al Quality Score final**, que se basa únicamente en el conteo de issues.

| Weight | Efecto en el diagnóstico |
|--------|--------------------------|
| `1.0` | Importancia estándar |
| `0.5` | La mitad de importancia |
| `1.5` | 50% más importante |
| `0.0` | La métrica se ejecuta y genera issues, pero no aparece en el diagnóstico |

> El peso puede utilizarse en el futuro para ponderar la importancia de cada dimensión en el diagnóstico o en informes, pero actualmente solo afecta a la visualización de la media ponderada de diagnóstico.

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
- Las **estadísticas descriptivas** se omiten para columnas sensibles.
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

## 7. Las 6 métricas de calidad disponibles

Cada métrica evalúa un aspecto diferente de la calidad del dataset y genera issues que alimentan el Quality Score. Para documentación detallada de cada una, consulta `docs/metricas/`.

| Métrica | Qué mide | Issues típicos |
|---------|----------|----------------|
| **Completeness** | % de valores no nulos | Dataset/columna con baja completitud |
| **Uniqueness** | Filas duplicadas y variabilidad de identificadores | Duplicados, baja variabilidad, ID no único |
| **Syntactic Accuracy** | Formato correcto según tipo (email, fecha, UUID…) | Columna con valores que no cumplen el patrón |
| **Logical Consistency** | Reglas de negocio IF-THEN entre columnas | Regla de negocio violada (con filas de ejemplo) |
| **Class Balance** | Distribución equilibrada de categorías (opt-in) | Clase dominante, clase minoritaria |
| **Timeliness** | Frescura y antigüedad de fechas | Datos obsoletos, baja tasa de parseo de fechas |

> **Outliers** no es una métrica de calidad según ISO/IEC 5259. La clase `OutliersMetric` existe en el código pero solo se usa desde el flujo de **Data Profiling** y no contribuye al Quality Score.

### 7.1 Cómo fluyen los datos hacia el score

```
┌───────────────┐
│ Completeness  │──► issues (critical/high/medium/low) ──┐
├───────────────┤                                         │
│ Uniqueness    │──► issues                               │
├───────────────┤                                         │   conteo
│ Syntactic Acc │──► issues                               ├──► por      ──► raw_penalty
├───────────────┤                                         │   severidad
│ Logical Cons  │──► issues                               │
├───────────────┤                                         │
│ Class Balance │──► issues (si opt-in)                   │
├───────────────┤                                         │
│ Timeliness    │──► issues                               │
└───────────────┘                                         │
                                                          ▼
                        raw_penalty / √(cols/10) = issue_penalty
                                                          │
                        1.0 − issue_penalty = quality_score (0–100)
```

---

## 8. Persistencia de resultados

Los resultados se almacenan en dos sistemas paralelos por compatibilidad:

### Tabla legacy: `evaluations`
- `results` (JSONB): todos los resultados en un único objeto JSON.
- `quality_score` (float): score en escala 0–100.
- `status`: `pending` → `processing` → `completed` / `failed`.

### Tablas nuevas: `analysis_runs` + `data_quality_issues`
- `AnalysisRun`: metadatos de la ejecución, score, contadores de issues, estado del Quality Gate.
- `DataQualityIssue`: cada issue como registro individual con fingerprint, severidad mapeada (`high` → `major`, `medium` → `minor`, `low` → `info`).

### Estructura del JSON de resultados

```json
{
  "overall": {
    "quality_score": 0.330,
    "metrics_processed": ["completeness", "uniqueness", "syntactic_accuracy"],
    "score_breakdown": {
      "metric_scores": {
        "completeness": 0.8970,
        "uniqueness": 0.9830,
        "syntactic_accuracy": 0.8670
      },
      "metric_weights": {
        "completeness": 1.5,
        "uniqueness": 1.5,
        "syntactic_accuracy": 1.0
      },
      "diagnostic_base_score": 0.9214,
      "raw_penalty": 0.7340,
      "column_scale": 1.0954,
      "num_columns": 12,
      "issue_penalty": 0.6700,
      "penalty_weights": { "critical": 0.12, "high": 0.05, "medium": 0.01, "low": 0.003 },
      "final_score": 0.330,
      "formula": "issue_penalty_with_dimensionality",
      "issue_counts": {
        "critical": 3,
        "high": 5,
        "medium": 10,
        "low": 8
      }
    }
  },
  "column_metrics": {
    "email": {
      "completeness": 0.95,
      "uniqueness": 0.98,
      "n_nulls": 2,
      "n_non_nulls": 206,
      "n_unique": 202,
      "type": "object"
    }
  },
  "diff": {
    "baseline_analysis_id": 5,
    "new_issues_count": 2,
    "fixed_issues_count": 1,
    "recurrent_issues_count": 23,
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
    { "id": "completeness",       "parameters": { "threshold": 0.95 }, "weight": 1.0 },
    { "id": "uniqueness",         "parameters": {},                    "weight": 1.0 },
    { "id": "syntactic_accuracy", "parameters": { "threshold": 0.95 }, "weight": 1.0 }
  ]
}
```

### Dataset de ejemplo (100 filas, 4 columnas: `id`, `nombre`, `email`, `salario`)

- 5 filas con `nombre` nulo
- 2 filas duplicadas
- 3 emails con formato inválido

### Ejecución de métricas

**Completeness:**
```
ratio_nombre = 95/100 = 0.95  (justo en el umbral → low)
score_diagnóstico = 0.95

Issues generados: 1 low
```

**Uniqueness:**
```
filas_únicas = 98/100 = 0.98 < threshold 1.0 → medium
score_diagnóstico = 0.98

Issues generados: 1 medium
```

**Syntactic Accuracy:**
```
email: 97/100 válidos = 0.97 ≥ 0.95 → sin issue
score_diagnóstico = 0.97

Issues generados: 0
```

### Cálculo del Quality Score

```
Issues: 0 critical, 0 high, 1 medium, 1 low
num_columns = 4

raw_penalty  = 0×0.12 + 0×0.05 + 1×0.01 + 1×0.003 = 0.013
column_scale = √(max(10, 4) / 10) = √1.0 = 1.0    ← referencia (< 10 cols)
issue_penalty = min(0.97, 0.013 / 1.0) = 0.013

quality_score = 1.0 − 0.013 = 0.987  →  98.7 / 100
```

### Quality Gate

```
quality_score = 98.7% ≥ 70% → ✓
critical_issues = 0 ≤ 0 → ✓

Resultado: PASSED ✅
```
