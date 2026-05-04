# Class Balance — Métrica de Balance de Clases

**Archivo fuente:** `backend/services/metrics/class_balance.py`
**ID en el sistema:** `class_balance`

---

## 1. Descripción teórica

> **Métrica opt-in.** Un dataset puede estar legítimamente desbalanceado por la naturaleza del fenómeno que modela (detección de fraude, diagnóstico de enfermedades raras, etc.) sin que eso sea un problema de calidad. Por ese motivo esta métrica **solo contribuye al Quality Score cuando el usuario declara explícitamente qué columnas debe tratar como categóricas objetivo** a través del parámetro `columns` o cuando define una **distribución esperada** con `expected_distribution`. Si el usuario no declara nada, la métrica sigue ejecutándose en modo auto-detect y genera issues informativos, pero devuelve `score=None` y queda **excluida del cálculo global**.

El balance de clases mide **cómo de equilibrada está la distribución de valores en columnas categóricas**. Un dataset con clases muy desequilibradas puede producir modelos sesgados: el modelo aprende a predecir siempre la clase mayoritaria y obtiene una precisión artificialmente alta sin aprender nada útil sobre las clases minoritarias.

La métrica usa la **entropía de Shannon** como medida de equilibrio. Opcionalmente, el usuario puede definir una **distribución esperada** por clase (rangos mínimo–máximo en porcentaje), lo que permite medir la desviación respecto a expectativas concretas de negocio.

**Por qué importa:**
- Es esencial para proyectos de clasificación supervisada (detección de fraude, diagnóstico médico, etc.).
- Un desequilibrio del 99/1 puede hacer que un clasificador que siempre predice "no fraude" tenga 99 % de accuracy.
- También detecta columnas con valores raros que podrían ser errores de entrada.
- Con la **distribución esperada**, el usuario puede expresar que un desequilibrio concreto es normal (e.g. 78% junior, 15% senior, 7% lead) y solo alertar si la realidad se desvía de esos márgenes.

---

## 2. Parámetros de configuración

| Parámetro | Tipo | Valor por defecto | Descripción |
|-----------|------|-------------------|-------------|
| `columns` | `list[str]` | `[]` | Columnas a analizar explícitamente. |
| `auto_detect` | `bool` | `true` | Si es true, detecta automáticamente columnas categóricas. |
| `max_cardinality` | `int` | `50` | Máximo número de valores únicos para considerar una columna categórica en auto-detección. |
| `imbalance_threshold_high` | `float` | `0.90` | Proporción mínima de la clase dominante para generar alerta. |
| `imbalance_threshold_low` | `float` | `0.05` | Proporción máxima de la clase minoritaria para generar alerta. |
| `expected_distribution` | `dict[str, dict[str, [min%, max%]]]` | `{}` | Distribución esperada por columna y clase. Ver formato abajo. |
| `weight` | `float` | `1.0` | Peso en el Quality Score global. |

### Parámetro `expected_distribution`

Permite definir el rango de porcentaje (mínimo–máximo) que se espera para cada clase dentro de una columna. Si la proporción real de una clase cae fuera de su rango, se genera un issue de desviación.

Formato:

```json
{
  "nivel": {
    "junior": [70, 85],
    "senior": [10, 20],
    "lead": [3, 10]
  }
}
```

- Las claves del primer nivel son nombres de columnas.
- Las claves del segundo nivel son nombres de clases.
- Los valores son arrays `[min%, max%]` expresados como porcentajes (0–100).
- Se recomienda que la suma de los puntos medios `(min + max) / 2` sea ≈ 100 %.
- Las columnas que aparezcan en `expected_distribution` se tratan automáticamente como explícitas (contribuyen al Quality Score), aunque no estén en `columns`.

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

### Score de conformidad (si `expected_distribution` está definido)

Para cada columna con distribución esperada se calcula un **conformity_score**:

```
classes_in_range = número de clases cuya proporción real está dentro de [min%, max%]
conformity_score = (classes_in_range / total_expected_classes) × 100
```

Para cada clase fuera de rango se calcula la desviación (en puntos porcentuales):

```
deviation = min(|actual_pct - min_pct|, |actual_pct - max_pct|)
```

### Score por columna (con distribución esperada)

Cuando hay `expected_distribution`, el score por columna combina entropía y conformidad:

```
col_score = 0.5 × (balance_index / 100) + 0.5 × (conformity_score / 100)
```

Si la columna solo tiene entropía (sin distribución esperada):

```
col_score = balance_index / 100
```

### Score global

Tres modos de cálculo:

```
# Modo explícito (user_columns no vacío O expected_distribution con columnas válidas)
overall = media(col_scores sobre columnas explícitas ∪ columnas con expected_distribution)
score   = overall

# Modo auto-detect (sin columnas explícitas ni distribución esperada)
score   = None   # la métrica se excluye del Quality Score global
```

En modo auto-detect las columnas detectadas siguen siendo analizadas, aparecen en `results` y pueden generar issues (clase dominante / clase minoritaria), pero no empujan el score ni hacia arriba ni hacia abajo. El peso (`weight`) se aplica una única vez en el servicio, no dentro de la métrica.

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
  "alerts": [],
  "expected_distribution": {
    "conformity_score": 66.67,
    "classes_in_range": 2,
    "total_expected_classes": 3,
    "class_details": [
      { "class": "junior", "expected_range": [70, 85], "actual_pct": 78.0, "in_range": true, "deviation_pp": 0 },
      { "class": "senior", "expected_range": [10, 20], "actual_pct": 15.0, "in_range": true, "deviation_pp": 0 },
      { "class": "lead",   "expected_range": [3, 10],  "actual_pct": 2.0,  "in_range": false, "deviation_pp": 1.0 }
    ]
  }
}
```

Si la columna está marcada como sensible, `dominant_class`, `minority_class` y todas las claves en `frequency_table` se reemplazan por `"***"`. En `expected_distribution.class_details`, los nombres de clase también se enmascaran.

La tabla de frecuencias muestra hasta **20 clases** individualmente; si hay más, las restantes se agrupan en `"__others__"`.

El campo `expected_distribution` solo aparece si el usuario definió una distribución esperada para esa columna.

---

## 5. Generación de issues

### Issue: clase dominante

**Condición:** `dominant_prop >= imbalance_threshold_high` (por defecto `≥ 90 %`).

```json
{
  "severity": "<calculada>",
  "description": "La columna 'fraude' está muy desequilibrada: la clase dominante 'no' representa el 99.5% de los valores (balance index: 1.0/100)",
  "affected_columns": [
    {
      "column": "fraude",
      "dominant_class": "no",
      "dominant_proportion": 0.995,
      "balance_index": 1.0
    }
  ],
  "issue_type": "class_balance",
  "actual_value": "99.5%",
  "fingerprint": "<hash-dominant_class>"
}
```

### Issue: clase minoritaria

**Condición:** `minority_prop <= imbalance_threshold_low` Y `n_clases > 1` (por defecto `≤ 5 %`).

```json
{
  "severity": "<calculada>",
  "description": "La columna 'categoria' tiene una clase minoritaria subrepresentada 'raro' con 0.80% de los valores",
  "affected_columns": [
    {
      "column": "categoria",
      "minority_class": "raro",
      "minority_proportion": 0.008,
      "balance_index": 45.2
    }
  ],
  "issue_type": "class_balance",
  "actual_value": "0.80%",
  "fingerprint": "<hash-minority_class>"
}
```

### Issue: desviación de distribución esperada

**Condición:** Una clase tiene una proporción real fuera de su rango `[min%, max%]` definido en `expected_distribution`.

Se genera **un issue por cada clase fuera de rango**.

```json
{
  "severity": "<calculada>",
  "description": "La clase 'lead' en 'nivel' tiene 2.0% (por debajo del rango esperado [3%-10%], desviación: 1.0pp)",
  "affected_columns": [
    {
      "column": "nivel",
      "class": "lead",
      "actual_pct": 2.0,
      "expected_range": [3, 10],
      "deviation_pp": 1.0
    }
  ],
  "issue_type": "class_balance",
  "actual_value": "2.0%",
  "fingerprint": "<hash-distribution_deviation-lead>"
}
```

---

## 6. Cálculo de severidad

### Issue de clase dominante

Usa `calculate_dynamic_severity()` con `metric_type="class_balance"` y `actual_value = dominant_prop`:

| Proporción clase dominante | Severidad |
|---------------------------|----------|
| `≥ 99 %` | `critical` |
| `≥ 95 %` | `high` |
| `≥ 90 %` | `medium` |

### Issue de clase minoritaria

Severidad **fija** (no usa `calculate_dynamic_severity`):

| Proporción clase minoritaria | Severidad |
|-----------------------------|----------|
| `< 2 %` | `medium` |
| `2 % – 5 %` | `low` |

### Issue de desviación de distribución esperada

Usa `calculate_dynamic_severity()` con `metric_type="class_balance_deviation"` y `actual_value = deviation / 100` (desviación en pp normalizada):

| Desviación (pp) | Severidad |
|----------------|----------|
| `≥ 20 pp` | `critical` |
| `≥ 10 pp` | `high` |
| `≥ 5 pp` | `medium` |
| `< 5 pp` | `low` |

**Ejemplos:**
- Clase con rango esperado [70%, 85%] y proporción real 45% → desviación = 25pp → `critical`.
- Clase con rango esperado [10%, 20%] y proporción real 8% → desviación = 2pp → `low`.
- Clase con rango esperado [3%, 10%] y proporción real 15% → desviación = 5pp → `medium`.

---

## 7. Fingerprint

| Tipo de issue | Función | Unicidad |
|---------------|---------|----------|
| Clase dominante | `generate_class_balance_fingerprint(column_name=col, imbalance_type="dominant_class")` | Por columna |
| Clase minoritaria | `generate_class_balance_fingerprint(column_name=col, imbalance_type="minority_class")` | Por columna |
| Desviación de distribución | `generate_class_balance_fingerprint(column_name=col, imbalance_type="distribution_deviation", class_name=clase)` | Por columna + clase |

Los tres tipos de issue pueden coexistir en la misma columna y tienen fingerprints distintos. El fingerprint de desviación incluye el nombre de la clase para poder rastrear independientemente cada clase entre evaluaciones.

---

## 8. Ejemplo práctico

### 8.1 Ejemplo básico (sin distribución esperada)

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

**Score global:**
- Si el usuario declaró `columns: ["resultado"]` explícitamente → `score = 0.1944`.
- Si auto-detectada → `score = None`.

---

### 8.2 Ejemplo con distribución esperada

**Dataset de entrada** (columna `nivel`, 1000 filas):

| nivel | count | proporción |
|-------|-------|------------|
| junior | 780 | 78.0 % |
| senior | 150 | 15.0 % |
| lead | 70 | 7.0 % |

**Configuración:**

```json
{
  "columns": ["nivel"],
  "expected_distribution": {
    "nivel": {
      "junior": [70, 85],
      "senior": [10, 20],
      "lead": [3, 10]
    }
  }
}
```

**Cálculo de entropía:**

```
probs = [0.78, 0.15, 0.07]
entropy = -(0.78 × log2(0.78) + 0.15 × log2(0.15) + 0.07 × log2(0.07))
        = -(0.78 × (-0.359) + 0.15 × (-2.737) + 0.07 × (-3.837))
        = 0.280 + 0.411 + 0.269
        = 0.960

max_entropy = log2(3) = 1.585

balance_index = (0.960 / 1.585) × 100 = 60.57
```

**Cálculo de conformidad:**

```
junior: 78.0% dentro de [70, 85] → ✅ in_range
senior: 15.0% dentro de [10, 20] → ✅ in_range
lead:   7.0%  dentro de [3, 10]  → ✅ in_range

classes_in_range = 3 / 3
conformity_score = 100.0
```

**Score por columna:**

```
col_score = 0.5 × (60.57 / 100) + 0.5 × (100 / 100) = 0.5 × 0.6057 + 0.5 × 1.0 = 0.8029
```

**Issues generados:** Ninguno (todas las clases están dentro de sus rangos esperados, y la clase dominante 78% no supera el umbral de 90%).

**Score global:** `0.8029` → contribuye al Quality Score.

---

### 8.3 Ejemplo con desviación

Mismo dataset pero con datos distintos:

| nivel | count | proporción |
|-------|-------|------------|
| junior | 920 | 92.0 % |
| senior | 60 | 6.0 % |
| lead | 20 | 2.0 % |

**Conformidad:**

```
junior: 92.0% fuera de [70, 85] → ❌ desviación = |92 - 85| = 7.0 pp
senior: 6.0%  fuera de [10, 20] → ❌ desviación = |6 - 10| = 4.0 pp
lead:   2.0%  fuera de [3, 10]  → ❌ desviación = |2 - 3| = 1.0 pp

classes_in_range = 0 / 3
conformity_score = 0.0
```

**Issues de desviación:**

1. **junior:** 7.0pp → `calculate_dynamic_severity(0.07, 0.0, "class_balance_deviation")` → `0.07 ≥ 0.05` → `medium`.
2. **senior:** 4.0pp → `calculate_dynamic_severity(0.04, 0.0, "class_balance_deviation")` → `0.04 < 0.05` → `low`.
3. **lead:** 1.0pp → `calculate_dynamic_severity(0.01, 0.0, "class_balance_deviation")` → `0.01 < 0.05` → `low`.

Además, `dominant_prop = 0.92 ≥ 0.90` genera un issue de clase dominante con severidad `medium`.

**Score:**

```
balance_index = ~32 (baja entropía por concentración en junior)
col_score = 0.5 × 0.32 + 0.5 × 0.0 = 0.16
```
