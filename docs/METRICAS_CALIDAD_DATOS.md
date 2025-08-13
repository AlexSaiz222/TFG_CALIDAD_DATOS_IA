# Métricas de Calidad de Datos

Este documento describe en detalle las métricas de calidad de datos implementadas en la Plataforma de Evaluación de Calidad de Datos para Proyectos de IA. Las métricas están organizadas por categorías y se proporciona información sobre su implementación, interpretación y casos de uso.

## Índice
1. [Introducción](#introducción)
2. [Categorías de Métricas](#categorías-de-métricas)
3. [Métricas de Completitud](#métricas-de-completitud)
4. [Métricas de Unicidad](#métricas-de-unicidad)
5. [Métricas de Validez](#métricas-de-validez)
6. [Métricas de Consistencia](#métricas-de-consistencia)
7. [Métricas de Precisión](#métricas-de-precisión)
8. [Métricas de Integridad](#métricas-de-integridad)
9. [Métricas de Actualidad](#métricas-de-actualidad)
10. [Métricas Personalizadas](#métricas-personalizadas)
11. [Plantillas de Métricas](#plantillas-de-métricas)
12. [Interpretación de Resultados](#interpretación-de-resultados)
13. [Mejores Prácticas](#mejores-prácticas)

## Introducción

Las métricas de calidad de datos son medidas cuantitativas que evalúan diferentes aspectos de los datos para determinar su idoneidad para un propósito específico. En el contexto de proyectos de inteligencia artificial, la calidad de los datos es fundamental para el éxito de los modelos y análisis.

La plataforma implementa un conjunto completo de métricas estándar y permite la definición de métricas personalizadas para adaptarse a diferentes dominios y casos de uso.

## Categorías de Métricas

Las métricas se organizan en siete categorías principales, cada una enfocada en un aspecto diferente de la calidad de datos:

1. **Completitud**: Evalúa la presencia de todos los datos necesarios
2. **Unicidad**: Evalúa la ausencia de duplicados y la cardinalidad adecuada
3. **Validez**: Evalúa la conformidad con reglas de negocio y formatos esperados
4. **Consistencia**: Evalúa la coherencia entre campos relacionados
5. **Precisión**: Evalúa la exactitud de los valores respecto a la realidad
6. **Integridad**: Evalúa las relaciones y referencias entre datos
7. **Actualidad**: Evalúa la frescura y relevancia temporal de los datos

## Métricas de Completitud

### Tasa de Valores Nulos

**Descripción**: Porcentaje de valores nulos en una columna o conjunto de datos.

**Implementación**:
```python
def null_rate(data, column=None):
    """Calculate the null rate for a column or entire dataset"""
    if column:
        return data[column].isnull().mean() * 100
    return data.isnull().mean().mean() * 100
```

**Parámetros**:
- `threshold`: Umbral máximo aceptable (por defecto: 5%)
- `severity`: Niveles de severidad (por defecto: >5% Warning, >20% Error)

**Interpretación**:
- 0%: Ideal, sin valores nulos
- <5%: Aceptable para la mayoría de casos
- 5-20%: Requiere atención
- >20%: Problema crítico que debe ser abordado

### Tasa de Valores Vacíos

**Descripción**: Porcentaje de valores vacíos (strings de longitud cero) en columnas de texto.

**Implementación**:
```python
def empty_string_rate(data, column):
    """Calculate the empty string rate for a text column"""
    if data[column].dtype != 'object':
        return 0
    return (data[column] == '').mean() * 100
```

### Densidad de Información

**Descripción**: Medida compuesta que evalúa la cantidad de información útil presente.

**Implementación**:
```python
def information_density(data):
    """Calculate information density across the dataset"""
    non_null = 1 - data.isnull().mean().mean()
    non_empty = 1 - ((data.select_dtypes(include=['object']) == '').mean().mean())
    return (non_null * non_empty) * 100
```

## Métricas de Unicidad

### Tasa de Duplicados

**Descripción**: Porcentaje de filas duplicadas en el conjunto de datos.

**Implementación**:
```python
def duplicate_rate(data, columns=None):
    """Calculate duplicate rate based on all or specific columns"""
    if columns:
        return (data.duplicated(subset=columns).sum() / len(data)) * 100
    return (data.duplicated().sum() / len(data)) * 100
```

### Cardinalidad Relativa

**Descripción**: Relación entre valores únicos y total de valores en una columna.

**Implementación**:
```python
def relative_cardinality(data, column):
    """Calculate relative cardinality of a column"""
    return (data[column].nunique() / len(data)) * 100
```

**Interpretación**:
- Cerca de 100%: Alta cardinalidad (ej. identificadores únicos)
- Cerca de 0%: Baja cardinalidad (ej. categorías)

## Métricas de Validez

### Conformidad con Formato

**Descripción**: Porcentaje de valores que cumplen con un formato específico (ej. email, fecha, código postal).

**Implementación**:
```python
def format_compliance(data, column, pattern):
    """Calculate format compliance using regex pattern"""
    import re
    regex = re.compile(pattern)
    valid = data[column].apply(lambda x: bool(regex.match(str(x))) if pd.notna(x) else False)
    return (valid.sum() / len(data)) * 100
```

### Valores Fuera de Rango

**Descripción**: Porcentaje de valores numéricos fuera de un rango esperado.

**Implementación**:
```python
def out_of_range_rate(data, column, min_value, max_value):
    """Calculate percentage of values outside specified range"""
    out_of_range = ((data[column] < min_value) | (data[column] > max_value)).sum()
    return (out_of_range / len(data)) * 100
```

### Validez de Categorías

**Descripción**: Porcentaje de valores categóricos que pertenecen a un conjunto válido de categorías.

**Implementación**:
```python
def category_validity(data, column, valid_categories):
    """Calculate percentage of values that belong to valid categories"""
    valid = data[column].isin(valid_categories)
    return (valid.sum() / len(data)) * 100
```

## Métricas de Consistencia

### Consistencia entre Columnas

**Descripción**: Evalúa si los valores en columnas relacionadas son coherentes entre sí.

**Implementación**:
```python
def column_consistency(data, rule_function):
    """Calculate consistency based on a custom rule function"""
    consistent = data.apply(rule_function, axis=1)
    return (consistent.sum() / len(data)) * 100
```

**Ejemplo de regla**:
```python
def date_consistency_rule(row):
    """Check if start_date is before end_date"""
    if pd.isna(row['start_date']) or pd.isna(row['end_date']):
        return True
    return row['start_date'] <= row['end_date']
```

### Consistencia de Esquema

**Descripción**: Evalúa si el esquema del dataset (tipos de datos, nombres de columnas) coincide con un esquema esperado.

**Implementación**:
```python
def schema_consistency(data, expected_schema):
    """Check if dataset schema matches expected schema"""
    actual_dtypes = {col: str(dtype) for col, dtype in data.dtypes.items()}
    matches = sum(1 for col, dtype in expected_schema.items() 
                 if col in actual_dtypes and actual_dtypes[col] == dtype)
    return (matches / len(expected_schema)) * 100
```

## Métricas de Precisión

### Distancia a la Referencia

**Descripción**: Evalúa la diferencia entre valores y valores de referencia conocidos.

**Implementación**:
```python
def reference_distance(data, column, reference_data, reference_column):
    """Calculate average distance to reference values"""
    from scipy.spatial.distance import cdist
    import numpy as np
    
    values = data[column].values.reshape(-1, 1)
    ref_values = reference_data[reference_column].values.reshape(-1, 1)
    
    distances = cdist(values, ref_values, 'euclidean')
    min_distances = np.min(distances, axis=1)
    
    return np.mean(min_distances)
```

### Precisión Estadística

**Descripción**: Evalúa si las estadísticas del dataset (media, desviación estándar) están dentro de rangos esperados.

**Implementación**:
```python
def statistical_accuracy(data, column, expected_mean, expected_std, tolerance=0.1):
    """Check if column statistics are within expected ranges"""
    actual_mean = data[column].mean()
    actual_std = data[column].std()
    
    mean_diff = abs(actual_mean - expected_mean) / expected_mean
    std_diff = abs(actual_std - expected_std) / expected_std
    
    return 100 - ((mean_diff + std_diff) / 2) * 100
```

## Métricas de Integridad

### Integridad Referencial

**Descripción**: Evalúa si los valores en una columna existen como claves en otra tabla/columna.

**Implementación**:
```python
def referential_integrity(data, column, reference_data, reference_column):
    """Calculate percentage of values that exist in reference data"""
    reference_values = set(reference_data[reference_column].unique())
    valid_refs = data[column].isin(reference_values)
    return (valid_refs.sum() / len(data)) * 100
```

### Consistencia de Relaciones

**Descripción**: Evalúa si las relaciones entre entidades son consistentes.

**Implementación**:
```python
def relationship_consistency(data1, key1, data2, key2, relationship_type='one-to-many'):
    """Check consistency of relationships between datasets"""
    values1 = set(data1[key1].unique())
    values2 = set(data2[key2].unique())
    
    if relationship_type == 'one-to-one':
        return 100 - (len(values1.symmetric_difference(values2)) / len(values1.union(values2))) * 100
    elif relationship_type == 'one-to-many':
        return (len(values2.intersection(values1)) / len(values2)) * 100
    elif relationship_type == 'many-to-many':
        return (len(values1.intersection(values2)) / len(values1.union(values2))) * 100
```

## Métricas de Actualidad

### Frescura de Datos

**Descripción**: Evalúa cuán recientes son los datos basándose en una columna de fecha.

**Implementación**:
```python
def data_freshness(data, date_column, reference_date=None):
    """Calculate average age of data in days"""
    import pandas as pd
    
    if reference_date is None:
        reference_date = pd.Timestamp.now()
    
    age = (reference_date - pd.to_datetime(data[date_column])).dt.days
    return age.mean()
```

### Tasa de Actualización

**Descripción**: Porcentaje de registros actualizados en un período específico.

**Implementación**:
```python
def update_rate(data, update_date_column, period_days=30):
    """Calculate percentage of records updated within specified period"""
    import pandas as pd
    
    reference_date = pd.Timestamp.now()
    updated_recently = (reference_date - pd.to_datetime(data[update_date_column])).dt.days <= period_days
    return (updated_recently.sum() / len(data)) * 100
```

## Métricas Personalizadas

La plataforma permite la definición de métricas personalizadas mediante:

1. **Funciones Python**: Definición de funciones personalizadas que implementan lógica específica
2. **Expresiones SQL**: Para métricas que requieren consultas complejas
3. **Combinación de Métricas**: Creación de métricas compuestas a partir de métricas existentes

### Ejemplo de Métrica Personalizada

```python
def custom_data_quality_score(data, columns_config):
    """Calculate a custom data quality score based on multiple metrics"""
    scores = []
    weights = []
    
    for column, config in columns_config.items():
        if 'completeness' in config:
            null_rate_val = null_rate(data, column)
            scores.append(100 - null_rate_val)
            weights.append(config.get('weight', 1))
            
        if 'format' in config:
            format_val = format_compliance(data, column, config['format'])
            scores.append(format_val)
            weights.append(config.get('weight', 1))
    
    return sum(s * w for s, w in zip(scores, weights)) / sum(weights)
```

## Plantillas de Métricas

La plataforma incluye plantillas predefinidas para casos de uso comunes:

### Plantilla Básica

Conjunto mínimo de métricas para una evaluación rápida:
- Tasa de valores nulos
- Tasa de duplicados
- Validez de formato para columnas clave

### Plantilla para Datos Maestros

Enfocada en la calidad de datos maestros:
- Completitud
- Unicidad
- Consistencia
- Integridad referencial

### Plantilla para Datos Transaccionales

Optimizada para datos de transacciones:
- Completitud
- Validez
- Consistencia entre columnas relacionadas
- Frescura de datos

### Plantilla para Datos de Machine Learning

Diseñada para preparación de datos para modelos ML:
- Completitud
- Distribución estadística
- Detección de outliers
- Balance de clases (para datos etiquetados)

## Interpretación de Resultados

### Puntuación de Calidad

La plataforma calcula una puntuación global de calidad (0-100) basada en los resultados de las métricas individuales, ponderadas según su importancia:

```
Quality Score = Σ(Metric_Score * Metric_Weight) / Σ(Metric_Weight)
```

### Niveles de Severidad

Los problemas de calidad se clasifican en tres niveles de severidad:

1. **Información**: Observaciones que no afectan significativamente la calidad
2. **Advertencia**: Problemas que podrían afectar algunos análisis o modelos
3. **Error**: Problemas críticos que deben ser corregidos antes de usar los datos

### Visualización de Resultados

Los resultados se presentan mediante:

1. **Dashboard General**: Puntuación global y resumen de métricas
2. **Gráficos de Tendencia**: Evolución de la calidad a lo largo del tiempo
3. **Mapas de Calor**: Visualización de problemas por columna/métrica
4. **Informes Detallados**: Análisis profundo de cada problema detectado

## Mejores Prácticas

### Selección de Métricas

1. **Relevancia para el Dominio**: Seleccionar métricas relevantes para el caso de uso específico
2. **Cobertura Equilibrada**: Incluir métricas de diferentes categorías
3. **Simplicidad**: Comenzar con un conjunto básico y expandir según necesidad

### Configuración de Umbrales

1. **Basados en Requisitos**: Alinear umbrales con requisitos de negocio
2. **Enfoque Gradual**: Comenzar con umbrales permisivos y ajustar progresivamente
3. **Contextualización**: Considerar el contexto específico de cada columna

### Interpretación y Acción

1. **Priorización**: Abordar primero los problemas críticos
2. **Análisis de Causa Raíz**: Identificar las causas subyacentes
3. **Mejora Continua**: Establecer un ciclo de evaluación y mejora
4. **Documentación**: Mantener registro de problemas y soluciones

---

## Conclusión

Las métricas de calidad de datos implementadas en la plataforma proporcionan una evaluación completa y multidimensional de la calidad de los datos. La combinación de métricas estándar y personalizadas, junto con plantillas predefinidas, permite adaptar la evaluación a diferentes dominios y casos de uso.

La interpretación adecuada de los resultados y la implementación de acciones correctivas basadas en ellos son fundamentales para mejorar la calidad de los datos y, por ende, el rendimiento de los proyectos de inteligencia artificial que los utilizan.
