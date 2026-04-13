# Formula de Puntuacion de Calidad (Quality Score)

## Vision general

El Quality Score es un valor entre **0 y 100** que resume el estado de calidad de un dataset. Se basa en un modelo de **penalizacion por issues**: parte de 100% y descuenta segun la cantidad y severidad de los problemas detectados.

Los scores de diagnostico por metrica (ratio de celdas validas) se mantienen como informacion auxiliar pero **no alimentan la nota final**. La razon: los ratios diluyen problemas concentrados (ej. 3 fechas imposibles en 200 filas apenas afectan al ratio, pero el dataset es inutilizable para series temporales).

> Para documentacion completa del sistema de evaluaciones (flujo, metricas, fingerprints, quality gates), consulta [`docs/evaluaciones.md`](evaluaciones.md).
> Para analisis de las decisiones de diseno, consulta [`docs/analisis_modelo_scoring.md`](analisis_modelo_scoring.md).

---

## Formula

```
quality_score = max(0, 1 - min(0.97, raw_penalty / column_scale))
```

### Paso 1 — Penalizacion bruta por issues

Cada issue detectado contribuye segun su severidad:

| Severidad | Penalizacion por issue |
|-----------|------------------------|
| `critical` | -12% |
| `high`     | -5%  |
| `medium`   | -1%  |
| `low`      | -0.3% |

```
raw_penalty = critical_count x 0.12 + high_count x 0.05 + medium_count x 0.01 + low_count x 0.003
```

### Paso 2 — Normalizacion por dimensionalidad

Datasets con mas columnas generan mas issues potenciales. Un factor de escala sqrt normaliza la penalizacion:

```
column_scale = sqrt(max(10, num_columns) / 10)
issue_penalty = min(0.97, raw_penalty / column_scale)
```

La referencia es 10 columnas. Ejemplos de escala:

| Columnas | column_scale | Efecto |
|----------|-------------|--------|
| 5        | 1.0         | Sin cambio (se usa referencia 10) |
| 10       | 1.0         | Sin cambio |
| 20       | 1.41        | Divide penalty entre 1.41 |
| 40       | 2.0         | Divide penalty entre 2 |
| 100      | 3.16        | Divide penalty entre 3.16 |

### Paso 3 — Score final

```
quality_score = max(0.0, 1.0 - issue_penalty)
```

El score se almacena internamente en `[0.0, 1.0]` y se muestra al usuario en escala **0-100**.

---

## Calculo de severidad

La severidad de cada issue se calcula dinamicamente segun la distancia entre el valor real y el umbral (`base.py:calculate_dynamic_severity`):

**Metricas donde mayor es mejor** (completeness, uniqueness, syntactic_accuracy):

| Condicion | Severidad |
|-----------|-----------|
| `valor >= umbral` | `low` |
| `valor < 0.50` | `critical` |
| `valor < 0.70` | `high` |
| `umbral - valor > 0.15` | `high` |
| `umbral - valor > 0.05` | `medium` |
| en otro caso | `low` |

**Outliers** (basado en proporcion):

| Proporcion | Severidad |
|-----------|-----------|
| `>= 20%` | `critical` |
| `>= 10%` | `high` |
| `>= 5%`  | `medium` |
| `< 5%`   | `low` |

**Class balance** (proporcion clase dominante):

| Proporcion | Severidad |
|-----------|-----------|
| `>= 99%` | `critical` |
| `>= 95%` | `high` |
| `>= 90%` | `medium` |

**Currentness** (ratio dias/umbral):

| Ratio | Severidad |
|-------|-----------|
| `>= 10` | `critical` |
| `>= 3`  | `high` |
| `>= 1`  | `medium` |
| `< 1`   | `low` |

---

## Ejemplos

### Dataset con pocos problemas (5 columnas, 0 criticos, 1 alto, 2 medios)

```
raw_penalty  = 1x0.05 + 2x0.01 = 0.07
column_scale = sqrt(max(10,5)/10) = 1.0
issue_penalty = min(0.97, 0.07) = 0.07
quality_score = 1.0 - 0.07 = 0.93  ->  93/100
```

### Dataset mediocre (20 columnas, 2 criticos, 3 altos, 5 medios)

```
raw_penalty  = 2x0.12 + 3x0.05 + 5x0.01 = 0.44
column_scale = sqrt(20/10) = 1.414
issue_penalty = min(0.97, 0.44/1.414) = 0.311
quality_score = 1.0 - 0.311 = 0.689  ->  68.9/100
```

### Dataset deficiente (12 columnas, 3 criticos, 5 altos, 10 medios, 8 bajos)

```
raw_penalty  = 3x0.12 + 5x0.05 + 10x0.01 + 8x0.003 = 0.734
column_scale = sqrt(12/10) = 1.095
issue_penalty = min(0.97, 0.734/1.095) = 0.670
quality_score = 1.0 - 0.670 = 0.330  ->  33.0/100
```

---

## Escala orientativa

| Quality Score | Interpretacion |
|---------------|----------------|
| 90-100 | Excelente |
| 75-89  | Bueno |
| 60-74  | Aceptable |
| 40-59  | Deficiente |
| 0-39   | Muy deficiente |

---

## Diagnostico base (no afecta al score)

Cada metrica devuelve un score diagnostico `[0.0, 1.0]` (ratio de valores validos). La media simple de estos scores se almacena como `diagnostic_base_score` en el JSON de resultados para contexto, pero **no se usa en la formula del Quality Score**.

---

## Archivos relevantes

| Archivo | Responsabilidad |
|---------|----------------|
| `backend/services/evaluation_service.py:401-449` | Calculo del quality score |
| `backend/services/metrics/base.py:70-137` | `calculate_dynamic_severity()` |
| `backend/services/metrics/*.py` | Cada metrica genera issues |
| `docs/evaluaciones.md` | Documentacion completa del sistema |
| `docs/analisis_modelo_scoring.md` | Analisis de decisiones de diseno |
