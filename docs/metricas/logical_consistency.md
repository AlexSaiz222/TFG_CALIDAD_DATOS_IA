# Logical Consistency — Métrica de Consistencia Lógica

**Archivo fuente:** `backend/services/metrics/logical_consistency.py`
**ID en el sistema:** `logical_consistency`

---

## 1. Descripción teórica

La consistencia lógica valida **reglas de negocio que involucran relaciones entre columnas**. Son restricciones semánticas del dominio que no pueden capturarse con simples validaciones de formato: "si el estado es 'pagado', entonces la fecha de pago no puede ser nula", "el precio de venta siempre debe ser mayor que el precio de coste", etc.

Esta métrica implementa dos tipos de reglas:

- **IF-THEN:** condición sobre un subconjunto de filas → aserción que deben cumplir esas filas.
- **Violación directa:** expresión pandas que selecciona directamente las filas que **violan** la regla.

**Por qué importa:**
- Los errores lógicos entre columnas son invisibles para otras métricas (una columna puede tener perfecta completitud, unicidad y formato, y aun así violar una regla de negocio).
- Son los errores más costosos de detectar manualmente en datasets grandes.

**Seguridad:** Las reglas se ejecutan mediante `pandas.DataFrame.query()`. Para prevenir inyección de código, la métrica verifica que la expresión no contenga tokens peligrosos antes de ejecutarla.

---

## 2. Parámetros de configuración

| Parámetro | Tipo | Valor por defecto | Descripción |
|-----------|------|-------------------|-------------|
| `rules` | `list[dict]` | `[]` | Lista de reglas a evaluar. Ver formato abajo. |
| `weight` | `float` | `1.0` | Peso en el Quality Score global. |

Si `rules` está vacío, la métrica devuelve `score=None` y se omite del cálculo global.

### Formato de una regla

**Tipo IF-THEN:**

```json
{
  "name": "Fecha de pago requerida si estado es pagado",
  "type": "if_then",
  "expression": "IF estado == 'pagado' THEN fecha_pago == fecha_pago",
  "condition": "estado == 'pagado'",
  "assertion": "fecha_pago == fecha_pago"
}
```

> Los campos `condition` y `assertion` son opcionales si la expresión sigue el formato `IF ... THEN ...`. Si se proporcionan, se usan directamente.

**Tipo violación directa:**

```json
{
  "name": "Precio de venta mayor que coste",
  "type": "violation",
  "expression": "precio_venta < precio_coste"
}
```

La expresión selecciona filas que **violan** la regla (filas a reportar como problema).

---

## 3. Algoritmo de cálculo

### Verificación de seguridad

Antes de ejecutar cualquier regla, se verifica que la expresión no contenga ninguno de los tokens prohibidos:

```python
FORBIDDEN_TOKENS = [
    "import", "__", "exec", "eval", "compile",
    "globals", "locals", "getattr", "setattr", "delattr",
    "open", "os.", "sys.", "subprocess", "shutil",
    "lambda", "def ", "class ",
]
```

Si se detecta un token prohibido, se genera un issue de severidad `high` y la regla se **omite** (no se ejecuta).

### Evaluación de regla IF-THEN

```python
# 1. Encontrar filas que cumplen la condición
cond_rows = df.query(condition)

# Si ninguna fila cumple la condición, la regla es trivialmente válida
if len(cond_rows) == 0:
    return (0, [], 1.0)

# 2. Verificar la aserción sobre esas filas
passing = cond_rows.query(assertion)
violation_count = len(cond_rows) - len(passing)

# 3. Calcular compliance (normalizado al scope de la regla)
compliance_rate = 1 - (violation_count / len(cond_rows))
```

> La `compliance_rate` de reglas IF-THEN se calcula sobre las **filas que cumplen la condición**, no sobre el total del dataset. Esto evita que una regla selectiva (p. ej. "si estado == 'pagado' entonces la fecha de pago no puede ser nula") con 10 violaciones en 10 filas `pagado` devuelva `0.999` en un dataset de 10 000 registros. Con la normalización por scope, ese caso devuelve `0.0`, lo que refleja correctamente el problema.

### Evaluación de regla tipo violación directa

```python
violation_df = df.query(expression)
violation_count = len(violation_df)
compliance_rate = 1 - (violation_count / total_rows)
```

### Evaluación de regla `violation` directa

```python
violation_df = df.query(expression)
violation_count = len(violation_df)
compliance_rate = 1 - (violation_count / total_rows)
```

A diferencia de las reglas IF-THEN, las reglas de violación directa sí se normalizan por el **total de filas del dataset**, porque aquí el "scope" de la regla es el dataset entero (no hay precondición).

### Score global

```
overall = media(compliance_rates de todas las reglas evaluadas exitosamente)
score   = overall
```

Si todas las reglas tienen errores o la lista está vacía, `score = None` y la métrica **se excluye** del cálculo global del Quality Score (no contribuye al numerador ni al denominador). El peso (`weight`) se aplica una única vez en el servicio, no dentro de la métrica.

---

## 4. Cálculo del score

Cada regla contribuye con su `compliance_rate` (entre 0.0 y 1.0) a la media global. Una regla con 0 violaciones contribuye `1.0`; una regla con violaciones en todas las filas contribuye `0.0`.

El umbral implícito es `1.0` (se espera cumplimiento total): cualquier violación genera un issue.

---

## 5. Generación de issues

### Issue: token prohibido detectado

```json
{
  "severity": "high",
  "description": "Rule 'Mi regla' contains forbidden tokens and was blocked for safety",
  "issue_type": "logical_consistency",
  "fingerprint": "<hash>"
}
```

### Issue: violaciones de regla

Se incluyen hasta 5 filas de muestra (con columnas sensibles enmascaradas).

```json
{
  "severity": "high",
  "description": "Rule 'Precio de venta mayor que coste' violated in 12 rows (2.40% of dataset)",
  "affected_columns": [
    { "column": "precio_venta" },
    { "column": "precio_coste" }
  ],
  "affected_rows": {
    "count": 12,
    "sample": [
      { "id": 5, "precio_venta": 10.0, "precio_coste": 15.0 },
      { "id": 23, "precio_venta": 5.0, "precio_coste": 8.0 }
    ]
  },
  "issue_type": "logical_consistency",
  "fingerprint": "<hash>"
}
```

**Columnas afectadas:** se detectan automáticamente buscando en la expresión el nombre de cada columna del DataFrame. Se incluyen en el issue todas las columnas cuyo nombre aparece en `expression`, `condition` o `assertion`.

---

## 6. Cálculo de severidad

Usa `calculate_dynamic_severity()` con `higher_is_better=True` y `threshold=1.0`:

| Compliance rate | Severidad |
|-----------------|-----------|
| `< 0.50` | `critical` |
| `< 0.70` | `high` |
| `1.0 - rate > 0.15` (es decir, `rate < 0.85`) | `high` |
| `1.0 - rate > 0.05` (es decir, `rate < 0.95`) | `medium` |
| `rate ≥ 0.95` | `low` |

Dado que el umbral es `1.0`, incluso una tasa del 98 % (rate=0.98, distancia=0.02 < 0.05) da severidad `low`.

---

## 7. Fingerprint

`generate_logical_consistency_fingerprint(rule_expression=expression, rule_name=rule_name)`

El fingerprint depende del nombre de la regla y su expresión. Cambiar el nombre o la expresión genera un fingerprint nuevo.

---

## 8. Ejemplo práctico

**Dataset de entrada** (5 filas):

| id | estado | fecha_pago | precio_venta | precio_coste |
|----|--------|------------|--------------|--------------|
| 1 | pagado | 2024-01-10 | 100 | 60 |
| 2 | pagado | NULL | 80 | 50 |
| 3 | pendiente | NULL | 120 | 70 |
| 4 | pagado | 2024-02-05 | 95 | 110 |
| 5 | pendiente | NULL | 200 | 90 |

**Configuración:**

```json
{
  "rules": [
    {
      "name": "Fecha de pago si estado pagado",
      "type": "if_then",
      "condition": "estado == 'pagado'",
      "assertion": "fecha_pago == fecha_pago"
    },
    {
      "name": "Venta mayor que coste",
      "type": "violation",
      "expression": "precio_venta < precio_coste"
    }
  ]
}
```

**Regla 1 (IF-THEN, normalizado por scope):**
```
Filas con estado=='pagado': [1, 2, 4]  (3 filas = scope)
Filas que pasan aserción fecha_pago==fecha_pago (no null): [1, 4]
Violaciones: [2]  (1 violación)
compliance_rate = 1 - (1/3) = 0.667
```

**Regla 2 (violación directa, normalizado por dataset):**
```
Filas donde precio_venta < precio_coste: [4]  (1 violación)
compliance_rate = 1 - (1/5) = 0.80
```

**Score global:**
```
overall = (0.667 + 0.80) / 2 = 0.734
```

**Issues generados:**
- Regla 1: `compliance_rate=0.667`, `< 0.70` → severidad `high`.
- Regla 2: `compliance_rate=0.80`, `1.0 - 0.80 = 0.20 > 0.15` → severidad `high`.
