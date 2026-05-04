# Sistema de Métricas de Calidad de Datos

Este directorio documenta las métricas de calidad de datos implementadas en el sistema. Cada archivo detalla la teoría, el algoritmo exacto, la generación de issues y ejemplos prácticos de una métrica concreta.

El catálogo está alineado con las dimensiones de calidad definidas en **ISO/IEC 5259** (calidad de datos para IA/ML): completeness, consistency, syntactic accuracy, currentness, uniqueness y class balance.

## Índice de métricas

| ID | Archivo | Qué mide |
|----|---------|----------|
| `completeness` | [completeness.md](completeness.md) | Porcentaje de valores no nulos |
| `uniqueness` | [uniqueness.md](uniqueness.md) | Duplicados y variabilidad de identificadores |
| `syntactic_accuracy` | [syntactic_accuracy.md](syntactic_accuracy.md) | Formato correcto según tipo de dato |
| `logical_consistency` | [logical_consistency.md](logical_consistency.md) | Reglas IF-THEN entre columnas |
| `class_balance` | [class_balance.md](class_balance.md) | Distribución equilibrada de categorías (opt-in) |
| `currentness` | [currentness.md](currentness.md) | Frescura y antigüedad de fechas (ISO 5259-2 Cur-ML-1) |
| `diversity` | [diversity.md](diversity.md) | Cobertura de valores esperados por columna (ISO 5259-2) |

### Herramientas de profiling (no métricas de score)

| ID | Archivo | Qué aporta |
|----|---------|------------|
| `outliers` | [outliers.md](outliers.md) | Detección de valores atípicos. No es una dimensión de calidad en ISO/IEC 5259: se expone únicamente desde el flujo de Data Profiling y no contribuye al Quality Score. |

---

## Arquitectura del sistema

```
BaseMetric (base.py)
    │
    ├── CompletenessMetric
    ├── UniquenessMetric
    ├── SyntacticAccuracyMetric
    ├── LogicalConsistencyMetric
    ├── ClassBalanceMetric
    ├── CurrentnessMetric
    └── DiversityMetric
            │
            ▼
    MetricRegistry (registry.py)
            │
            ▼
    EvaluationService (evaluation_service.py)
            │
            ▼
    Celery Task (tasks/evaluation_tasks.py)
```

`OutliersMetric` existe en `backend/services/metrics/outliers.py` pero NO está registrada en `METRIC_REGISTRY`: se instancia únicamente desde el pipeline de Data Profiling.

Cada métrica hereda de `BaseMetric` e implementa `evaluate(df, parameters, dataset, evaluation_id, metrics_map) → MetricResult`. La clase base provee utilidades compartidas: cálculo de severidad, generación de histogramas, inferencia de tipo de columna, enmascaramiento de datos sensibles y **normalización de nulos configurables** (`apply_null_patterns` + `PRESET_NULL_PATTERNS`).

---

## Ciclo de vida de una evaluación

Cuando el usuario lanza una evaluación, el servicio `EvaluationService.run_evaluation()` ejecuta estos pasos:

| Progreso | Paso |
|----------|------|
| 5 % | Inicializar evaluación y crear `AnalysisRun` |
| 10 % | Descargar dataset desde MinIO |
| 20 % | Leer CSV en un DataFrame de pandas |
| 25–70 % | Ejecutar cada métrica configurada |
| 75–90 % | Calcular métricas por columna (completitud, unicidad, estadísticas) |
| 92 % | Calcular Quality Score global |
| 95 % | Persistir issues en la base de datos |
| 98 % | Evaluar Quality Gate |
| 100 % | Finalizar `AnalysisRun` |

---

## Cálculo del Quality Score global

El Quality Score funciona como un **sistema de calificación** (0–100): parte de 100 y descuenta según los issues detectados, normalizado por la amplitud del dataset.

### Por qué no se usan los scores de ratio como nota

Los scores de métrica miden el porcentaje de valores válidos por dimensión. Son útiles como diagnóstico, pero diluyen problemas concentrados: 3 fechas imposibles en 200 filas representan un 1.5 % del ratio y apenas afectan a la nota aunque el dataset sea inutilizable para análisis temporal. Los issues capturan estos problemas cualitativos con mayor fidelidad.

### Fórmula (3 pasos)

**Paso 1 — Penalización bruta por issues**

```
raw_penalty = critical × 0.12 + high × 0.05 + medium × 0.01 + low × 0.003
```

| Severidad  | Penalización por issue |
|------------|------------------------|
| `critical` | −12 % |
| `high`     | −5 % |
| `medium`   | −1 % |
| `low`      | −0.3 % |

**Paso 2 — Normalización por dimensionalidad**

Datasets más anchos exponen más issues potenciales. El factor `√(max(10, cols) / 10)` ajusta la penalización para que la misma densidad de problemas produzca la misma nota independientemente del número de columnas:

```
column_scale  = √(max(10, num_columns) / 10)
issue_penalty = min(0.97, raw_penalty / column_scale)
```

La referencia es **10 columnas**. Con `sqrt` el efecto se amortigua en datasets muy anchos (50 cols → ×2.24, no ×5).

**Paso 3 — Score final**

```
quality_score = max(0.0, 1.0 − issue_penalty)
```

**Ejemplo** (12 columnas, 3 críticos, 5 altos, 10 medios, 8 bajos):
```
raw_penalty  = 3×0.12 + 5×0.05 + 10×0.01 + 8×0.003 = 0.734
column_scale = √(12/10) = 1.095
issue_penalty = min(0.97, 0.734/1.095) = 0.670
quality_score = 1.0 − 0.670 = 0.330  →  33 / 100
```

### Scores de métrica como diagnóstico

Cada métrica sigue devolviendo su score crudo en `[0, 1]` (porcentaje de valores válidos). La media ponderada de estos scores se muestra en la UI como **"diagnóstico por dimensión"** para ayudar a localizar el origen de los issues. Las métricas que devuelven `score=None` (`logical_consistency` sin reglas, `class_balance` sin columnas explícitas) se excluyen del diagnóstico.

### Sistema de pesos

El campo `weight` (por defecto `1.0`) pondera la importancia relativa de cada métrica en la media de diagnóstico. No afecta al Quality Score final (que se basa en el conteo de issues).

```json
{
  "metrics": [
    { "id": "completeness",       "parameters": {},                       "weight": 1.5 },
    { "id": "uniqueness",         "parameters": { "threshold": 1.0 },     "weight": 1.5 },
    { "id": "syntactic_accuracy", "parameters": { "threshold": 0.95 },    "weight": 1.0 }
  ]
}
```

---

## Sistema de fingerprints y comparación con baseline

Cada issue generado lleva un campo `fingerprint` (hash SHA-256 derivado del tipo de issue, columna, umbral y parámetros de la regla). Este hash es **estable entre ejecuciones**: el mismo problema en el mismo dataset genera siempre el mismo fingerprint.

Al finalizar una evaluación, el servicio compara los fingerprints actuales con los de la evaluación anterior (`baseline`):

- **Issue nuevo** → fingerprint presente ahora pero no en el baseline.
- **Issue recurrente** → fingerprint presente en ambas.
- **Issue corregido** → fingerprint presente en el baseline pero no ahora.

Los contadores `new_issues_count`, `fixed_issues_count` y `recurrent_issues_count` se almacenan en `AnalysisRun`.

---

## Quality Gates

Un Quality Gate es una configuración por proyecto que establece umbrales mínimos de calidad. Al terminar cada evaluación se comprueba:

1. `critical_issues_count <= max_critical_issues` (por defecto `0`)
2. `quality_score >= min_score` (por defecto `70 %`)

| Estado | Significado |
|--------|-------------|
| `PASSED` | Todos los umbrales superados |
| `WARNING` | Algún umbral rozado (configurable) |
| `FAILED` | Al menos un umbral incumplido |

El Quality Score ya refleja la penalización por issues. El Quality Gate añade una verificación explícita de umbrales absolutos: si el score final no alcanza `min_score` o existen más issues críticos de los permitidos (`max_critical_issues`), la evaluación falla. Esto permite bloquear datasets incluso cuando la penalización no llega al umbral de corte pero los issues críticos son inadmisibles.

---

## Columnas sensibles

Los datasets pueden marcar columnas como sensibles (PII, credenciales, etc.). Todas las métricas respetan esta lista: los samples de filas problemáticas muestran `"***"` en lugar del valor real, y algunas métricas omiten estadísticas descriptivas para esas columnas.

---

## Cómo añadir una nueva métrica

1. Crear `backend/services/metrics/nueva_metrica.py` heredando de `BaseMetric`.
2. Implementar `evaluate()` devolviendo un `MetricResult` con `score` en `[0, 1]` (o `None` si la métrica es opt-in y no tiene nada que evaluar).
3. Registrarla en `backend/services/metrics/registry.py`:
   ```python
   from .nueva_metrica import NuevaMetrica
   METRIC_REGISTRY["nueva_metrica"] = NuevaMetrica
   ```
4. Añadir la función de fingerprint correspondiente en `backend/utils/fingerprint_utils.py`.
5. Documentar en este directorio con el mismo formato que los archivos existentes.

> **Importante**: no multipliques el score por el `weight` dentro de la métrica. El servicio de evaluación lo hace una única vez en la fórmula global.
