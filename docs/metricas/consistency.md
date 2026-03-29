# Consistency — Métrica de Consistencia de Patrón

**Archivo fuente:** `backend/services/metrics/consistency.py`
**ID en el sistema:** `consistency`

---

## 1. Descripción teórica

La consistencia de patrón mide **qué porcentaje de los valores de una columna cumplen un formato específico** definido mediante una expresión regular. Es una métrica de validación estructural: no juzga si el valor es semánticamente correcto, sino si respeta el patrón esperado.

**Diferencia con `syntactic_accuracy`:**
- `consistency` valida **una columna** con **un patrón libre** especificado por el usuario.
- `syntactic_accuracy` valida múltiples columnas contra un **catálogo de tipos predefinidos** (email, DNI, UUID, etc.) con auto-detección opcional.

**Por qué importa:**
- Permite detectar datos mal formateados en columnas con un formato de negocio específico (ej. códigos de producto, matrículas, referencias internas).
- Es útil cuando el formato no coincide con ningún tipo estándar del catálogo.

---

## 2. Parámetros de configuración

| Parámetro | Tipo | Valor por defecto | Descripción |
|-----------|------|-------------------|-------------|
| `column` | `str` | — | **Obligatorio.** Nombre de la columna a validar. |
| `pattern` | `str` | — | **Obligatorio.** Expresión regular a aplicar. |
| `threshold` | `float` | `0.95` | Mínimo porcentaje de valores que deben cumplir el patrón. |
| `weight` | `float` | `1.0` | Peso en el Quality Score global. |

> Si `column` o `pattern` no se especifican, la métrica devuelve `score=None` y no genera issues (se omite en el cálculo global).

Ejemplo de configuración:

```json
{
  "id": "consistency",
  "parameters": {
    "column": "codigo_producto",
    "pattern": "^[A-Z]{2}-\\d{4}-[A-Z0-9]{3}$",
    "threshold": 0.98
  },
  "weight": 1.0
}
```

---

## 3. Algoritmo de cálculo

```python
regex = re.compile(pattern)

valid_count = 0
invalid_count = 0
invalid_examples = []

for value in df[column].dropna():
    str_value = str(value)
    if regex.match(str_value):   # regex.match() valida desde el inicio de la cadena
        valid_count += 1
    else:
        invalid_count += 1
        if len(invalid_examples) < 5:
            invalid_examples.append(str_value)

total = valid_count + invalid_count
score = valid_count / total   # Si total==0 → score=1.0
```

**Notas importantes:**
- Se usa `regex.match()`, que ancla el patrón al **inicio** de la cadena. Si se quiere validar toda la cadena, el patrón debe terminar con `$`.
- Los valores nulos (`NaN`) se **ignoran** en el cálculo (no se cuentan como inválidos).
- Si el patrón regex es inválido, se genera un issue de error y `score=None`.

---

## 4. Cálculo del score

```
score = (valid_count / total) × weight
```

Si no hay valores no nulos (`total=0`), `score=1.0` (se asume perfecto por ausencia de datos evaluables).

Si el patrón es inválido, `score=None` (la métrica se excluye del cálculo global).

---

## 5. Generación de issues

### Issue: patrón regex inválido

**Condición:** `re.compile(pattern)` lanza `re.error`.

```json
{
  "severity": "high",
  "description": "Invalid regex pattern '[A-Z' for column 'codigo'",
  "issue_type": "consistency",
  "fingerprint": "<hash>"
}
```

La métrica termina aquí devolviendo `score=None`.

### Issue: valores que no cumplen el patrón

**Condición:** `score < threshold`.

Se incluyen hasta 5 ejemplos de valores inválidos. Si la columna es sensible, los ejemplos se sustituyen por `"***"`.

```json
{
  "severity": "high",
  "description": "Column 'codigo_producto' has 23 values that don't match pattern '^[A-Z]{2}-\\d{4}-[A-Z0-9]{3}$'",
  "affected_columns": [
    { "column": "codigo_producto", "invalid_count": 23 }
  ],
  "details": {
    "valid_count": 477,
    "invalid_count": 23,
    "examples": ["ab-1234-abc", "ZZ1234XYZ", "A1-0001-X"]
  },
  "issue_type": "consistency",
  "fingerprint": "<hash>"
}
```

---

## 6. Cálculo de severidad

Para el issue de valores no conformes, la severidad es **fija** (no usa `calculate_dynamic_severity`):

| Condición | Severidad |
|-----------|-----------|
| `score < 0.80` | `high` |
| `0.80 ≤ score < threshold` | `medium` |

---

## 7. Fingerprint

| Tipo de issue | Función |
|---------------|---------|
| Patrón inválido | `generate_issue_fingerprint(type="consistency_error", column, rule_key="invalid_pattern", extra_params={pattern})` |
| Valores no conformes | `generate_pattern_issue_fingerprint(column_name=column, pattern=pattern)` |

El fingerprint del issue de conformidad incluye el patrón, por lo que si se cambia el patrón el fingerprint también cambia (se considera un issue nuevo).

---

## 8. Ejemplo práctico

**Dataset de entrada** (10 filas, columna `matricula`):

| matricula |
|-----------|
| 1234 ABC |
| 5678 XYZ |
| 9012 DEF |
| 1234-ABC | ← guión en lugar de espacio |
| 3456 GHI |
| 7890 JKL |
| ABCD 123 | ← formato incorrecto |
| 2345 MNO |
| 6789 PQR |
| 0123 STU |

**Configuración:**
```json
{ "column": "matricula", "pattern": "^\\d{4} [A-Z]{3}$", "threshold": 0.95 }
```

**Cálculo:**
```
Valores válidos:  8 (coinciden con patrón)
Valores inválidos: 2 ("1234-ABC", "ABCD 123")
total = 10
score = 8/10 = 0.80
```

**Resultado:**
- Score: `0.80`.
- `0.80 < 0.95` (threshold) → se genera issue.
- Severidad: `score < 0.80`? No (es exactamente 0.80) → `medium`.
- Ejemplos: `["1234-ABC", "ABCD 123"]`.
