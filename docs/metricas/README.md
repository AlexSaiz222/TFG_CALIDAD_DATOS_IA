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
| `timeliness` | [timeliness.md](timeliness.md) | Frescura y antigüedad de fechas |

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
    └── TimelinessMetric
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

Cada métrica hereda de `BaseMetric` e implementa `evaluate(df, parameters, dataset, evaluation_id, metrics_map) → MetricResult`. La clase base provee utilidades compartidas: cálculo de severidad, generación de histogramas, inferencia de tipo de columna y enmascaramiento de datos sensibles.

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

El Quality Score es una **media aritmética ponderada** de los scores crudos de cada métrica:

```
                Σ (score_i × weight_i)
quality_score = ──────────────────────        score_i ∈ [0, 1]
                    Σ (weight_i)
```

Reglas de cálculo:

1. Cada métrica devuelve su score **crudo** en `[0, 1]` sin aplicar el peso (el peso se aplica una única vez en el servicio, eliminando el doble conteo que existía en versiones anteriores).
2. Las métricas que devuelven `score=None` se **excluyen tanto del numerador como del denominador**. Esto ocurre, por ejemplo, cuando `logical_consistency` no tiene reglas configuradas o cuando `class_balance` no tiene columnas explícitas.
3. El resultado final se acota a `[0, 1]` y se muestra en escala `0–100` en la interfaz.
4. **No existe penalización por issues sobre el score**: los issues alimentan el Quality Gate (ver más abajo), evitando el doble conteo contra métricas cuyo propio score ya refleja el problema.

### Sistema de pesos

Cada métrica tiene un campo `weight` (por defecto `1.0`) que se aplica únicamente en la fórmula anterior. El peso permite dar más o menos importancia a ciertas dimensiones sin alterar el score que devuelve la métrica.

Configuración de ejemplo:

```json
{
  "metrics": [
    { "id": "completeness",       "parameters": {},                       "weight": 1.0 },
    { "id": "uniqueness",         "parameters": { "threshold": 1.0 },     "weight": 1.0 },
    { "id": "syntactic_accuracy", "parameters": { "threshold": 0.95 },    "weight": 0.8 }
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

Puesto que los issues ya no penalizan el `quality_score`, el Quality Gate es el único mecanismo que bloquea evaluaciones con problemas críticos. Si necesitas tolerar algún issue crítico, sube `max_critical_issues` en la configuración del gate.

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
