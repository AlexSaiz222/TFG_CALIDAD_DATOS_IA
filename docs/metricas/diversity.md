# Diversity — Métrica de Diversidad

**Archivo fuente:** `backend/services/metrics/diversity.py`
**ID en el sistema:** `diversity`
**Código ISO/IEC 5259-2:2024:** Diversidad (Additional Data Quality Characteristics for Analytics and ML)

---

## 1. Descripción teórica

> **Métrica opt-in por columna.** Solo contribuye al Quality Score cuando el usuario define expectativas concretas para al menos una columna (valores esperados para categóricas o rango esperado para numéricas). Si no hay expectativas definidas (o ninguna columna configurada existe en el DataFrame), la métrica devuelve `score=None` y queda **excluida del cálculo global**, de forma análoga a Class Balance en modo auto-detect.

La diversidad mide **si el dataset cubre adecuadamente los valores y rangos que el usuario espera** para cada columna. Un dataset puede ser completo, único y consistente pero carecer de representación de ciertos grupos o segmentos, lo que limitaría la capacidad de generalización de un modelo entrenado con él.

A diferencia de Class Balance (que mide si las **proporciones** entre clases están equilibradas), Diversity mide si todos los **valores o rangos** esperados están **presentes** y con una representación mínima.

**Por qué importa (ISO 5259-2):**
- Un modelo de reconocimiento facial entrenado solo con datos de ciertos grupos demográficos producirá resultados sesgados.
- Un sistema de recomendación que solo ve ciertos productos no puede recomendar los demás.
- La diversidad es una medida **desde la perspectiva del consumidor**: depende del contexto y propósito del usuario.

---

## 2. Parámetros de configuración

| Parámetro | Tipo | Valor por defecto | Descripción |
|-----------|------|-------------------|-------------|
| `columns` | `dict[str, ColConfig]` | `{}` | Mapa de columna → configuración de expectativas. Cada clave es un nombre de columna del dataset. |
| `threshold` | `float` | `0.60` | Score mínimo de diversidad por columna para no generar alerta. |
| `weight` | `float` | `1.0` | Peso en el Quality Score global (se aplica en el servicio, no dentro de la métrica). |

### Configuración por columna (ColConfig)

**Columna categórica:**

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `type` | `"categorical"` | `"categorical"` | Tipo de columna. |
| `expected_values` | `list[str]` | `[]` | Valores que deberían estar presentes en el dataset. Si está vacío, la columna obtiene `col_score = 1.0` sin generar issues. |
| `min_representation` | `float` | `0.01` | Proporción mínima (0–1) que cada valor esperado debe tener sobre los valores **no nulos**. |

**Columna numérica:**

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `type` | `"numeric"` | — | Tipo de columna. |
| `expected_range` | `[min, max]` | — | Rango de valores esperado. Si no se proporciona o es inválido (`len != 2` o `min >= max`), la columna obtiene `col_score = 1.0`. |
| `num_bins` | `int` | `10` | Número de intervalos uniformes para evaluar la cobertura del rango. |

### Ejemplo de configuración

```json
{
  "id": "diversity",
  "parameters": {
    "columns": {
      "genero": {
        "type": "categorical",
        "expected_values": ["masculino", "femenino", "no-binario", "otro"],
        "min_representation": 0.01
      },
      "edad": {
        "type": "numeric",
        "expected_range": [18, 90],
        "num_bins": 10
      }
    },
    "threshold": 0.60
  },
  "weight": 1.0
}
```

---

## 3. Algoritmo de cálculo

### 3.1 Columnas categóricas (`_evaluate_categorical`)

Los valores se convierten a string y se excluyen nulos antes de calcular proporciones:

```python
series = df[col_name].dropna()
actual_values = set(series.astype(str).unique())
value_counts = series.astype(str).value_counts(normalize=True)  # proporción sobre no-nulos
```

Para cada valor esperado se asigna un crédito:

```python
for ev in expected_values:
    if ev in actual_values:
        proportion = value_counts.get(ev, 0.0)
        if proportion >= min_representation:
            credit = 1.0   # presente y con representación adecuada
        else:
            credit = 0.5   # presente pero sub-representado
    else:
        credit = 0.0       # ausente

# full_present = presentes con representación adecuada
full_present = len(present) - len(underrepresented)
col_score = (full_present + 0.5 * len(underrepresented)) / len(expected_values)
col_score = clip(col_score, 0.0, 1.0)
```

Si `expected_values` está vacío → `col_score = 1.0` (sin issues, puramente informacional).

### 3.2 Columnas numéricas (`_evaluate_numeric`)

Los valores se convierten a numérico y se excluyen nulos y errores de conversión:

```python
series = pd.to_numeric(df[col_name], errors="coerce").dropna()
```

La serie se recorta al rango esperado y se divide en bins uniformes:

```python
clipped = series.clip(lower=range_min, upper=range_max)
bin_edges = np.linspace(range_min, range_max, num_bins + 1)
hist_counts, _ = np.histogram(clipped, bins=bin_edges)

bins_covered = count(hist_counts > 0)
col_score = bins_covered / num_bins
```

**Casos especiales:**
- Si `expected_range` no tiene exactamente 2 elementos → `col_score = 1.0`, sin issues.
- Si `range_min >= range_max` → `col_score = 1.0`, sin issues.
- Si la serie tras dropna está vacía → `col_score = 1.0`, sin issues.

### 3.3 Score global

```python
if col_scores:                # al menos una columna evaluada
    overall = mean(col_scores)
else:
    overall = 1.0

# Solo contribuye al Quality Score si hay expectativas definidas Y al menos una columna evaluada
has_expectations = len(col_configs) > 0 and len(col_scores) > 0
score = overall if has_expectations else None
```

El peso (`weight`) se aplica una única vez en el cálculo global del Quality Score dentro del servicio; **no** se multiplica dentro de la métrica.

---

## 4. Estructura de resultados

### Nivel superior (`MetricResult.results["diversity"]`)

```json
{
  "overall_diversity": 70.00,
  "columns_analyzed": 2,
  "columns_below_threshold": 1,
  "threshold": 0.60,
  "columns": {
    "genero": { "..." : "ver abajo" },
    "edad": { "..." : "ver abajo" }
  }
}
```

### Resultado por columna categórica

```json
{
  "type": "categorical",
  "diversity_score": 70.00,
  "expected_values": ["masculino", "femenino", "no-binario", "otro"],
  "present_values": 3,
  "missing_values": ["no-binario"],
  "underrepresented": [
    { "value": "otro", "proportion": 0.005 }
  ],
  "total_unique_actual": 4,
  "total_rows": 950
}
```

- `present_values`: número de valores esperados encontrados (incluye sub-representados).
- `total_rows`: número de valores no nulos (= `series.dropna().len()`), **no** el total de filas del dataset.
- `total_unique_actual`: valores únicos reales en la columna (puede ser mayor que `len(expected_values)` si hay categorías no contempladas).

### Resultado por columna numérica

```json
{
  "type": "numeric",
  "diversity_score": 70.00,
  "expected_range": [18, 90],
  "actual_range": [22, 65],
  "bins_covered": 7,
  "total_bins": 10,
  "bin_counts": [0, 50, 120, 200, 180, 150, 100, 80, 0, 0],
  "total_rows": 880
}
```

- `actual_range`: `[min, max]` reales de la serie numérica sin clipping, mostrando cuánto del rango esperado está realmente cubierto por los datos.
- `bin_counts`: array de `num_bins` enteros con el conteo de filas en cada intervalo tras clipping.
- `total_rows`: número de valores numéricos válidos (post `to_numeric` + `dropna`).

### Columnas sensibles

Si la columna aparece en `dataset.sensitive_columns`:
- `expected_values` → `["***", "***", ...]` (misma longitud).
- `missing_values` → `["***", ...]`.
- `underrepresented` → `[{"value": "***", "proportion": 0.005}]`.
- Los valores en `description` de los issues se sustituyen por `"***"`.

---

## 5. Generación de issues

### Issue: valor esperado ausente

**Condición:** Un valor de `expected_values` no aparece en los valores únicos no-nulos de la columna.

Se genera **un issue por cada valor ausente**.

```json
{
  "severity": "<calculada>",
  "description": "El valor esperado 'no-binario' no está presente en la columna 'genero'",
  "affected_columns": [{ "column": "genero", "missing_value": "no-binario" }],
  "issue_type": "diversity",
  "actual_value": "3/4 valores presentes",
  "fingerprint": "<hash>"
}
```

La severidad se calcula con `calculate_dynamic_severity(col_score, threshold, metric_type="diversity")`.

### Issue: valor sub-representado

**Condición:** Un valor esperado está presente pero su proporción (sobre no-nulos) es menor que `min_representation`.

Se genera **un issue por cada valor sub-representado**.

```json
{
  "severity": "<calculada>",
  "description": "El valor 'otro' en 'genero' tiene solo 0.50% de representación (mínimo esperado: 1.00%)",
  "affected_columns": [{ "column": "genero", "value": "otro", "proportion": 0.005 }],
  "issue_type": "diversity",
  "actual_value": "0.50%",
  "fingerprint": "<hash>"
}
```

La severidad es **fija** (no usa `calculate_dynamic_severity`):

| Condición | Severidad |
|-----------|-----------|
| `proportion < min_representation / 2` | `medium` |
| `proportion >= min_representation / 2` (pero `< min_representation`) | `low` |

### Issue: baja cobertura de rango numérico

**Condición:** `col_score < threshold` para una columna numérica.

Se genera **un issue por columna**.

```json
{
  "severity": "<calculada>",
  "description": "La columna 'edad' solo cubre 40% del rango esperado [18.0, 90.0] (4/10 bins con datos)",
  "affected_columns": [{ "column": "edad", "bins_covered": 4, "total_bins": 10, "empty_bins_sample": ["[18.0, 25.2)", "[68.4, 75.6)", "..."] }],
  "issue_type": "diversity",
  "actual_value": "40%",
  "fingerprint": "<hash>"
}
```

- `empty_bins_sample`: muestra hasta 5 intervalos vacíos para orientar al usuario.
- La severidad se calcula con `calculate_dynamic_severity(col_score, threshold, metric_type="diversity")`.

---

## 6. Cálculo de severidad

### Issues de valor ausente y baja cobertura numérica

Usan `calculate_dynamic_severity()` con `metric_type="diversity"` y `actual_value = col_score`:

| `col_score` | Severidad |
|-------------|-----------|
| `≤ 0.20` | `critical` |
| `≤ 0.40` | `high` |
| `< threshold` | `medium` |
| `≥ threshold` | `low` |

**Ejemplos** (con `threshold = 0.60`):
- `col_score = 0.10` → `critical` (solo 1 de 10 valores presentes).
- `col_score = 0.30` → `high` (menos de la mitad de los valores presentes).
- `col_score = 0.50` → `medium` (por debajo del umbral 0.60).
- `col_score = 0.70` → `low` (por encima del umbral).

### Issues de sub-representación

Severidad **fija** basada en la proporción del valor individual:

| `proportion` | Severidad |
|--------------|-----------|
| `< min_representation / 2` | `medium` |
| `< min_representation` | `low` |

**Ejemplo** (`min_representation = 0.01`):
- Valor con `0.003` (0.3 %) → `medium` (0.003 < 0.005).
- Valor con `0.007` (0.7 %) → `low` (0.007 ≥ 0.005 pero < 0.01).

---

## 7. Fingerprint

Cada tipo de issue tiene su propia función de fingerprint, lo que permite rastrear la evolución de cada issue entre evaluaciones.

| Tipo de issue | Función | Parámetros |
|---------------|---------|------------|
| Valor ausente | `generate_diversity_fingerprint(column_name, "missing_value", expected_value=valor)` | Fingerprint único por columna + valor esperado. |
| Sub-representado | `generate_diversity_fingerprint(column_name, "underrepresented", expected_value=valor)` | Fingerprint único por columna + valor esperado. |
| Baja cobertura numérica | `generate_diversity_fingerprint(column_name, "low_range_coverage")` | Fingerprint único por columna (sin valor específico). |

**Nota:** El fingerprint de sub-representación usa el valor **real** (no enmascarado) para que el hash sea determinista aunque la columna sea sensible. El enmascaramiento solo afecta a `description` y `affected_columns`.

---

## 8. Ejemplo práctico

### Dataset

1000 filas. Columna `pais` (categórica) y columna `edad` (numérica). Sin nulos.

**Columna `pais`:**

| País | Count | Proporción |
|------|-------|------------|
| ES | 500 | 50.0 % |
| FR | 300 | 30.0 % |
| DE | 195 | 19.5 % |
| IT | 5 | 0.5 % |
| PT | — | ausente |

**Columna `edad`:** valores distribuidos entre 25 y 55 (ningún valor fuera de ese rango).

### Configuración

```json
{
  "columns": {
    "pais": {
      "type": "categorical",
      "expected_values": ["ES", "FR", "DE", "IT", "PT"],
      "min_representation": 0.01
    },
    "edad": {
      "type": "numeric",
      "expected_range": [18, 90],
      "num_bins": 10
    }
  },
  "threshold": 0.60
}
```

### Cálculo — columna `pais`

```
value_counts (normalize=True, sobre 1000 no-nulos):
  ES: 0.50, FR: 0.30, DE: 0.195, IT: 0.005

ES: presente, 0.50 >= 0.01 → credit = 1.0
FR: presente, 0.30 >= 0.01 → credit = 1.0
DE: presente, 0.195 >= 0.01 → credit = 1.0
IT: presente, 0.005 < 0.01  → credit = 0.5 (sub-representado)
PT: ausente                  → credit = 0.0

full_present = 4 (presentes) - 1 (sub-representado) = 3
col_score = (3 + 0.5 × 1) / 5 = 3.5 / 5 = 0.70
```

### Cálculo — columna `edad`

```
expected_range = [18, 90], num_bins = 10
bin_edges = [18.0, 25.2, 32.4, 39.6, 46.8, 54.0, 61.2, 68.4, 75.6, 82.8, 90.0]

Datos reales: 25–55 (tras clip a [18, 90], los valores no cambian)
Bins con datos: [25.2, 32.4), [32.4, 39.6), [39.6, 46.8), [46.8, 54.0) → 4 bins
Nota: el bin [18.0, 25.2) podría tener el valor 25 en su límite → depende de la distribución exacta.

Supongamos bins_covered = 5 (bins 2–6 con datos)
col_score = 5 / 10 = 0.50
```

### Score global

```
overall = mean([0.70, 0.50]) = 0.60
has_expectations = True (2 columnas configuradas, 2 evaluadas)
score = 0.60
```

### Issues generados

1. **Valor ausente `PT` en `pais`:**
   - Severidad: `calculate_dynamic_severity(0.70, 0.60, "diversity")` → `0.70 ≥ 0.60` → `low`.
   - Descripción: `"El valor esperado 'PT' no está presente en la columna 'pais'"`.

2. **Valor sub-representado `IT` en `pais`:**
   - Proporción: `0.005`, `min_representation = 0.01`, `0.005 < 0.01 / 2 = 0.005` → borderline.
   - `0.005 < 0.005` es `False` (no estrictamente menor), → severidad `low`.
   - Descripción: `"El valor 'IT' en 'pais' tiene solo 0.50% de representación (mínimo esperado: 1.00%)"`.

3. **Baja cobertura de rango en `edad`:**
   - Severidad: `calculate_dynamic_severity(0.50, 0.60, "diversity")` → `0.50 > 0.40` y `0.50 < 0.60` → `medium`.
   - Descripción: `"La columna 'edad' solo cubre 50% del rango esperado [18.0, 90.0] (5/10 bins con datos)"`.

### Resultado final

- **Score global:** `0.60` → contribuye al Quality Score.
- `columns_below_threshold`: `1` (solo `edad` con `0.50 < 0.60`).
- `columns_analyzed`: `2`.
