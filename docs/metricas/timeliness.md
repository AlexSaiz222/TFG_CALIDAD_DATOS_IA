# Timeliness — Métrica de Actualidad

**Archivo fuente:** `backend/services/metrics/timeliness.py`
**ID en el sistema:** `timeliness`

---

## 1. Descripción teórica

La actualidad (o frescura) mide **cuánto tiempo hace que se actualizaron los datos** en cada columna de fecha del dataset. Un dataset puede ser perfectamente completo, único y consistente pero estar obsoleto: si contiene datos de hace tres años, puede no ser útil para tomar decisiones actuales.

La métrica calcula la antigüedad del valor de fecha más reciente de cada columna y la compara con un umbral de "frescura" configurable.

**Por qué importa:**
- Los datos obsoletos pueden conducir a decisiones erróneas en sistemas que dependen de información reciente (monitorización, alertas, modelos de predicción en tiempo real).
- Es especialmente relevante en pipelines de datos donde se espera que los datos lleguen con regularidad (diaria, semanal, mensual).

---

## 2. Parámetros de configuración

| Parámetro | Tipo | Valor por defecto | Descripción |
|-----------|------|-------------------|-------------|
| `columns` | `list[str]` | `[]` | Columnas de fecha a analizar explícitamente. |
| `auto_detect` | `bool` | `true` | Si es true, detecta automáticamente columnas de fecha. |
| `staleness_threshold_days` | `int` | `30` | Número de días máximo antes de considerar los datos "obsoletos". |
| `weight` | `float` | `1.0` | Peso en el Quality Score global. |

---

## 3. Algoritmo de cálculo

### Auto-detección de columnas de fecha

Si `auto_detect=True`, se analiza cada columna no cubierta por `columns`:

1. **Columnas con dtype datetime:** se incluyen directamente.
2. **Columnas de tipo `object`:** se toma una muestra de hasta 50 valores y se intenta parsearlos como fechas. Si **≥ 50 %** de la muestra se parsea correctamente, la columna se incluye.

Para las columnas especificadas en `columns`, el umbral de parseo mínimo es **50 %** (el mismo que la auto-detección).

### Cálculo de frescura por columna

```python
now = pd.Timestamp.now()
max_date = máximo de los valores de fecha no nulos de la columna
age_days = (now - max_date).days

# Frescura:
if age_days <= staleness_threshold_days:
    col_freshness = 1.0   # datos frescos
else:
    col_freshness = max(0.0, 1.0 - (age_days - staleness_threshold_days) / staleness_threshold_days)
```

**Intuición de la fórmula:**
- Si los datos tienen exactamente `staleness_threshold_days` de antigüedad → `col_freshness = 1.0`.
- Si tienen el doble de antigüedad (2× threshold) → `col_freshness = 0.0`.
- La degradación es **lineal** entre `threshold` y `2× threshold`.

Ejemplos con `staleness_threshold_days=30`:

| Antigüedad | Frescura |
|------------|----------|
| 0 días | 1.00 |
| 15 días | 1.00 |
| 30 días | 1.00 |
| 45 días | 0.50 |
| 60 días | 0.00 |
| 90 días | 0.00 (mínimo) |

### Score global

```
overall_freshness = media(col_freshness de todas las columnas analizadas) × weight
```

Si no se detectó ninguna columna de fecha, `score = 1.0`.

---

## 4. Estructura de resultados por columna

```json
{
  "max_date": "2024-01-15T00:00:00",
  "min_date": "2022-03-01T00:00:00",
  "age_days": 74,
  "age_human": "2 meses y 14 dias",
  "date_range_days": 685,
  "parse_success_rate": 0.98,
  "valid_dates_count": 490,
  "is_stale": true,
  "freshness_score": 0.0,
  "staleness_threshold_days": 30
}
```

### Formato de edad legible (`age_human`)

El método `_format_age()` convierte los días en texto:

| Días | Texto |
|------|-------|
| 0 | `"Hoy"` |
| 1 | `"1 dia"` |
| < 30 | `"N dias"` |
| < 365 | `"N meses [y M dias]"` |
| ≥ 365 | `"N años [y M meses]"` |

---

## 5. Generación de issues

### Issue: datos obsoletos

**Condición:** `age_days > staleness_threshold_days`.

```json
{
  "severity": "high",
  "description": "Column 'fecha_registro' contains stale data: most recent record is 2 meses y 14 dias old (threshold: 30 days)",
  "affected_columns": [
    {
      "column": "fecha_registro",
      "age_days": 74,
      "max_date": "2024-01-15T00:00:00",
      "freshness_score": 0.0
    }
  ],
  "issue_type": "timeliness",
  "fingerprint": "<hash>"
}
```

### Issue: baja tasa de parseo de fechas

**Condición:** `parse_success_rate < 0.80` Y `total_filas > 10`.

Indica que muchos valores no pudieron interpretarse como fechas válidas.

```json
{
  "severity": "low",
  "description": "Column 'fecha_registro' has low date parse success rate (65.0%): some values may not be valid dates",
  "affected_columns": [
    { "column": "fecha_registro", "parse_success_rate": 0.65 }
  ],
  "issue_type": "timeliness",
  "fingerprint": "<hash>"
}
```

---

## 6. Cálculo de severidad

Para el issue de datos obsoletos, la severidad se calcula **directamente** a partir del ratio de antigüedad (no usa `calculate_dynamic_severity`):

```python
ratio = age_days / staleness_threshold_days
```

| Ratio de antigüedad | Severidad |
|---------------------|-----------|
| `ratio ≥ 10` | `critical` |
| `ratio ≥ 3` | `high` |
| `ratio ≥ 1` | `medium` |
| `ratio < 1` | `low` |

Ejemplos con `staleness_threshold_days=30`:

| Antigüedad | Ratio | Severidad |
|------------|-------|-----------|
| 35 días | 1.17 | `medium` |
| 90 días | 3.0 | `high` |
| 300 días | 10.0 | `critical` |

> El issue de baja tasa de parseo siempre tiene severidad `low`.

---

## 7. Fingerprint

| Tipo de issue | Función |
|---------------|---------|
| Datos obsoletos | `generate_timeliness_fingerprint(column_name=col, staleness_threshold_days=days)` |
| Baja tasa de parseo | `generate_issue_fingerprint(type="timeliness", column, rule_key="parse_quality_check")` |

El fingerprint de datos obsoletos incluye el umbral de staleness, por lo que cambiar el umbral genera un fingerprint nuevo.

---

## 8. Ejemplo práctico

**Escenario:** La fecha actual es 2026-03-29. El dataset tiene una columna `ultima_actualizacion`.

**Valores en la columna (muestra):**
```
["2025-12-15", "2025-11-30", "2025-10-01", "2025-12-20", "2025-09-15"]
```

**Configuración:** `staleness_threshold_days=30`, `auto_detect=true`.

**Cálculo:**
```
max_date = 2025-12-20
age_days = (2026-03-29 - 2025-12-20).days = 99 días

Umbral = 30 días
¿is_stale? 99 > 30 → sí

col_freshness = max(0.0, 1.0 - (99 - 30) / 30)
              = max(0.0, 1.0 - 69/30)
              = max(0.0, 1.0 - 2.3)
              = max(0.0, -1.3)
              = 0.0
```

**Resultado:**
- Score: `0.0 × weight = 0.0`.
- Issue generado: `age_days=99`, `ratio = 99/30 = 3.3 ≥ 3` → severidad `high`.
- `age_human`: `"3 meses y 9 dias"`.
- Descripción: `"most recent record is 3 meses y 9 dias old (threshold: 30 days)"`.
