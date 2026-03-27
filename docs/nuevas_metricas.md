# Nuevas Métricas de Calidad de Datos

Documentación de las 4 nuevas métricas implementadas siguiendo la arquitectura Sonar-Lite del sistema. Cada métrica genera **issues trackeables** con fingerprints únicos que permiten comparar ejecuciones y detectar problemas nuevos, recurrentes o resueltos.

---

## Índice

1. [Exactitud Sintáctica](#1-exactitud-sintáctica-syntactic_accuracy)
2. [Consistencia Lógica](#2-consistencia-lógica-logical_consistency)
3. [Equilibrio de Clases](#3-equilibrio-de-clases-class_balance)
4. [Actualidad](#4-actualidad-timeliness)
5. [Archivos Modificados](#5-archivos-modificados)
6. [Cómo Configurar las Métricas](#6-cómo-configurar-las-métricas)

---

## 1. Exactitud Sintáctica (`syntactic_accuracy`)

### ¿Qué mide?

Valida que los valores de cada columna cumplan con un tipo de dato esperado o un patrón de formato concreto. No comprueba si el valor existe en el mundo real (eso sería validación semántica), sino si tiene la **estructura correcta**: un email con `@`, una fecha en formato `YYYY-MM-DD`, un DNI con 8 dígitos y letra, etc.

### Parámetros de configuración

```json
{
  "auto_detect_types": true,
  "columns": [
    { "column": "email", "expected_type": "email" },
    { "column": "telefono", "pattern": "^\\+?\\d{9,15}$" }
  ],
  "custom_patterns": {
    "codigo_interno": "^[A-Z]{2}\\d{4}$"
  },
  "threshold": 0.95
}
```

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `auto_detect_types` | boolean | `true` | Detecta automáticamente el tipo de columnas string muestreando 100 filas |
| `columns` | array | `[]` | Configuración manual: lista de `{column, expected_type}` o `{column, pattern}` |
| `custom_patterns` | object | `{}` | Mapa `{nombre_columna: regex}` para patrones totalmente personalizados |
| `threshold` | float | `0.95` | Porcentaje mínimo de valores conformes para no generar issue |

### Biblioteca de tipos predefinidos

| Tipo | Ejemplo válido |
|------|---------------|
| `email` | `usuario@dominio.com` |
| `url` | `https://ejemplo.com/ruta` |
| `phone_es` | `612345678`, `+34612345678` |
| `phone_intl` | `+1-800-555-0100` |
| `dni_es` | `12345678Z` |
| `date_iso` | `2026-03-27` |
| `date_eu` | `27/03/2026` |
| `integer` | `-42`, `1000` |
| `decimal` | `3.14`, `-0.5` |
| `uuid` | `550e8400-e29b-41d4-a716-446655440000` |
| `ip_v4` | `192.168.1.1` |
| `postal_code_es` | `28001` |
| `credit_card` | `4111 1111 1111 1111` |

### Auto-detección

Con `auto_detect_types: true`, para cada columna de tipo `string` el sistema:
1. Toma una muestra de las primeras 100 filas no nulas
2. Prueba cada patrón de la biblioteca
3. Asigna el tipo con mayor tasa de coincidencia si supera el **60%**

### Issues generados

Un issue por cada columna que no alcance el `threshold`:

- **Severity**: calculada dinámicamente según distancia al umbral (critical < 50%, high 50-70%, medium 70-threshold, low cerca del umbral)
- **Fingerprint**: estable entre ejecuciones — incluye columna + tipo esperado + patrón
- **Datos**: incluye hasta 5 ejemplos de valores inválidos (enmascarados si la columna es sensible)

### Contribución al quality score

```
score_columna = valid_count / total_non_null
score_métrica = media(score_columna) para todas las columnas verificadas
```

---

## 2. Consistencia Lógica (`logical_consistency`)

### ¿Qué mide?

Evalúa si los valores de **diferentes columnas dentro del mismo registro** tienen sentido entre sí, aplicando reglas de negocio definidas por el usuario. Un dataset puede tener 0 nulos y 0 errores de formato, pero si un paciente figura como "Fallecido" y tiene una cita futura programada, el dato es inconsistente.

### Parámetros de configuración

```json
{
  "rules": [
    {
      "name": "Fecha fin después de inicio",
      "expression": "fecha_fin < fecha_inicio",
      "type": "violation"
    },
    {
      "name": "Fallecido sin cita futura",
      "condition": "estado == 'Fallecido'",
      "assertion": "proxima_cita.isna()",
      "type": "if_then"
    }
  ]
}
```

### Tipos de reglas

#### `violation`
La expresión selecciona directamente las filas que **violan** la regla. Se evalúa con `df.query(expression)` — las filas devueltas son las problemáticas.

```json
{ "name": "Precio negativo", "expression": "precio < 0", "type": "violation" }
```

#### `if_then`
Define una condición y una aserción. Las violaciones son filas donde la **condición es verdadera** pero la **aserción es falsa**.

```json
{
  "name": "Descuento requiere autorización",
  "condition": "descuento > 0.5",
  "assertion": "autorizado == True",
  "type": "if_then"
}
```

También acepta sintaxis de texto natural en el campo `expression`:
```
IF estado == 'Activo' THEN fecha_baja.isna()
Si categoria == 'Premium' Entonces limite_credito > 5000
```

### Seguridad del evaluador

Las expresiones se sanean antes de ejecutarse. Se bloquean automáticamente si contienen:
`import`, `__`, `exec`, `eval`, `compile`, `globals`, `locals`, `getattr`, `setattr`, `open`, `os.`, `sys.`, `subprocess`, `lambda`, `def `, `class `

### Issues generados

Un issue por cada regla con al menos 1 violación:

- **Severity**: basada en el porcentaje de filas que violan la regla
- **Fingerprint**: basado en la expresión de la regla — la misma regla genera el mismo fingerprint entre ejecuciones
- **Datos**: incluye hasta 5 filas de ejemplo que violan la regla (columnas sensibles enmascaradas)

### Contribución al quality score

```
compliance_rate_regla = 1 - (violaciones / total_filas)
score_métrica = media(compliance_rate) para todas las reglas evaluadas
```

---

## 3. Equilibrio de Clases (`class_balance`)

### ¿Qué mide?

Mide la distribución de categorías en variables categóricas usando **entropía de Shannon**. Detecta desbalance de clases que puede sesgar modelos de Machine Learning (ej: 99% "Legítimo" y 1% "Fraude" en una columna de detección de fraude).

### Parámetros de configuración

```json
{
  "columns": ["estado", "categoria"],
  "auto_detect": true,
  "max_cardinality": 50,
  "imbalance_threshold_high": 0.90,
  "imbalance_threshold_low": 0.05
}
```

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `columns` | array | `[]` | Columnas específicas a analizar |
| `auto_detect` | boolean | `true` | Detecta automáticamente columnas categóricas |
| `max_cardinality` | integer | `50` | Máximo de valores únicos para considerar una columna como categórica |
| `imbalance_threshold_high` | float | `0.90` | Umbral para alertar sobre clase dominante (90% o más) |
| `imbalance_threshold_low` | float | `0.05` | Umbral para alertar sobre clase minoritaria (5% o menos) |

### Auto-detección de columnas categóricas

Con `auto_detect: true`, se incluyen:
- Columnas de tipo `object` o `category` con `nunique <= max_cardinality`
- Columnas enteras con `nunique <= 20`
- Se excluyen columnas constantes (`nunique <= 1`)

### Cálculo del Balance Index

```python
# Entropía de Shannon (sin scipy, solo numpy)
probs = value_counts(normalize=True)
H = -sum(p * log2(p) for p in probs)
H_max = log2(num_classes)             # Entropía máxima posible
balance_index = (H / H_max) * 100    # Escala 0-100
```

| Balance Index | Interpretación |
|---------------|---------------|
| 80-100 | Distribución equilibrada |
| 60-80 | Ligero desbalance, aceptable |
| 40-60 | Desbalance moderado |
| 20-40 | Desbalance significativo |
| 0-20 | Desbalance severo |

### Issues generados

- **Clase dominante** (>= `imbalance_threshold_high`): 1 issue por columna. Severity basada en la magnitud del dominio
- **Clase minoritaria** (<= `imbalance_threshold_low`): 1 issue adicional por columna si aplica. Severity: medium (<2%) o low (<5%)

Cada issue incluye la clase implicada, su proporción y el balance index de la columna.

### Contribución al quality score

```
score_columna = balance_index / 100
score_métrica = media(score_columna) para todas las columnas analizadas
```

---

## 4. Actualidad (`timeliness`)

### ¿Qué mide?

Mide la **frescura y vigencia** de los datos analizando columnas de fecha. Detecta datasets obsoletos en los que el dato más reciente supera un umbral de antigüedad configurable. Entrenar un modelo con datos de hace 3 años puede producir predicciones incorrectas.

### Parámetros de configuración

```json
{
  "columns": ["fecha_compra", "ultima_actualizacion"],
  "auto_detect": true,
  "staleness_threshold_days": 30
}
```

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `columns` | array | `[]` | Columnas de fecha específicas a analizar |
| `auto_detect` | boolean | `true` | Detecta automáticamente columnas de fecha |
| `staleness_threshold_days` | integer | `30` | Días máximos de antigüedad aceptable |

### Auto-detección de columnas de fecha

Con `auto_detect: true`:
1. Columnas con dtype `datetime64` → incluidas directamente
2. Columnas `object` → se parsea una muestra de 50 filas con `pd.to_datetime(infer_datetime_format=True)`. Si más del **50% parsean correctamente**, se procesa la columna completa

Formatos detectados automáticamente: ISO 8601, DD/MM/YYYY, MM/DD/YYYY, y otros formatos comunes de pandas.

### Cálculo del Freshness Score

```python
age_days = (now - max_date).days

# Score por columna:
if age_days <= threshold:
    freshness_score = 1.0          # Datos vigentes
else:
    # Decay lineal: llega a 0 al doble del umbral
    freshness_score = max(0.0, 1.0 - (age_days - threshold) / threshold)
```

### Issues generados

**Staleness** — 1 issue por columna con `age_days > staleness_threshold_days`:

| Ratio `age / threshold` | Severity |
|------------------------|----------|
| >= 10x | `critical` |
| >= 3x | `high` |
| >= 1x | `medium` |

**Parse quality** — Issue `low` por columna si `parse_success_rate < 80%`, indicando que algunos valores no son fechas válidas.

### Información calculada por columna

- `max_date` / `min_date`: rango de fechas en el dataset
- `age_days` + `age_human`: antigüedad en días y en texto legible ("2 meses y 15 días")
- `date_range_days`: amplitud temporal cubierta por el dataset
- `parse_success_rate`: porcentaje de valores que se parsearon correctamente como fecha
- `is_stale`: boolean de staleness
- `freshness_score`: puntuación de frescura 0.0-1.0

### Contribución al quality score

```
score_métrica = media(freshness_score) para todas las columnas de fecha analizadas
```

---

## 5. Archivos Modificados

### Backend

| Archivo | Cambio |
|---------|--------|
| `backend/migrations/versions/add_new_quality_metrics.py` | **Nuevo** — Migración idempotente para insertar/actualizar las 4 métricas en la tabla `metrics` |
| `backend/utils/fingerprint_utils.py` | **Modificado** — 4 nuevas funciones: `generate_syntactic_accuracy_fingerprint`, `generate_logical_consistency_fingerprint`, `generate_class_balance_fingerprint`, `generate_timeliness_fingerprint` |
| `backend/services/evaluation_service.py` | **Modificado** — 4 nuevos bloques `elif metric_id == '...'` con la lógica de cada métrica |

### Frontend

| Archivo | Cambio |
|---------|--------|
| `frontend/src/components/evaluations/SyntacticAccuracyDetail.tsx` | **Nuevo** — Tabla de conformidad por columna con tipo esperado, barra de progreso y ejemplos inválidos |
| `frontend/src/components/evaluations/LogicalConsistencyDetail.tsx` | **Nuevo** — Tabla de reglas con estado, violaciones y filas expandibles con ejemplos |
| `frontend/src/components/evaluations/ClassBalanceDetail.tsx` | **Nuevo** — Tabla de columnas con balance index, distribución de clases en barras horizontales |
| `frontend/src/components/evaluations/TimelinessDetail.tsx` | **Nuevo** — Tabla de columnas de fecha con frescura, antigüedad y estado vigente/obsoleto |
| `frontend/src/components/evaluations/MetricDetailsTabs.tsx` | **Modificado** — 4 nuevos tabs dinámicos, uno por métrica disponible en los resultados |
| `frontend/src/components/evaluations/index.ts` | **Modificado** — 4 nuevos exports de los componentes de detalle |

### Base de datos

| Métrica | ID | Categoría |
|---------|-----|-----------|
| `syntactic_accuracy` | 11 | accuracy |
| `logical_consistency` | 12 | consistency |
| `class_balance` | 8 | distribution |
| `timeliness` | 5 | timeliness |

---

## 6. Cómo Configurar las Métricas

### Paso 1 — Acceder a la configuración de métricas

Navegar a un proyecto → **Configurar métricas** (`/metrics/configure/[id]`).

### Paso 2 — Activar la métrica

Las 4 nuevas métricas aparecen en el catálogo. Hacer clic en una para añadirla al proyecto.

### Paso 3 — Configurar parámetros

Hacer clic en el icono de configuración de la métrica para abrir el diálogo de parámetros. Los parámetros se editan como JSON.

**Ejemplo mínimo para `syntactic_accuracy`** (auto-detección activada):
```json
{ "auto_detect_types": true, "threshold": 0.95 }
```

**Ejemplo mínimo para `logical_consistency`** (requiere definir al menos 1 regla):
```json
{
  "rules": [
    { "name": "Stock no negativo", "expression": "stock < 0", "type": "violation" }
  ]
}
```

**Ejemplo mínimo para `class_balance`** (auto-detección activada):
```json
{ "auto_detect": true, "imbalance_threshold_high": 0.90 }
```

**Ejemplo mínimo para `timeliness`** (auto-detección activada):
```json
{ "auto_detect": true, "staleness_threshold_days": 90 }
```

### Paso 4 — Ejecutar evaluación

Lanzar una evaluación desde el proyecto o desde el dataset. Al completarse, los resultados de cada métrica aparecen como un **tab adicional** en la vista de evaluación.

### Paso 5 — Revisar issues

Los issues generados por las nuevas métricas se integran en el sistema Sonar-Lite existente:
- Aparecen en el resumen de issues con su severidad
- Se comparan con la evaluación anterior (nuevo / recurrente / resuelto)
- Contribuyen al Quality Score global y al estado del Quality Gate
