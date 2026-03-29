# Sistema de Métricas de Calidad de Datos

Este directorio documenta las 7 métricas de calidad de datos implementadas en el sistema. Cada archivo detalla la teoría, el algoritmo exacto, la generación de issues y ejemplos prácticos de una métrica concreta.

## Índice de métricas

| ID | Archivo | Qué mide |
|----|---------|----------|
| `completeness` | [completeness.md](completeness.md) | Porcentaje de valores no nulos |
| `uniqueness` | [uniqueness.md](uniqueness.md) | Duplicados y variabilidad por columna |
| `outliers` | [outliers.md](outliers.md) | Valores atípicos en columnas numéricas |
| `syntactic_accuracy` | [syntactic_accuracy.md](syntactic_accuracy.md) | Formato correcto según tipo de dato |
| `logical_consistency` | [logical_consistency.md](logical_consistency.md) | Reglas IF-THEN entre columnas |
| `class_balance` | [class_balance.md](class_balance.md) | Distribución equilibrada de categorías |
| `timeliness` | [timeliness.md](timeliness.md) | Frescura y antigüedad de fechas |

---

## Arquitectura del sistema

```
BaseMetric (base.py)
    │
    ├── CompletenessMetric
    ├── UniquenessMetric
    ├── OutliersMetric
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

Cada métrica hereda de `BaseMetric` e implementa el método `evaluate(df, parameters, dataset, evaluation_id, metrics_map) → MetricResult`. La clase base provee utilidades compartidas: cálculo de severidad, generación de histogramas, inferencia de tipo de columna y enmascaramiento de datos sensibles.

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

```
base_score = media(scores de cada métrica × su peso)

penalización = (nº issues HIGH × 0.05)
             + (nº issues MEDIUM × 0.025)
             + (nº issues LOW × 0.01)

quality_score = max(0.0, min(1.0, base_score − penalización))
```

El score final se muestra en escala 0–100 en la interfaz (multiplicado × 100).

### Sistema de pesos

Cada métrica tiene un campo `weight` (0.0–1.0, por defecto 1.0). El score de la métrica ya lleva el peso aplicado antes de entrar en la media. Esto permite dar más o menos importancia a ciertas métricas.

Configuración de ejemplo:

```json
{
  "metrics": [
    { "id": "completeness",  "parameters": {}, "weight": 1.0 },
    { "id": "uniqueness",    "parameters": {}, "weight": 1.0 },
    { "id": "outliers",      "parameters": { "method": "iqr", "factor": 1.5 }, "weight": 0.8 }
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

1. `quality_score >= min_score` (por defecto 70 %)
2. `critical_issues_count <= max_critical_issues` (por defecto 0)

El resultado puede ser:

| Estado | Significado |
|--------|-------------|
| `PASSED` | Todos los umbrales superados |
| `WARNING` | Algún umbral rozado (configurable) |
| `FAILED` | Al menos un umbral incumplido |

---

## Columnas sensibles

Los datasets pueden marcar columnas como sensibles (PII, credenciales, etc.). Todas las métricas respetan esta lista: los samples de filas problemáticas muestran `"***"` en lugar del valor real, y algunas métricas omiten estadísticas descriptivas para esas columnas.

---

## Cómo añadir una nueva métrica

1. Crear `backend/services/metrics/nueva_metrica.py` heredando de `BaseMetric`.
2. Implementar `evaluate()` devolviendo un `MetricResult`.
3. Registrarla en `backend/services/metrics/registry.py`:
   ```python
   from .nueva_metrica import NuevaMetrica
   METRIC_REGISTRY["nueva_metrica"] = NuevaMetrica
   ```
4. Añadir la función de fingerprint correspondiente en `backend/utils/fingerprint_utils.py`.
5. Documentar en este directorio con el mismo formato que los archivos existentes.
