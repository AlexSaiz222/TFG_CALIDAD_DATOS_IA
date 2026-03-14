# Documentación de Métricas de Calidad de Datos

Este documento describe las métricas disponibles en DataQual, cómo se calculan, cómo se configuran y cómo se determina la severidad de los issues detectados.

---

## Índice

1. [Completeness (Completitud)](#completeness-completitud)
2. [Uniqueness (Unicidad)](#uniqueness-unicidad)
3. [Outliers (Valores Atípicos)](#outliers-valores-atípicos)
4. [Consistency (Consistencia)](#consistency-consistencia)
5. [Sistema de Severidad Dinámica](#sistema-de-severidad-dinámica)

---

## Completeness (Completitud)

### Descripción
Mide el porcentaje de valores no nulos en el dataset. Una alta completitud indica que el dataset tiene pocos valores faltantes.

### Cómo se calcula

#### Nivel Dataset
```python
completeness = 1 - df.isna().mean().mean()
```
Promedio de completitud de todas las columnas del dataset.

#### Nivel Columna
```python
completeness_columna = 1 - df[column].isna().mean()
```
Porcentaje de valores no nulos en una columna específica.

### Configuración

```json
{
  "id": "completeness",
  "parameters": {
    "threshold": 0.95,
    "columns": ["nombre", "email"]  // Opcional: columnas específicas
  },
  "weight": 1.0
}
```

**Parámetros:**
- `threshold` (default: 0.95): Umbral mínimo de completitud. Valores por debajo generan un issue.
- `columns` (opcional): Lista de columnas a evaluar. Si no se especifica, se evalúan todas.
- `weight`: Peso de la métrica en el cálculo del Quality Score.

### Umbrales por defecto
- **Dataset**: 95% — Si la completitud global es menor, se genera un issue a nivel dataset
- **Columna**: 98% — Cada columna con completitud < 98% genera un issue individual

### Issues generados

1. **Issue a nivel dataset**: Se genera cuando la completitud global < 95%
   - Incluye lista de columnas problemáticas con su `null_rate`
   
2. **Issues a nivel columna**: Se generan para cada columna con completitud < 98%
   - Incluye la columna afectada y su `null_rate`

### Severidad dinámica

La severidad se calcula según la distancia del umbral:

| Completitud | Severidad | Descripción |
|-------------|-----------|-------------|
| < 50% | **critical** | Más de la mitad de los datos faltantes |
| 50-70% | **high** | Problema grave de datos faltantes |
| 70-80% | **high** | Problema significativo |
| 80-90% | **medium** | Por debajo del umbral, manejable |
| 90-95% | **medium/low** | Ligeramente por debajo del umbral |
| 95-98% | **low** | Advertencia leve |

**Ejemplo:**
- Completitud 45% → `critical` (más de la mitad faltante)
- Completitud 75% → `high` (problema grave)
- Completitud 92% → `medium` (3% por debajo del umbral 95%)
- Completitud 96.5% → `low` (1.5% por debajo del umbral 98% para columnas)

---

## Uniqueness (Unicidad)

### Descripción
Mide el porcentaje de filas únicas (sin duplicados completos) y detecta columnas con baja variabilidad.

### Cómo se calcula

#### Nivel Dataset (filas únicas)
```python
uniqueness = len(df.drop_duplicates()) / len(df)
```
Proporción de filas que no tienen duplicados completos.

#### Nivel Columna (variabilidad)
```python
uniqueness_columna = df[column].nunique() / len(df)
```
Proporción de valores únicos en una columna.

### Configuración

```json
{
  "id": "uniqueness",
  "parameters": {
    "threshold": 1.0,
    "columns": ["id", "email"]  // Opcional
  },
  "weight": 1.0
}
```

**Parámetros:**
- `threshold` (default: 1.0): Umbral mínimo de unicidad. 1.0 significa que no se toleran duplicados.
- `columns` (opcional): Columnas específicas a evaluar.
- `weight`: Peso de la métrica en el Quality Score.

### Umbrales por defecto
- **Dataset**: 100% — Cualquier fila duplicada genera un issue
- **Columna**: 30% — Columnas con < 30% de valores únicos generan un issue informativo

### Issues generados

1. **Filas duplicadas**: Cuando hay filas completamente duplicadas
   - Incluye el número de duplicados y una muestra de hasta 5 filas
   
2. **Baja variabilidad en columnas**: Cuando una columna tiene < 30% valores únicos
   - Útil para detectar columnas con datos repetitivos o poco informativos

### Severidad dinámica

| Uniqueness | Severidad | Descripción |
|------------|-----------|-------------|
| < 50% | **critical** | Más de la mitad son duplicados |
| 50-70% | **high** | Problema grave de duplicación |
| 70-85% | **medium** | Duplicación significativa |
| 85-95% | **medium/low** | Algunos duplicados |
| 95-100% | **low** | Pocos duplicados |

**Ejemplo:**
- Uniqueness 40% (60% duplicados) → `critical`
- Uniqueness 91.4% (8.6% duplicados) → `low`
- Columna con 22% valores únicos → `critical` (muy baja variabilidad)

---

## Outliers (Valores Atípicos)

### Descripción
Detecta valores que se desvían significativamente del resto de los datos en columnas numéricas.

### Cómo se calcula

#### Método IQR (Interquartile Range) - Por defecto
```python
Q1 = series.quantile(0.25)
Q3 = series.quantile(0.75)
IQR = Q3 - Q1
lower_bound = Q1 - factor * IQR
upper_bound = Q3 + factor * IQR

# Un valor es outlier si:
outlier = (valor < lower_bound) OR (valor > upper_bound)
```

#### Método Z-Score (alternativo)
```python
mean = series.mean()
std = series.std()
z_score = (valor - mean) / std

# Un valor es outlier si:
outlier = abs(z_score) > threshold
```

### Configuración

```json
{
  "id": "outliers",
  "parameters": {
    "method": "iqr",
    "factor": 1.5,
    "columns": ["salario", "edad"]  // Opcional
  },
  "weight": 1.0
}
```

**Parámetros:**
- `method` (default: "iqr"): Método de detección ("iqr" o "zscore")
- `factor` (default: 1.5): 
  - Para IQR: multiplicador del rango intercuartílico (1.5 es estándar, 3.0 es más estricto)
  - Para Z-score: umbral de desviaciones estándar (típicamente 3.0)
- `columns` (opcional): Columnas numéricas a evaluar. Si no se especifica, se evalúan todas las columnas numéricas.
- `weight`: Peso de la métrica en el Quality Score.

### Aplicación
- **Nivel columna**: Se aplica individualmente a cada columna numérica
- Se calcula Q1, Q3, IQR y límites para cada columna
- Se reportan hasta 5 valores atípicos de muestra

### Issues generados

Para cada columna con outliers detectados:
- Número de outliers
- Proporción de outliers (% de valores afectados)
- Método usado (IQR o Z-score)
- Límites calculados (lower_bound, upper_bound, Q1, Q3, IQR)
- Muestra de hasta 5 valores atípicos

### Severidad dinámica

La severidad se basa en la **proporción de valores que son outliers**:

| Proporción de outliers | Severidad | Descripción |
|------------------------|-----------|-------------|
| ≥ 20% | **critical** | Más de 1 de cada 5 valores es atípico |
| 10-20% | **high** | Problema grave de valores atípicos |
| 5-10% | **medium** | Cantidad moderada de outliers |
| < 5% | **low** | Pocos outliers (esperado en datos reales) |

**Ejemplo:**
- 5 outliers de 33 valores = 15.2% → `high`
- 2 outliers de 100 valores = 2% → `low`
- 50 outliers de 200 valores = 25% → `critical`

### Interpretación de resultados

**Para el dataset `clientes_v1_desastre` con columna `salario`:**
```
Q1 = 45,000
Q3 = 65,000
IQR = 20,000
Lower bound = 45,000 - (1.5 × 20,000) = 15,000
Upper bound = 65,000 + (1.5 × 20,000) = 95,000

Outliers detectados:
- -5,000 (por debajo del límite inferior)
- 999,999,999 (muy por encima del límite superior)
```

---

## Consistency (Consistencia)

### Descripción
Verifica que los datos cumplan con patrones o reglas definidas (expresiones regulares, formatos, etc.).

### Cómo se calcula

```python
# Para cada columna y patrón definido
matches = df[column].astype(str).str.match(pattern)
consistency = matches.sum() / len(df)
```

### Configuración

```json
{
  "id": "consistency",
  "parameters": {
    "rules": {
      "email": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
      "telefono": "^\\+?[0-9]{9,15}$"
    }
  },
  "weight": 1.0
}
```

**Parámetros:**
- `rules`: Diccionario de `{columna: patron_regex}`
- Cada patrón es una expresión regular que los valores deben cumplir
- `weight`: Peso de la métrica en el Quality Score.

### Issues generados

Para cada columna que no cumple el patrón:
- Número de valores inconsistentes
- Patrón esperado
- Muestra de valores que no cumplen

### Severidad
- `high`: Si el patrón es inválido (error de regex)
- `medium`: Si hay valores inconsistentes

---

## Sistema de Severidad Dinámica

### Niveles de severidad

DataQual utiliza 4 niveles de severidad:

1. **critical** 🔴 — Problema crítico que requiere atención inmediata
2. **high** 🟠 — Problema grave que debe resolverse pronto
3. **medium** 🟡 — Problema moderado que debe monitorearse
4. **low** 🟢 — Advertencia leve o problema menor

### Cálculo de severidad

La severidad se calcula **dinámicamente** según:

1. **Distancia del umbral**: Cuanto más lejos del umbral, más grave
2. **Proporción de afectación**: Para outliers, % de valores afectados
3. **Contexto de la métrica**: Cada métrica tiene su propia escala

### Impacto en el Quality Score

Cada issue detectado aplica una **penalización** al Quality Score base:

```
Penalización = (high_count × 5%) + (medium_count × 2.5%) + (low_count × 1%)
Quality Score = Base Score - Penalización
```

**Ejemplo con dataset `v1_desastre`:**
```
Base Score = avg(88.9%, 91.4%, 54.5%) = 78.3%
Issues: 4 high + 8 medium + 0 low
Penalización = (4 × 5%) + (8 × 2.5%) = 20% + 20% = 40%
Quality Score = 78.3% - 40% = 38.3%
```

### Ventajas del sistema dinámico

1. **Proporcionalidad**: 50% de completeness es más grave que 85%
2. **Transparencia**: El usuario entiende por qué un issue es crítico
3. **Priorización**: Los equipos pueden enfocarse en issues `critical` y `high` primero
4. **Flexibilidad**: Se adapta a diferentes tipos de datos y contextos

---

## Configuración de Métricas por Defecto

Cuando se ejecuta una evaluación sin configuración explícita, se usan estas métricas:

```json
[
  {
    "id": "completeness",
    "parameters": {},
    "weight": 1.0
  },
  {
    "id": "uniqueness",
    "parameters": {},
    "weight": 1.0
  },
  {
    "id": "outliers",
    "parameters": {
      "method": "iqr",
      "factor": 1.5
    },
    "weight": 1.0
  }
]
```

## Personalización de Métricas

Las métricas se pueden personalizar al crear una evaluación:

```python
# Ejemplo: Evaluación personalizada
metrics_config = {
    "metrics": [
        {
            "id": "completeness",
            "parameters": {"threshold": 0.90},  # Más permisivo
            "weight": 2.0  # Doble peso
        },
        {
            "id": "outliers",
            "parameters": {
                "method": "zscore",
                "factor": 3.0,  # Más estricto (solo outliers extremos)
                "columns": ["salario", "edad"]
            },
            "weight": 1.0
        }
    ]
}
```

---

## Preguntas Frecuentes

### ¿Por qué mi Quality Score es bajo si las métricas individuales son altas?

El Quality Score incluye una **penalización por issues detectados**. Incluso si las métricas base son altas (ej: 88% completeness, 91% uniqueness), si hay muchos issues (especialmente `high` o `critical`), la penalización puede reducir significativamente el score final.

### ¿Cómo cambio los umbrales de las métricas?

Al crear una evaluación, especifica los parámetros en `metrics_config`:

```json
{
  "id": "completeness",
  "parameters": {
    "threshold": 0.85  // Cambiar de 95% a 85%
  }
}
```

### ¿Qué significa "Threshold: 100%" en Uniqueness?

Significa que **no se toleran duplicados**. Cualquier fila duplicada generará un issue. Si quieres permitir algunos duplicados, ajusta el threshold a un valor menor (ej: 0.95 para tolerar hasta 5% de duplicados).

### ¿Cómo interpreto los límites de outliers?

Los límites indican el rango "normal" esperado:
- **Lower bound**: Valores por debajo son outliers bajos
- **Upper bound**: Valores por encima son outliers altos

Ejemplo: Si `lower_bound = 15,000` y `upper_bound = 95,000`, entonces:
- `-5,000` es un outlier bajo (posiblemente un error)
- `999,999,999` es un outlier alto (posiblemente un error de entrada)

### ¿Puedo desactivar una métrica?

Sí, simplemente no la incluyas en el `metrics_config` al crear la evaluación. Si no especificas configuración, se usan las métricas por defecto (completeness, uniqueness, outliers).

---

## Roadmap de Métricas

Métricas planificadas para futuras versiones:

- **Timeliness**: Validación de fechas y timestamps
- **Accuracy**: Comparación con fuentes de referencia
- **Validity**: Validación de rangos y tipos de datos
- **Schema Compliance**: Verificación de estructura y tipos esperados
- **Referential Integrity**: Validación de claves foráneas y relaciones

---

**Última actualización**: 14 de marzo de 2026
