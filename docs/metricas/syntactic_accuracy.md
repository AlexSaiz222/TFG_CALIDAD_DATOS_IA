# Syntactic Accuracy — Métrica de Precisión Sintáctica

**Archivo fuente:** `backend/services/metrics/syntactic_accuracy.py`
**ID en el sistema:** `syntactic_accuracy`

---

## 1. Descripción teórica

La precisión sintáctica mide **qué porcentaje de los valores de cada columna respetan el formato esperado según su tipo de dato**. Esta métrica:

1. Trabaja sobre **múltiples columnas** a la vez.
2. Usa un **catálogo de 13 tipos predefinidos** con sus patrones regex, ampliable con **patrones personalizados** creados por el usuario y almacenados en la tabla `validation_patterns`.
3. Puede **auto-detectar** el tipo esperado de cada columna string comparando una muestra contra todos los patrones.
4. Expone un **ColumnPicker** en el frontend para seleccionar columnas y asignarles patrones directamente desde la UI.

**Por qué importa:**
- Los formatos incorrectos causan fallos silenciosos en procesamientos posteriores (parseos de fechas, validaciones de email, conversiones numéricas).
- La auto-detección permite auditar columnas sin necesidad de configuración manual.
- Los patrones de usuario permiten validar formatos de negocio propios (códigos internos, matrículas, etc.) sin modificar el código.

---

## 2. Catálogo de tipos y patrones

| Tipo | Patrón regex | Ejemplo válido |
|------|-------------|----------------|
| `email` | `^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$` | `usuario@dominio.com` |
| `url` | `^https?://[^\s]+$` | `https://ejemplo.com/ruta` |
| `phone_es` | `^(\+34)?[6-9]\d{8}$` | `612345678`, `+34612345678` |
| `phone_intl` | `^\+?\d{1,4}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{4,14}$` | `+1 800 555-1234` |
| `dni_es` | `^\d{8}[A-Za-z]$` | `12345678A` |
| `date_iso` | `^\d{4}-\d{2}-\d{2}$` | `2024-03-15` |
| `date_eu` | `^\d{2}/\d{2}/\d{4}$` | `15/03/2024` |
| `integer` | `^-?\d+$` | `42`, `-100` |
| `decimal` | `^-?\d+[.,]?\d*$` | `3.14`, `2,50` |
| `uuid` | `^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-...-[0-9a-fA-F]{12}$` | `550e8400-e29b-41d4-a716-...` |
| `ip_v4` | `^(?:(?:25[0-5]\|2[0-4]\d\|[01]?\d\d?)\.){3}...` | `192.168.1.1` |
| `postal_code_es` | `^\d{5}$` | `28001` |
| `credit_card` | `^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$` | `4111 1111 1111 1111` |

---

## 3. Parámetros de configuración

| Parámetro | Tipo | Valor por defecto | Descripción |
|-----------|------|-------------------|-------------|
| `columns` | `list[dict]` | `[]` | Columnas a validar con tipo esperado. Ver formato abajo. |
| `custom_patterns` | `dict[str, str]` | `{}` | Patrones libres inline: `{"col": "regex"}`. |
| `auto_detect_types` | `bool` | `true` | Si es true, analiza columnas string sin configuración explícita. |
| `threshold` | `float` | `0.95` | Mínimo de conformidad para generar issue. |
| `weight` | `float` | `1.0` | Peso en el Quality Score global. |

Formato de cada elemento en `columns`:

```json
{
  "column": "email_cliente",
  "expected_type": "email"
}
```

O referenciando un patrón de usuario (clave de `ValidationPattern`):

```json
{
  "column": "codigo_interno",
  "expected_type": "codigo_interno_v2"
}
```

O con patrón inline directo (no requiere patrón guardado en BD):

```json
{
  "column": "matricula",
  "expected_type": "matricula",
  "pattern": "^\\d{4}[A-Z]{3}$"
}
```

### Patrones de usuario (`ValidationPattern`)

El campo `expected_type` puede referenciar tanto los 13 tipos built-in del catálogo como cualquier clave (`key`) de un `ValidationPattern` del usuario. Al ejecutar la métrica, la lógica:

1. Carga desde la BD todos los patrones de sistema (`owner_id = NULL`) y los del propietario del proyecto.
2. Los fusiona con los built-ins, dando prioridad a los de usuario cuando comparten `key`.
3. Busca el `expected_type` en el diccionario resultante.

Los patrones de usuario se crean y gestionan desde `/api/patterns/` o desde el `PatternEditor` en la UI.

---

## 4. Algoritmo de cálculo

### Paso 1: Construir el mapa columna → (tipo, patrón)

La métrica construye el mapa `column_checks` en cuatro etapas por orden de precedencia:

0. **Carga de patrones de BD**: se leen de la tabla `validation_patterns` todos los registros cuyo `owner_id` sea `NULL` (sistema) o el `owner_id` del propietario del proyecto. Se fusionan con los built-ins (`SYNTACTIC_PATTERNS`), dando prioridad a los de usuario cuando comparten `key`. El resultado es `resolved_patterns`.

1. **Configuración explícita** (`columns`): las columnas especificadas por el usuario. Si llevan `pattern` inline, se usa directamente; si llevan `expected_type`, se busca en `resolved_patterns`.
2. **Patrones custom** (`custom_patterns`): columnas con patrón libre inline no cubiertas por el paso anterior.
3. **Auto-detección** (si `auto_detect_types=True`): para cada columna de tipo `object` no cubierta aún, se toma una muestra de hasta 100 valores y se prueba contra los 13 tipos del catálogo **built-in** (no los de usuario). Se recogen **todos** los tipos con una tasa de coincidencia ≥ `AUTO_DETECT_MIN_MATCH` (por defecto **0.85**, endurecido respecto al 0.60 anterior para reducir falsos positivos).

```python
matches = []
for type_name, pat in SYNTACTIC_PATTERNS.items():
    rate = fracción_de_valores_que_coinciden(sample, pat)
    if rate >= 0.85:
        matches.append((type_name, rate))
```

- Si **ningún** tipo supera el umbral, la columna no se valida (no se generan falsos positivos).
- Si **exactamente un** tipo lo supera, se asigna ese tipo a la columna.
- Si **dos o más tipos** lo superan (p. ej. una columna con fechas mezcladas en formato ISO y EU), la columna se marca como `mixed_format` y se emite un issue informativo en lugar de forzar un tipo y generar inválidos espurios. El usuario puede declarar explícitamente el tipo esperado en `columns` para desactivar el aviso.

### Paso 2: Validar cada columna

Para cada columna en `column_checks`:

```python
for value in df[col].dropna():
    if regex.match(str(value)):
        valid_count += 1
    else:
        invalid_count += 1

conformance_rate = valid_count / (valid_count + invalid_count)
```

### Paso 3: Score global

```
overall = media(conformance_rates de todas las columnas validadas)
score   = overall
```

Si ninguna columna fue validada, `score = 1.0`. El peso (`weight`) se aplica una única vez en el cálculo global del Quality Score dentro del servicio, no dentro de la métrica.

---

## 5. Generación de issues

Se genera un issue por cada columna cuya `conformance_rate < threshold`.

```json
{
  "severity": "<calculada>",
  "description": "Column 'email_cliente' has 28 values not matching expected type 'email' (94.40% conformance)",
  "affected_columns": [
    {
      "column": "email_cliente",
      "expected_type": "email",
      "invalid_count": 28,
      "conformance_rate": 0.944
    }
  ],
  "issue_type": "syntactic_accuracy",
  "fingerprint": "<hash>"
}
```

Los resultados detallados almacenados en `results` incluyen por columna:

```json
{
  "expected_type": "email",
  "pattern": "^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$",
  "conformance_rate": 0.944,
  "valid_count": 472,
  "invalid_count": 28,
  "total_checked": 500,
  "sample_invalid": ["usuario(at)dominio.com", "sin-arroba", "email@", ...]
}
```

Si la columna es sensible, `sample_invalid` se sustituye por `["***", ...]`.

---

## 6. Cálculo de severidad

Usa `calculate_dynamic_severity()` con `higher_is_better=True`:

| Condición | Severidad |
|-----------|-----------|
| `conformance >= threshold` | `low` |
| `conformance < 0.50` | `critical` |
| `conformance < 0.70` | `high` |
| `threshold - conformance > 0.15` | `high` |
| `threshold - conformance > 0.05` | `medium` |
| en otro caso | `low` |

---

## 7. Fingerprint

`generate_syntactic_accuracy_fingerprint(column_name=col, expected_type=type, pattern=pattern)`

El fingerprint incluye el patrón exacto, por lo que un cambio de tipo o patrón genera un fingerprint nuevo.

---

## 8. Ejemplo práctico

**Dataset de entrada** (columna `fecha_registro`, 8 filas):

```
["2024-01-15", "2024-02-20", "15/03/2024", "2024-04-01", "not-a-date",
 "2024-05-10", "2024-06-30", "07/07/2024"]
```

**Configuración:** `auto_detect_types=true`, `threshold=0.95`.

**Auto-detección:**

La métrica toma una muestra de los 8 valores y prueba cada tipo del catálogo:

- `date_iso` (`^\d{4}-\d{2}-\d{2}$`): coinciden 5/8 = 62.5 % < 85 % → descartado.
- `date_eu` (`^\d{2}/\d{2}/\d{4}$`): coinciden 2/8 = 25 % < 85 % → descartado.

Ningún tipo supera el umbral mínimo (0.85), por lo que la columna **no se valida** automáticamente. Si realmente es una columna de fechas con formatos mezclados, el usuario verá los valores no parseables desde Data Profiling y podrá declarar el tipo esperado manualmente con `columns`.

**Ejemplo alternativo — mixed_format**

Dataset con 10 valores, 5 en ISO y 5 en EU:

```
["2024-01-15", "2024-02-20", "2024-03-10", "2024-05-01", "2024-06-30",
 "15/03/2024", "20/04/2024", "01/05/2024", "12/06/2024", "25/07/2024"]
```

- `date_iso`: 5/10 = 50 % → descartado.
- `date_eu`: 5/10 = 50 % → descartado.

De nuevo ninguno supera el 85 %. Si en cambio la muestra fuera 9 valores ISO y 9 valores EU de una muestra de 10 cada uno (caso contrived), ambos superarían el umbral y la métrica emitiría un issue `mixed_format` informando al usuario de los dos formatos detectados y sus tasas.
