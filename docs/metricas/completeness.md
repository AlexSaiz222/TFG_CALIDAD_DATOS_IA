# Completeness — Métrica de Completitud

**Archivo fuente:** `backend/services/metrics/completeness.py`
**ID en el sistema:** `completeness`

---

## 1. Descripción teórica

La completitud mide **qué porcentaje de los valores esperados están realmente presentes** en el dataset (es decir, no son nulos). Es la métrica de calidad más básica y suele ser el primer indicador de un problema de recolección o integración de datos.

Un dataset puede tener un score de completitud global alto pero ocultar columnas individuales con una tasa de nulos preocupante. Por eso esta métrica opera en dos niveles: **global** (todo el dataset) y **por columna**.

**Por qué importa:**
- Los modelos de ML y los análisis estadísticos son sensibles a los valores faltantes.
- Un campo crítico con un 30 % de nulos puede invalidar completamente un análisis aunque el resto del dataset sea perfecto.

---

## 2. Parámetros de configuración

| Parámetro | Tipo | Valor por defecto | Descripción |
|-----------|------|-------------------|-------------|
| `columns` | `list[str]` | `[]` (todas) | Columnas a evaluar. Si está vacío, se evalúan todas. |
| `threshold` | `float` | `0.95` | Umbral mínimo de completitud global y por columna (0.0–1.0). |
| `null_patterns` | `dict` | `null` (desactivado) | Patrones de nulidad configurables. Ver formato abajo. |
| `weight` | `float` | `1.0` | Peso de esta métrica en el Quality Score global (se aplica en el servicio, no dentro de la métrica). |

### Parámetro `null_patterns`

Permite tratar valores no-nulos nativamente (cadenas como `"NULL"`, `"N/A"`, `""`) como si fueran nulos, convirtiéndolos a `NaN` antes de calcular la completitud. Esto mantiene consistencia entre la métrica y el profiling.

Formato:

```json
{
  "presets": ["empty_string", "null_word", "na", "nan", "none", "dash", "whitespace_only"],
  "custom": ["^sin_dato$", "^desconocido$"]
}
```

- **`presets`**: lista de claves del catálogo de presets predefinidos en `BaseMetric.PRESET_NULL_PATTERNS`.
- **`custom`**: lista de expresiones regulares libres (se validan en tiempo de ejecución; las inválidas se ignoran con warning).

| Preset | Regex |
|--------|-------|
| `empty_string` | `^$` |
| `null_word` | `^null$` |
| `na` | `^n/?a$` |
| `nan` | `^nan$` |
| `none` | `^none$` |
| `dash` | `^[-–—]$` |
| `whitespace_only` | `^\s+$` |

Si `null_patterns` es `null` o no se proporciona, la métrica se comporta igual que antes (solo `NaN` nativo se considera nulo). Solo se actúa sobre columnas de tipo `object`/string; las numéricas ya representan ausencia con `NaN` nativo.

Ejemplo de configuración completa:

```json
{
  "id": "completeness",
  "parameters": {
    "columns": ["nombre", "email", "fecha_nacimiento"],
    "threshold": 0.98,
    "null_patterns": {
      "presets": ["empty_string", "null_word", "na"],
      "custom": []
    }
  },
  "weight": 1.0
}
```

---

## 3. Algoritmo de cálculo

### Paso 0: Normalización de nulos (si `null_patterns` está configurado)

Antes de calcular, se llama a `BaseMetric.apply_null_patterns(df, null_patterns, columns)`, que:
1. Combina los presets seleccionados y los patrones custom en una única regex alternada.
2. Recorre las columnas de tipo `object` (o las columnas configuradas si `columns` no está vacío).
3. Reemplaza por `NaN` cualquier valor que coincida con la regex combinada.

El DataFrame resultante es el que se usa para los cálculos siguientes.

### Score global

**Con columnas específicas** (`columns` no vacío):

```
completeness = media( [1 - ratio_nulos(col) para col en columns] )
```

**Sin columnas específicas** (por defecto):

```
completeness = 1 - media_de_todas_las_columnas( ratio_nulos(col) )
             = 1 - df.isna().mean().mean()
```

Donde `ratio_nulos(col) = nulos_en_col / total_filas`.

### Completitud por columna (siempre se calcula)

Para cada columna del dataset, independientemente de los parámetros:

```
col_completeness = 1 - df[col].isna().mean()
```

Esta medición por columna se usa exclusivamente para generar issues individuales (ver sección 5).

---

## 4. Cálculo del score

La métrica devuelve el valor crudo `completeness` en el rango `[0.0, 1.0]`:

```
score = completeness
```

- El peso (`weight`) se aplica una única vez en el cálculo global del Quality Score dentro del servicio; **no** se multiplica dentro de la métrica.
- Un score de `1.0` significa completitud perfecta (0 % de nulos).
- Un score de `0.0` significa que todas las celdas son nulas.

---

## 5. Generación de issues

Esta métrica puede generar dos tipos de issues:

### Issue global (nivel dataset)

**Condición:** `completeness < threshold`

Se incluye en el issue la lista de columnas problemáticas (aquellas cuyo ratio de nulos supera `1 - threshold`):

```json
{
  "severity": "<calculada>",
  "description": "Dataset completeness (87.50%) is below threshold (95.00%)",
  "affected_columns": [
    { "column": "email",    "null_rate": 0.15 },
    { "column": "telefono", "null_rate": 0.08 }
  ],
  "issue_type": "completeness",
  "fingerprint": "<hash>"
}
```

### Issue por columna

**Condición:** `col_completeness < threshold` (se respeta el umbral configurado por el usuario)

Se genera un issue separado por cada columna que baje del umbral:

```json
{
  "severity": "<calculada>",
  "description": "Column 'email' has low completeness (85.00%)",
  "affected_columns": [
    { "column": "email", "null_rate": 0.15 }
  ],
  "issue_type": "completeness",
  "fingerprint": "<hash-específico-de-columna>"
}
```

> Ambos tipos de issues usan el mismo `threshold` configurado, de modo que el comportamiento de la métrica respeta la intención del usuario: si tolera un 90 % de completitud a nivel global, tampoco se marcarán columnas al 92 % como problemáticas.

---

## 6. Cálculo de severidad

La severidad se calcula mediante `BaseMetric.calculate_dynamic_severity()` con `higher_is_better=True`:

| Condición | Severidad |
|-----------|-----------|
| `actual_value >= threshold` | `low` (no hay problema) |
| `actual_value < 0.50` | `critical` |
| `actual_value < 0.70` | `high` |
| `threshold - actual_value > 0.15` | `high` |
| `threshold - actual_value > 0.05` | `medium` |
| en otro caso | `low` |

**Ejemplos:**
- Completitud del 45 % con umbral 95 % → `critical`
- Completitud del 65 % con umbral 95 % → `high`
- Completitud del 82 % con umbral 95 % → `high` (distancia = 0.13 > 0.05)
- Completitud del 92 % con umbral 95 % → `medium` (distancia = 0.03 < 0.05)

---

## 7. Fingerprint

El fingerprint identifica de forma única cada issue para poder compararlo entre evaluaciones.

- **Issue global:** `generate_column_issue_fingerprint(issue_type="completeness", column_name="_dataset_", threshold=threshold)`
- **Issue por columna:** `generate_column_issue_fingerprint(issue_type="completeness", column_name=col)`

El issue global usa el nombre virtual `_dataset_` para distinguirlo de los issues por columna.

---

## 8. Ejemplo práctico

**Dataset de entrada** (6 filas):

| id | nombre | email | edad |
|----|--------|-------|------|
| 1 | Ana | ana@mail.com | 25 |
| 2 | Luis | NULL | 30 |
| 3 | María | maria@mail.com | NULL |
| 4 | NULL | NULL | 28 |
| 5 | Pedro | pedro@mail.com | 22 |
| 6 | Sofía | NULL | NULL |

**Configuración:** `threshold=0.95`, columnas: todas.

**Cálculo:**

```
ratio_nulos(id)     = 0/6 = 0.00
ratio_nulos(nombre) = 1/6 = 0.167
ratio_nulos(email)  = 3/6 = 0.50
ratio_nulos(edad)   = 2/6 = 0.333

completeness = 1 - (0.00 + 0.167 + 0.50 + 0.333) / 4
             = 1 - 0.25
             = 0.75
```

**Resultado:**
- Score: `0.75` → por debajo del umbral `0.95`.
- Issue global: severidad `high` (distancia = 0.95 − 0.75 = 0.20 > 0.15 → `high`).
- Issue por columna `email`: completitud 50 % < 95 % → severidad `high` (distancia = 0.45 > 0.15).
- Issue por columna `edad`: completitud 67 % < 95 % → severidad `high` (0.67 < 0.70).
- Issue por columna `nombre`: completitud 83 % < 95 % → severidad `medium` (distancia = 0.12, > 0.05, y valor ≥ 0.70).
