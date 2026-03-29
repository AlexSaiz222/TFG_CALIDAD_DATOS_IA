# Class Balance — Métrica de Balance de Clases

**Archivo fuente:** `backend/services/metrics/class_balance.py`
**ID en el sistema:** `class_balance`

---

## 1. Descripción teórica

El balance de clases mide **cómo de equilibrada está la distribución de valores en columnas categóricas**. Un dataset con clases muy desequilibradas puede producir modelos sesgados: el modelo aprende a predecir siempre la clase mayoritaria y obtiene una precisión artificialmente alta sin aprender nada útil sobre las clases minoritarias.

La métrica usa la **entropía de Shannon** como medida de equilibrio. La entropía es máxima cuando todas las clases tienen la misma frecuencia y es mínima (0) cuando hay una única clase dominante.

**Por qué importa:**
- Es esencial para proyectos de clasificación supervisada (detección de fraude, diagnóstico médico, etc.).
- Un desequilibrio del 99/1 puede hacer que un clasificador que siempre predice "no fraude" tenga 99 % de accuracy.
- También detecta columnas con valores raros que podrían ser errores de entrada.

---

## 2. Parámetros de configuración

| Parámetro | Tipo | Valor por defecto | Descripción |
|-----------|------|-------------------|-------------|
| `columns` | `list[str]` | `[]` | Columnas a analizar explícitamente. |
| `auto_detect` | `bool` | `true` | Si es true, detecta automáticamente columnas categóricas. |
| `max_cardinality` | `int` | `50` | Máximo número de valores únicos para considerar una columna categórica en auto-detección. |
| `imbalance_threshold_high` | `float` | `0.90` | Proporción mínima de la clase dominante para generar alerta. |
| `imbalance_threshold_low` | `float` | `0.05` | Proporción máxima de la clase minoritaria para generar alerta. |
| `weight` | `float` | `1.0` | Peso en el Quality Score global. |

---

## 3. Algoritmo de cálculo

### Auto-detección de columnas

Si `auto_detect=True`, se consideran candidatas las columnas que cumplan **todas** estas condiciones:
- No están ya en `columns` (especificadas por el usuario).
- Tienen más de 1 valor único.
- Tienen **≤ `max_cardinality`** valores únicos.
- Son de tipo `object`/`category` **O** son enteras con **≤ 20** valores únicos.

### Cálculo del Balance Index (entropía normalizada)

Para cada columna analizada:

```python
# Proporciones de cada clase (excluyendo nulos)
probs = value_counts(normalize=True).values   # Array de proporciones, suma 1.0

# Entropía de Shannon
entropy = -Σ(p_i × log2(p_i))
# (Se añade 1e-12 para evitar log2(0))

# Entropía máxima posible (distribución uniforme entre n clases)
max_entropy = log2(n_clases)

# Balance Index: 0 = totalmente desequilibrado, 100 = perfectamente equilibrado
balance_index = (entropy / max_entropy) × 100
```

Si solo hay 1 clase, `balance_index = 0`, `entropy = 0`, `max_entropy = 0`.

### Score por columna

```
col_score = balance_index / 100.0   # Normalizado a [0.0, 1.0]
```

### Score global

```
overall = media(col_scores de todas las columnas analizadas) × weight
```

Si no se analizó ninguna columna, `score = 1.0`.

---

## 4. Estructura de resultados por columna

Para cada columna analizada, se almacena en `results`:

```json
{
  "balance_index": 72.45,
  "entropy": 2.17,
  "max_entropy": 2.99,
  "num_classes": 8,
  "total_values": 1000,
  "frequency_table": {
    "clase_A": { "count": 450, "proportion": 0.45 },
    "clase_B": { "count": 280, "proportion": 0.28 },
    "clase_C": { "count": 150, "proportion": 0.15 },
    "clase_D": { "count": 120, "proportion": 0.12 }
  },
  "dominant_class": { "value": "clase_A", "proportion": 0.45 },
  "minority_class": { "value": "clase_D", "proportion": 0.12 },
  "alerts": []
}
```

Si la columna está marcada como sensible, `dominant_class`, `minority_class` y todas las claves en `frequency_table` se reemplazan por `"***"`.

La tabla de frecuencias muestra hasta **20 clases** individualmente; si hay más, las restantes se agrupan en `"__others__"`.

---

## 5. Generación de issues

### Issue: clase dominante

**Condición:** `dominant_prop >= imbalance_threshold_high` (por defecto `≥ 90 %`).

```json
{
  "severity": "critical",
  "description": "Column 'fraude' is highly imbalanced: dominant class 'no' represents 99.5% of values (balance index: 1.0/100)",
  "affected_columns": [
    {
      "column": "fraude",
      "dominant_class": "no",
      "dominant_proportion": 0.995,
      "balance_index": 1.0
    }
  ],
  "issue_type": "class_balance",
  "fingerprint": "<hash-dominant_class>"
}
```

### Issue: clase minoritaria

**Condición:** `minority_prop <= imbalance_threshold_low` Y `n_clases > 1` (por defecto `≤ 5 %`).

```json
{
  "severity": "medium",
  "description": "Column 'categoria' has underrepresented minority class 'raro' at 0.80% of values",
  "affected_columns": [
    {
      "column": "categoria",
      "minority_class": "raro",
      "minority_proportion": 0.008,
      "balance_index": 45.2
    }
  ],
  "issue_type": "class_balance",
  "fingerprint": "<hash-minority_class>"
}
```

---

## 6. Cálculo de severidad

### Issue de clase dominante

Usa `calculate_dynamic_severity()` con `metric_type="class_balance"` y `actual_value = dominant_prop`:

| Proporción clase dominante | Severidad |
|---------------------------|-----------|
| `≥ 99 %` | `critical` |
| `≥ 95 %` | `high` |
| `≥ 90 %` | `medium` |

### Issue de clase minoritaria

Severidad **fija** (no usa `calculate_dynamic_severity`):

| Proporción clase minoritaria | Severidad |
|-----------------------------|-----------|
| `< 2 %` | `medium` |
| `2 % – 5 %` | `low` |

---

## 7. Fingerprint

| Tipo de issue | Función |
|---------------|---------|
| Clase dominante | `generate_class_balance_fingerprint(column_name=col, imbalance_type="dominant_class")` |
| Clase minoritaria | `generate_class_balance_fingerprint(column_name=col, imbalance_type="minority_class")` |

Los dos tipos de issue de la misma columna tienen fingerprints distintos, por lo que pueden coexistir y rastrearse independientemente.

---

## 8. Ejemplo práctico

**Dataset de entrada** (columna `resultado`, 1000 filas):

| resultado | count | proporción |
|-----------|-------|------------|
| negativo | 970 | 97.0 % |
| positivo | 30 | 3.0 % |

**Configuración:** `imbalance_threshold_high=0.90`, `imbalance_threshold_low=0.05`, `auto_detect=true`.

**Cálculo:**

```
probs = [0.97, 0.03]
entropy = -(0.97 × log2(0.97) + 0.03 × log2(0.03))
        = -(0.97 × (-0.0439) + 0.03 × (-5.059))
        = -(−0.0426 − 0.1518)
        = 0.1944

max_entropy = log2(2) = 1.0

balance_index = (0.1944 / 1.0) × 100 = 19.44
col_score = 19.44 / 100 = 0.1944
```

**Issues generados:**

1. **Clase dominante:** `0.97 ≥ 0.95` → severidad `high`.
   - Descripción: `dominant class 'negativo' represents 97.0% of values (balance index: 19.4/100)`

2. **Clase minoritaria:** `0.03 ≤ 0.05` → severidad `medium` (ya que `0.03 > 0.02`).
   - Descripción: `minority class 'positivo' at 3.00% of values`

**Score global:** `0.1944 × weight`.
