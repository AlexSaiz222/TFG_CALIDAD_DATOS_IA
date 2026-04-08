# Currentness — Métrica de Actualidad

**Archivo fuente:** `backend/services/metrics/currentness.py`
**ID en el sistema:** `currentness`
**Código ISO/IEC 5259-2:2024:** `Cur-ML-1` (Feature currentness)

> **Nota terminológica (ISO/IEC 5259-2:2024 §6.2.5 y §6.5.9):**
> La norma distingue dos conceptos temporales con nombres distintos:
> - **Currentness (ΔT₂)** — tiempo transcurrido desde que se registró el dato hasta hoy (*staleness/frescura*). **Esto es lo que mide esta métrica.**
> - **currentness (ΔT₁)** — latencia entre el evento real en el mundo y su ingesta en el sistema. Requiere dos timestamps externos y no es calculable desde un dataset estático.
>
> La métrica se llamaba `currentness` en versiones anteriores del sistema. Se renombró a `currentness` para ser fiel al estándar ISO y dejar el nombre `currentness` libre si en el futuro se implementa la medida ΔT₁.

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
| `columns` | `list[str]` | `[]` | Columnas de fecha a analizar explícitamente. Si está vacío y `auto_detect=true`, se detectan automáticamente. |
| `auto_detect` | `bool` | `true` | Si es true, detecta automáticamente columnas de fecha (timestamp, date, datetime). |
| `staleness_threshold_days` | `int` | `30` | Número de días máximo antes de considerar los datos "obsoletos". Si la fecha más reciente supera este umbral, se genera una alerta. |
| `weight` | `float` | `1.0` | Peso en el Quality Score global. |

### Parámetros obsoletos (no usar)

Los siguientes parámetros aparecían en versiones antiguas pero **no están implementados** y se ignoran:
- `date_columns` → usar `columns` en su lugar
- `max_age_days` → usar `staleness_threshold_days` en su lugar  
- `expected_range` → no implementado, se ignora

---

## 3. Algoritmo de cálculo

### Auto-detección de columnas de fecha

Si `auto_detect=True`, se analiza cada columna no cubierta por `columns`:

1. **Columnas con dtype datetime:** se incluyen directamente.
2. **Columnas de tipo `object`:** se toma una muestra de hasta 50 valores y se intenta parsearlos como fechas. Si **≥ 50 %** de la muestra se parsea correctamente, la columna se incluye.

Para las columnas especificadas en `columns`, el umbral de parseo mínimo es **50 %** (el mismo que la auto-detección).

### Cálculo de frescura por columna

```python
DECAY_SCALE = 3   # controla cuán lenta es la degradación tras superar el umbral

now = pd.Timestamp.now()
max_date = máximo de los valores de fecha no nulos de la columna
age_days = (now - max_date).days

if age_days <= staleness_threshold_days:
    col_freshness = 1.0   # datos frescos
else:
    decay_window = staleness_threshold_days * DECAY_SCALE
    col_freshness = max(0.0, 1.0 - (age_days - staleness_threshold_days) / decay_window)
```

**Intuición de la fórmula:**
- Hasta `threshold` → `col_freshness = 1.0`.
- La degradación es **lineal** y alcanza `0.0` en `threshold × (1 + DECAY_SCALE)` = `4 × threshold`.
- Esta curva está alineada con la tabla de severidad: `medium` a partir de `1×`, `high` a partir de `3×`, `critical` a partir de `10×`. Antes la frescura llegaba a 0 en `2×`, mucho antes de que la severidad pasara a `high`.

Ejemplos con `staleness_threshold_days=30`:

| Antigüedad | Frescura |
|------------|----------|
| 0 días | 1.00 |
| 15 días | 1.00 |
| 30 días | 1.00 |
| 45 días | 0.83 |
| 60 días | 0.67 |
| 90 días | 0.33 |
| 120 días | 0.00 |
| 300 días | 0.00 (mínimo) |

### Score global

```
overall_freshness = media(col_freshness de todas las columnas analizadas)
score = overall_freshness
```

Si no se detectó ninguna columna de fecha, `score = 1.0`. El peso (`weight`) se aplica una única vez en el servicio, no dentro de la métrica.

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
  "issue_type": "currentness",
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
  "issue_type": "currentness",
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
| Datos obsoletos | `generate_currentness_fingerprint(column_name=col, staleness_threshold_days=days)` |
| Baja tasa de parseo | `generate_issue_fingerprint(type="currentness", column, rule_key="parse_quality_check")` |

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

decay_window = 30 × 3 = 90
col_freshness = max(0.0, 1.0 - (99 - 30) / 90)
              = max(0.0, 1.0 - 69/90)
              = max(0.0, 0.233)
              = 0.233
```

**Resultado:**
- Score: `0.233`.
- Issue generado: `age_days=99`, `ratio = 99/30 = 3.3 ≥ 3` → severidad `high`.
- `age_human`: `"3 meses y 9 dias"`.
- Descripción: `"most recent record is 3 meses y 9 dias old (threshold: 30 days)"`.
