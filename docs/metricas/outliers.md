# Outliers — Herramienta de Profiling

> **No es una métrica de calidad.** Según **ISO/IEC 5259**, la detección de outliers no constituye una dimensión de calidad de datos: es una técnica de *data profiling* / *EDA* que puede ayudar a identificar posibles problemas de otras dimensiones (accuracy, credibility), pero no es evaluable como tal.
>
> En versiones anteriores de esta plataforma `outliers` estaba registrada como métrica puntuable. Se ha retirado del `METRIC_REGISTRY` y ya **no contribuye al Quality Score**. La clase `OutliersMetric` sigue existiendo en `backend/services/metrics/outliers.py` y se reutiliza desde el flujo de **Data Profiling** de la UI (pestaña "Data Profiling" → sección de outliers). Si se invoca desde el evaluador (por ejemplo, por compatibilidad con configuraciones antiguas), devuelve `score=None` y queda excluida del cálculo global.
>
> Este documento se mantiene como referencia técnica de la detección que hace el profiling.

**Archivo fuente:** `backend/services/metrics/outliers.py`
**ID en el sistema:** `outliers` (solo profiling, NO registrado como métrica)

---

## 1. Descripción teórica

Los outliers (valores atípicos) son observaciones que se desvían significativamente del resto del conjunto de datos. Pueden deberse a errores de medición, errores de entrada, eventos excepcionales reales, o fallos en la integración de datos.

El sistema implementa dos métodos estadísticos clásicos para su detección:

- **IQR (Rango Intercuartílico):** robusto, no asume distribución normal, detecta outliers basándose en la dispersión central del 50 % de los datos.
- **Z-Score:** asume distribución aproximadamente normal, mide cuántas desviaciones estándar se aleja un valor de la media.

**Por qué importa:**
- Los outliers pueden distorsionar medias, regresiones y cualquier modelo que no sea robusto a valores extremos.
- En datos de producción, los outliers suelen indicar errores de entrada o problemas en el pipeline de datos.
- Detectarlos temprano permite decidir si eliminarlos, corregirlos o tratarlos como casos especiales.

---

## 2. Parámetros de configuración

| Parámetro | Tipo | Valor por defecto | Descripción |
|-----------|------|-------------------|-------------|
| `method` | `str` | `"iqr"` | Método de detección: `"iqr"` o `"zscore"`. |
| `factor` | `float` | `1.5` | Factor multiplicador del IQR, o umbral de Z-score. |
| `columns` | `list[str]` | `[]` | Columnas a analizar. Si está vacío, se usan todas las numéricas. |
| `weight` | `float` | `1.0` | Peso en el Quality Score global. |

Ejemplo de configuración con Z-score:

```json
{
  "id": "outliers",
  "parameters": {
    "method": "zscore",
    "factor": 3.0,
    "columns": ["precio", "edad", "ingresos"]
  },
  "weight": 0.8
}
```

---

## 3. Algoritmo de cálculo

Si `columns` está vacío, la métrica selecciona automáticamente todas las columnas con tipo numérico (`pandas.api.types.is_numeric_dtype`).

### Método IQR

```
Q1 = percentil 25 de la columna (excluyendo nulos)
Q3 = percentil 75 de la columna (excluyendo nulos)
IQR = Q3 - Q1

lower_bound = Q1 - factor × IQR
upper_bound = Q3 + factor × IQR

outliers = valores < lower_bound  O  valores > upper_bound
```

El factor por defecto `1.5` es el valor estándar de Tukey. Un factor `3.0` detecta solo outliers más extremos ("outliers severos").

**Estadísticas almacenadas:** `lower_bound`, `upper_bound`, `Q1`, `Q3`, `IQR`, `mediana`.

### Método Z-Score

```
media = media(columna)
std   = desviación estándar(columna)
z_i   = (valor_i - media) / std

outliers = valores donde |z_i| > factor
```

El factor por defecto del sistema para IQR es `1.5`, pero si se usa Z-score se recomienda `3.0` (±3σ cubre el 99.7 % de una distribución normal).

**Estadísticas almacenadas:** `media`, `std`, `z_threshold`.

---

## 4. Cálculo del score

**No aplica.** La clase devuelve `score=None` porque no es una métrica puntuable. Los hallazgos se exponen como datos informativos en `results` y, si se invoca desde el evaluador, también como issues (sin impacto en el Quality Score).

> Histórico: en versiones anteriores el score se calculaba como `max(0, 1 - ratio * 3)` por columna con outliers, lo cual penalizaba distribuciones naturalmente de cola pesada (precios, salarios, tráfico) y producía doble conteo con la severidad dinámica. Se ha retirado por el motivo conceptual (ISO/IEC 5259) y por estos efectos colaterales.

---

## 5. Generación de issues

Se genera un issue por cada columna que tenga al menos un outlier detectado.

```json
{
  "severity": "high",
  "description": "Column 'precio' contains 45 outliers (9.00% of values)",
  "affected_columns": [
    {
      "column": "precio",
      "outlier_count": 45,
      "outlier_proportion": 0.09
    }
  ],
  "issue_type": "outliers",
  "fingerprint": "<hash>"
}
```

**Datos adicionales almacenados en `results`** (cuando la columna no es sensible):

```json
{
  "count": 45,
  "total_values": 500,
  "proportion": 0.09,
  "method": "iqr",
  "factor": 1.5,
  "sample_values": [9999.99, 10500.0, -200.0, 8750.0, 11000.0],
  "lower_bound": -150.25,
  "upper_bound": 850.75,
  "q1": 120.50,
  "q3": 620.50,
  "iqr": 500.0,
  "median": 350.0,
  "series_min": -200.0,
  "series_max": 11000.0,
  "mean": 380.2
}
```

Si la columna está marcada como **sensible**, se eliminan todos los valores estadísticos y los `sample_values` se sustituyen por `"***"`.

---

## 6. Cálculo de severidad

Usa `calculate_dynamic_severity()` con `metric_type="outliers"`, basado en la **proporción de outliers** en la columna:

| Proporción de outliers | Severidad |
|------------------------|-----------|
| `≥ 20 %` | `critical` |
| `≥ 10 %` | `high` |
| `≥ 5 %` | `medium` |
| `< 5 %` | `low` |

---

## 7. Fingerprint

`generate_outlier_issue_fingerprint(column_name=col, method=method, factor=factor)`

El fingerprint incluye método y factor, por lo que cambiar el factor de `1.5` a `3.0` generará un fingerprint distinto (se consideran issues diferentes).

---

## 8. Ejemplo práctico

**Dataset de entrada** (columna `salario`, 10 filas):

```
[30000, 32000, 31500, 29000, 33000, 35000, 28500, 150000, 31000, 32500]
```

**Configuración:** `method="iqr"`, `factor=1.5`.

**Cálculo:**

```
Ordenados: [28500, 29000, 30000, 31000, 31500, 32000, 32500, 33000, 35000, 150000]

Q1 = percentil 25 = ~29750
Q3 = percentil 75 = ~33125
IQR = 33125 - 29750 = 3375

lower_bound = 29750 - 1.5 × 3375 = 24687.5
upper_bound = 33125 + 1.5 × 3375 = 38187.5

Outliers: [150000]  (solo 1 valor supera upper_bound)
```

**Resultado:**
- `outlier_count = 1`
- `proportion = 1/10 = 0.10`
- Severidad: `≥ 10 %` → `high` (justo en el límite).
- Score columna: `max(0, 1 - 0.10 × 3) = 0.70`.
- Score global: `0.70 × weight`.
