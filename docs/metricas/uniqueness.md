# Uniqueness — Métrica de Unicidad

**Archivo fuente:** `backend/services/metrics/uniqueness.py`
**ID en el sistema:** `uniqueness`

---

## 1. Descripción teórica

La unicidad mide dos aspectos relacionados pero distintos:

1. **Unicidad de filas:** detecta filas duplicadas en el dataset (filas con exactamente los mismos valores en todas las columnas).
2. **Variabilidad por columna:** detecta columnas donde los valores apenas varían (baja entropía), lo cual puede indicar errores de carga, columnas constantes o identificadores mal generados.

**Por qué importa:**
- Los duplicados inflan artificialmente los conteos, sesgando métricas y modelos.
- Una columna que debería ser un identificador único (ej. `user_id`) con duplicados es un indicador claro de un problema de integración de datos.
- Una columna con baja variabilidad puede ser una columna constante que no aporta información o un error de generación de datos.

---

## 2. Parámetros de configuración

| Parámetro | Tipo | Valor por defecto | Descripción |
|-----------|------|-------------------|-------------|
| `threshold` | `float` | `1.0` | Unicidad mínima de filas esperada (1.0 = sin duplicados). |
| `columns` | `list[str]` | `[]` | Columnas que **deben** ser únicas (identificadores). Se evalúan adicionalmente. |
| `weight` | `float` | `1.0` | Peso en el Quality Score global. |

Ejemplo de configuración:

```json
{
  "id": "uniqueness",
  "parameters": {
    "threshold": 1.0,
    "columns": ["user_id", "transaction_id"]
  },
  "weight": 1.0
}
```

---

## 3. Algoritmo de cálculo

### 3.1 Unicidad de filas

```
filas_únicas = número de filas sin duplicado (drop_duplicates)
row_uniqueness = filas_únicas / total_filas
```

Si el dataset está vacío se asume `row_uniqueness = 1.0`.

### 3.2 Variabilidad por columna (adaptativa)

Para cada columna del dataset:

```
non_null_count = número de valores no nulos
num_unique     = número de valores únicos (excluyendo nulos)
col_variability = num_unique / non_null_count
threshold_col   = _adaptive_variability_threshold(columna)
```

Si `col_variability < threshold_col` Y `total_filas > 10`, se registra un problema de variabilidad.

#### Cálculo del umbral adaptativo

El umbral depende del tipo semántico de la columna:

| Tipo detectado | Umbral |
|----------------|--------|
| Columna de ID (`*_id`, `id`, `*_uuid`, `*_key`, etc.) | `0.95` (95 % de valores deben ser únicos) |
| Columna categórica (`≤ 20 valores únicos` y no numérica) | `0.05` (se espera poca variabilidad) |
| Cualquier otra (numérica, texto libre) | `0.30` |

La detección de columnas de ID se realiza por expresiones regulares sobre el nombre:

```python
id_patterns = [r"_id$", r"^id$", r"_uuid$", r"^uuid$", r"_guid$", r"_key$"]
```

### 3.3 Unicidad de columnas específicas (parámetro `columns`)

Para cada columna en `parameters["columns"]`:

```
col_uniqueness = num_unique / non_null_count
duplicate_count = non_null_count - num_unique
```

Si `col_uniqueness < threshold` y hay duplicados, se genera un issue de tipo `non_unique_identifier`.

---

## 4. Cálculo del score

El score combina la unicidad a nivel de fila con la salud de las columnas identificadoras detectadas (ID/UUID/key):

```
id_health = media( min(1.0, col_variability / threshold_col) )   # solo sobre columnas ID detectadas

if hay columnas ID:
    score = 0.7 × row_uniqueness + 0.3 × id_health
else:
    score = row_uniqueness
```

- `col_variability / threshold_col` se acota a `1.0`, de modo que una columna ID saludable aporta su máximo (`1.0`) y solo penaliza cuando está por debajo del umbral adaptativo.
- El peso (`weight`) se aplica una única vez en el cálculo global del Quality Score dentro del servicio; no se multiplica dentro de la métrica.
- La mezcla `0.7 / 0.3` refleja que las filas duplicadas siguen siendo el problema dominante, pero un identificador casi constante (p. ej. `user_id` con 5 valores distintos en 10 000 filas) degrada el score aunque no haya duplicados de fila.

---

## 5. Generación de issues

Esta métrica puede generar tres tipos de issues:

### Issue: baja variabilidad en columna

**Condición:** `col_variability < threshold_col` para alguna columna.

```json
{
  "severity": "<calculada>",
  "description": "Low variability in ID column 'user_id' (2.50% unique values)",
  "affected_columns": [
    {
      "column": "user_id",
      "variability": 0.025,
      "unique_values": 5,
      "non_null_count": 200,
      "threshold_used": 0.95,
      "column_type": "ID"
    }
  ],
  "issue_type": "low_variability",
  "fingerprint": "<hash>"
}
```

### Issue: filas duplicadas

**Condición:** `row_uniqueness < threshold` (por defecto cualquier duplicado detectado).

Se incluyen hasta 5 filas duplicadas de muestra. Las columnas sensibles se enmascaran con `"***"`.

```json
{
  "severity": "<calculada>",
  "description": "Dataset contains 15 duplicate rows (7.50% of total)",
  "affected_rows": {
    "count": 15,
    "sample": [
      { "id": 42, "nombre": "Ana", "email": "***" }
    ]
  },
  "issue_type": "duplicate_rows",
  "fingerprint": "<hash>"
}
```

### Issue: columna de identificador no única

**Condición:** columna especificada en `columns` tiene duplicados.

```json
{
  "severity": "<calculada>",
  "description": "Column 'user_id' expected to be unique but contains 3 duplicate values (98.50% unique)",
  "affected_columns": [
    {
      "column": "user_id",
      "duplicate_count": 3,
      "uniqueness": 0.985
    }
  ],
  "issue_type": "non_unique_identifier",
  "fingerprint": "<hash>"
}
```

---

## 6. Cálculo de severidad

Usa `calculate_dynamic_severity()` con `higher_is_better=True`:

| Condición | Severidad |
|-----------|-----------|
| `actual >= threshold` | `low` |
| `actual < 0.50` | `critical` |
| `actual < 0.70` | `high` |
| `threshold - actual > 0.15` | `high` |
| `threshold - actual > 0.05` | `medium` |
| en otro caso | `low` |

Para filas duplicadas con `threshold=1.0`, casi cualquier nivel de duplicación resultará en severidad alta salvo duplicaciones mínimas (<5 %).

---

## 7. Fingerprint

| Tipo de issue | Función |
|---------------|---------|
| Baja variabilidad | `generate_issue_fingerprint(type="low_variability", column, rule_key="adaptive_threshold", extra_params={threshold})` |
| Filas duplicadas | `generate_duplicate_issue_fingerprint(is_row_level=True)` |
| Identificador no único | `generate_issue_fingerprint(type="non_unique_identifier", column, rule_key="expected_unique", extra_params={threshold})` |

---

## 8. Ejemplo práctico

**Dataset de entrada** (10 filas):

| user_id | nombre | estado |
|---------|--------|--------|
| 1 | Ana | activo |
| 2 | Luis | activo |
| 3 | María | inactivo |
| 2 | Luis | activo | ← duplicado |
| 4 | Pedro | activo |
| 5 | Sofía | activo |
| 6 | Carlos | activo |
| 7 | Elena | inactivo |
| 8 | Javier | activo |
| 8 | Javier | activo | ← duplicado |

**Configuración:** `columns: ["user_id"]`, `threshold: 1.0`.

**Cálculo:**

```
row_uniqueness = 8 / 10 = 0.80   (2 filas duplicadas)

variabilidad user_id:
  num_unique = 9 (el 8 aparece dos veces)
  non_null = 10
  variabilidad = 9/10 = 0.90 < umbral ID (0.95) → issue

variabilidad estado:
  num_unique = 2
  non_null = 10
  variabilidad = 2/10 = 0.20 > umbral categórico (0.05) → ok
```

**Score:**
```
id_health = min(1.0, 0.90 / 0.95) = 0.9474
score = 0.7 × 0.80 + 0.3 × 0.9474 = 0.8442
```

**Issues generados:**
1. Filas duplicadas: `row_uniqueness=0.80 < 1.0` → severidad `high`.
2. `user_id` baja variabilidad: `0.90 < 0.95` → severidad `medium`.
3. `user_id` no único (parámetro `columns`): `0.90 < 1.0`, `duplicate_count=1` → severidad `medium`.
