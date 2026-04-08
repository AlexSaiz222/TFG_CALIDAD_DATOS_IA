# Fórmula de Puntuación de Calidad (Quality Score)

## Visión general

El Quality Score es un valor entre **0 y 100** que resume el estado de calidad de un dataset. Se calcula en dos fases:

1. **Puntuación base** → promedio ponderado de los scores de cada métrica evaluada.
2. **Penalización** → descuento basado en la gravedad de los issues detectados.

```
Quality Score = max(0, base_score − issue_penalty) × 100
```

---

## Fase 1 — Puntuación base

Cada métrica ejecutada devuelve un `score` en el rango `[0.0, 1.0]` que representa la proporción de calidad observada (ej. `completeness = 0.897` → 89.7% de los valores no son nulos).

Las métricas pueden tener un **peso** (`weight`) configurado en la plantilla del proyecto, que permite dar más importancia a unas dimensiones que a otras.

```python
# Cada métrica devuelve score * weight
base_score = sum(metric_scores) / sum(metric_weights)
```

### Ejemplo — v1_desastre (7 métricas evaluadas)

| Métrica              | Score raw | Weight | Score × Weight |
|----------------------|-----------|--------|----------------|
| completeness         | 0.897     | 1.5    | 1.346          |
| uniqueness           | 0.976     | 1.5    | 1.464          |
| outliers             | 0.561     | 1.0    | 0.561          |
| syntactic_accuracy   | 0.867     | 1.0    | 0.867          |
| logical_consistency  | 0.909     | 1.0    | 0.909          |
| class_balance        | 0.890     | 0.8    | 0.712          |
| currentness           | 0.500     | 1.0    | 0.500          |
| **Totales**          |           | **7.8**| **6.359**      |

```
base_score = 6.359 / 7.8 ≈ 0.815  (81.5%)
```

> **Nota sobre los pesos:** El peso de cada métrica se lee del campo `parameters.weight` de la configuración de la plantilla. Si no está definido, se usa 1.0.

---

## Fase 2 — Penalización por issues

### Principios de diseño

La penalización usa el enfoque **"peor issue por métrica"** (_worst-issue-per-metric_), con dos propiedades clave:

#### ✅ Invariancia al número de columnas

Si la métrica `completeness` genera 12 issues (uno por columna con baja completitud) o 1 issue, la penalización es **idéntica**: solo cuenta el issue más grave de esa métrica.

| Situación                              | Fórmula antigua (sum × flat rate) | Fórmula actual (worst per metric) |
|----------------------------------------|-----------------------------------|-----------------------------------|
| 1 columna con completitud baja (medium)| −2.5%                             | −4% (peor: medium)                |
| 12 columnas con completitud baja (medium)| −30%                            | −4% (peor: medium)                |

#### ✅ Invariancia al tamaño del dataset (nº de filas)

La severity de cada issue individual ya se calcula a partir de **tasas/proporciones**, no de conteos absolutos (ver `calculate_dynamic_severity` en `base.py`):

```python
# Ejemplo: outliers — severity basada en ratio, no en conteo
if ratio >= 0.20: return "critical"   # ≥20% de valores son outliers
elif ratio >= 0.10: return "high"     # ≥10%
elif ratio >= 0.05: return "medium"   # ≥5%
else:              return "low"       # <5%
```

Por tanto:
- Dataset de **500 filas** con 30 outliers → ratio = 6% → `medium` → penalty −4%
- Dataset de **100.000 filas** con 30 outliers → ratio = 0.03% → `low` → penalty −1%

La fórmula no necesita normalizar por filas porque la severity ya lo hace.

---

### Cálculo paso a paso

```python
_SEVERITY_RANK    = {'critical': 4, 'high': 3, 'medium': 2, 'low': 1}
_SEVERITY_PENALTY = {'critical': 0.15, 'high': 0.08, 'medium': 0.04, 'low': 0.01}

# 1. Para cada issue, agrupar por métrica y quedarse con el peor
worst_per_metric = {}
for issue in issues:
    key = issue.get('metric_id') or issue.get('issue_type', 'unknown')
    sev = issue.get('severity', 'low')
    if _SEVERITY_RANK[sev] > _SEVERITY_RANK.get(worst_per_metric.get(key), 0):
        worst_per_metric[key] = sev

# 2. Sumar las penalizaciones (una por métrica), con tope del 40%
issue_penalty = min(0.40, sum(_SEVERITY_PENALTY[s] for s in worst_per_metric.values()))
```

### Tabla de penalizaciones por severidad

| Severity  | Penalización por métrica | Descripción                              |
|-----------|--------------------------|------------------------------------------|
| `critical`| −15%                     | Problema grave que invalida la métrica   |
| `high`    | −8%                      | Problema significativo, requiere acción  |
| `medium`  | −4%                      | Problema moderado, recomendable corregir |
| `low`     | −1%                      | Problema menor o informativo             |

### Tope máximo

La penalización total nunca supera el **40%**, independientemente del número de métricas o issues. Esto evita que un dataset "desastre" llegue a un score negativo.

Con 7 métricas evaluadas, el peor caso teórico sería:
```
7 métricas × 0.15 (todas critical) = 1.05 → min(0.40, 1.05) = 0.40
```

---

## Ejemplo completo — v1_desastre

### Issues detectados (29 en total)

| Métrica             | Issue más grave encontrado       | Severity  | Penalización |
|---------------------|----------------------------------|-----------|-------------|
| completeness        | columna 'nombre' 75.5% completa  | `high`    | −8%         |
| uniqueness          | variabilidad 'email' 17.7% únicos| `critical`| −15%        |
| outliers            | salario 14.6% outliers           | `high`    | −8%         |
| syntactic_accuracy  | email 76% conformidad            | `high`    | −8%         |
| logical_consistency | salario_maximo_razonable 88%     | `medium`  | −4%         |
| class_balance       | nivel_experiencia minoritaria    | `low`     | −1%         |
| currentness          | fecha_actualizacion obsoleta     | `high`    | −8%         |

```
issue_penalty = 0.08 + 0.15 + 0.08 + 0.08 + 0.04 + 0.01 + 0.08 = 0.52
issue_penalty = min(0.40, 0.52) = 0.40   ← tope aplicado

quality_score = max(0.0, 0.815 − 0.40) = 0.415 → ~42/100
```

---

## Comparativa de rangos esperados

| Tipo de dataset    | Base score | Penalización típica | Score final |
|--------------------|-----------|---------------------|-------------|
| Limpio (v3)        | ~95%      | 1–2 issues `low` → −1–2% | **~93/100** |
| Mejorado (v2)      | ~87%      | mix `medium`/`low` → −8–15% | **~72–79/100** |
| Desastre (v1)      | ~80–85%   | múltiples `high`/`critical` → cap −40% | **~40–45/100** |

---

## Limitaciones conocidas

### Doble conteo parcial

El score de cada métrica ya refleja el problema (ej. `completeness = 89.7%` ya descuenta los nulos), y luego el issue de completeness añade una penalización adicional sobre el mismo problema. Esto hace que los problemas de calidad se penalicen dos veces: una en el score base y otra en la penalización de issues.

La fórmula actual lo mitiga parcialmente porque solo cuenta **1 penalización por métrica** (el peor issue), lo que hace que la penalización sea estructural ("esta dimensión tiene algún problema grave") en lugar de proporcional al número de issues.

Una solución más rigurosa sería separar completamente score e issues: el score mide la dimensión, los issues son solo informativos. Esto implicaría rediseñar las métricas para que el score no sea ya una penalización en sí mismo, lo cual está fuera del alcance actual.

---

## Archivos relevantes

| Archivo | Responsabilidad |
|---------|----------------|
| `backend/services/evaluation_service.py` | Orquesta el cálculo: base_score + issue_penalty → quality_score |
| `backend/services/metrics/base.py` | `calculate_dynamic_severity()`: convierte tasas en severity |
| `backend/services/metrics/*.py` | Cada métrica calcula su score y genera sus issues |
| `frontend/src/pages/evaluations/[id].tsx` | Visualiza el score y el desglose de issues |
