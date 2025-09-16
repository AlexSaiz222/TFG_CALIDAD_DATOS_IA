# Sistema de Evaluaciones de Calidad de Datos

## Introducción

El sistema de evaluaciones es un componente central de la Plataforma de Evaluación de Calidad de Datos para Proyectos de IA. Permite analizar datasets para identificar problemas de calidad, calcular métricas y proporcionar recomendaciones de mejora. Este documento describe la arquitectura actual, el flujo de trabajo, las métricas implementadas y proporciona una hoja de ruta para el desarrollo futuro.

## Arquitectura Actual

### Componentes Principales

1. **API de Evaluaciones** (`backend/api/evaluations/routes.py`)
   - Endpoints RESTful para crear, listar, consultar y gestionar evaluaciones
   - Implementa autenticación y control de acceso basado en permisos
   - Maneja la paginación y filtrado de resultados

2. **Servicio de Evaluación** (`backend/services/evaluation_service.py`)
   - Implementa la lógica principal para ejecutar evaluaciones de calidad
   - Calcula métricas como completitud, unicidad, consistencia y detección de outliers
   - Genera puntuaciones de calidad y detecta problemas (issues)

3. **Servicio Híbrido de Evaluación** (`backend/services/hybrid_evaluation_service.py`)
   - Proporciona un mecanismo de respaldo para garantizar que las evaluaciones se completen
   - Combina procesamiento asíncrono (Celery) con ejecución directa
   - Implementa un sistema de watchdog para detectar y resolver evaluaciones estancadas

4. **Tareas Asíncronas** (`backend/tasks/evaluation_tasks.py`)
   - Define tareas Celery para procesamiento en segundo plano
   - Implementa manejo de errores y reintentos
   - Actualiza el progreso y estado de las evaluaciones

5. **Middleware de Monitoreo** (`backend/middleware/evaluation_watchdog.py`)
   - Detecta evaluaciones estancadas en estado 'pending' o 'processing'
   - Intenta resolver automáticamente evaluaciones problemáticas
   - Ejecuta en un hilo separado para no bloquear la aplicación principal

6. **Modelos de Datos** (`backend/models/evaluation.py`)
   - Define las estructuras de datos para evaluaciones e issues
   - Implementa métodos para serialización y conversión de tipos
   - Gestiona relaciones con otros modelos (datasets, proyectos, métricas)

### Flujo de Trabajo de Evaluación

1. **Creación de Evaluación**
   - El usuario selecciona un dataset y configura métricas a evaluar
   - Se crea un registro de evaluación en estado 'pending'
   - Se inicia una tarea asíncrona con Celery

2. **Procesamiento**
   - La tarea asíncrona actualiza el estado a 'processing'
   - Se descarga el dataset desde MinIO/S3
   - Se ejecutan las métricas configuradas
   - Se actualiza el progreso durante la ejecución

3. **Finalización**
   - Se calculan puntuaciones de calidad globales y por categoría
   - Se identifican y registran problemas (issues)
   - Se actualiza el estado a 'completed' o 'failed'
   - Se almacenan resultados detallados en la base de datos

4. **Monitoreo y Recuperación**
   - El watchdog detecta evaluaciones estancadas
   - Se intenta resolver automáticamente problemas
   - Se implementa un sistema de fallback para garantizar la finalización

## Métricas Implementadas

### 1. Completitud (Completeness)
- **Descripción**: Mide el porcentaje de valores no nulos en el dataset
- **Parámetros**: 
  - `columns`: Lista de columnas a evaluar (opcional)
  - `threshold`: Umbral mínimo aceptable (por defecto: 0.95)
- **Puntuación**: 0.0 (peor) a 1.0 (mejor)
- **Issues**: Identifica columnas con altas tasas de valores nulos

### 2. Unicidad (Uniqueness)
- **Descripción**: Evalúa la proporción de valores únicos en columnas o filas
- **Parámetros**:
  - `columns`: Lista de columnas a evaluar (opcional)
  - `threshold`: Umbral mínimo aceptable (por defecto: 1.0)
- **Puntuación**: 0.0 (peor) a 1.0 (mejor)
- **Issues**: Detecta duplicados en columnas específicas o filas completas

### 3. Consistencia de Patrón (Consistency Pattern)
- **Descripción**: Verifica que los valores sigan un patrón específico (regex)
- **Parámetros**:
  - `column`: Columna a evaluar
  - `pattern`: Expresión regular para validar
  - `threshold`: Umbral mínimo aceptable (por defecto: 0.95)
- **Puntuación**: 0.0 (peor) a 1.0 (mejor)
- **Issues**: Identifica valores que no cumplen con el patrón esperado

### 4. Detección de Outliers
- **Descripción**: Identifica valores atípicos en columnas numéricas
- **Parámetros**:
  - `columns`: Lista de columnas a evaluar (opcional)
  - `method`: Método de detección ('iqr' o 'zscore')
  - `factor`: Factor para el método IQR o umbral para Z-score
- **Puntuación**: Basada en la proporción de valores no outliers
- **Issues**: Reporta columnas con alta presencia de outliers

## Sistema de Issues

Los issues son problemas detectados durante la evaluación que requieren atención. Cada issue incluye:

1. **Severidad**: alta, media o baja
2. **Descripción**: Explicación del problema detectado
3. **Métrica asociada**: Qué métrica identificó el problema
4. **Columnas afectadas**: Qué columnas presentan el problema
5. **Filas afectadas**: Información sobre filas problemáticas (cuando aplica)

Los issues se almacenan en la base de datos y se pueden consultar a través de la API para su visualización en el frontend.

## Procesamiento Asíncrono

El sistema utiliza Celery con Redis como broker para el procesamiento asíncrono, lo que permite:

1. **Escalabilidad**: Procesar múltiples evaluaciones en paralelo
2. **Resiliencia**: Reintentar automáticamente evaluaciones fallidas
3. **Monitoreo**: Seguimiento en tiempo real del progreso
4. **No bloqueo**: La interfaz de usuario permanece responsiva durante el procesamiento

Además, se implementa un sistema híbrido que combina Celery con procesamiento directo como fallback para garantizar que las evaluaciones siempre se completen, incluso si hay problemas con el worker de Celery.

## Áreas de Mejora y Desarrollo Futuro

### 1. Nuevas Métricas

#### Métricas de Precisión
- **Rango de Valores**: Verificar que los valores numéricos estén dentro de rangos esperados
- **Precisión Decimal**: Evaluar la precisión decimal de valores numéricos
- **Validación de Fechas**: Verificar formatos y rangos de fechas

#### Métricas de Consistencia
- **Consistencia entre Columnas**: Verificar relaciones lógicas entre columnas
- **Consistencia Temporal**: Evaluar la coherencia de series temporales
- **Integridad Referencial**: Verificar referencias entre datasets relacionados

#### Métricas Avanzadas
- **Detección de Anomalías**: Implementar algoritmos más sofisticados (isolation forest, autoencoders)
- **Calidad Semántica**: Evaluar la coherencia semántica de textos
- **Bias y Fairness**: Detectar sesgos en los datos para modelos de IA

### 2. Optimizaciones de Rendimiento

- **Procesamiento por Lotes**: Implementar evaluación por lotes para datasets grandes
- **Muestreo Inteligente**: Utilizar técnicas de muestreo para datasets masivos
- **Caché de Resultados Intermedios**: Almacenar resultados parciales para reutilización
- **Paralelización**: Ejecutar métricas en paralelo dentro de una misma evaluación

### 3. Mejoras en la Gestión de Issues

- **Sistema de Priorización**: Clasificar issues automáticamente por importancia
- **Recomendaciones de Corrección**: Sugerir acciones para resolver problemas detectados
- **Seguimiento Histórico**: Rastrear la evolución de issues a lo largo del tiempo
- **Exportación de Issues**: Generar informes detallados de problemas

### 4. Integración con Herramientas de Limpieza

- **Generación de Scripts**: Crear scripts de limpieza basados en issues detectados
- **Integración con Pandas/Dask**: Proporcionar código ejecutable para corregir problemas
- **Automatización de Correcciones**: Implementar correcciones automáticas para issues comunes
- **Flujos de Trabajo de Validación**: Crear pipelines para validar datos antes de su uso en modelos

### 5. Visualizaciones Avanzadas

- **Dashboards Interactivos**: Crear visualizaciones dinámicas de resultados de evaluación
- **Comparativas Temporales**: Visualizar la evolución de la calidad a lo largo del tiempo
- **Mapas de Calor**: Identificar visualmente áreas problemáticas en los datasets
- **Gráficos de Distribución**: Visualizar distribuciones de datos con outliers marcados

## Conclusión

El sistema de evaluaciones proporciona una base sólida para analizar la calidad de los datos en proyectos de IA. La arquitectura actual combina procesamiento asíncrono con mecanismos de respaldo para garantizar fiabilidad, mientras que el diseño modular facilita la extensión con nuevas métricas y funcionalidades.

Las áreas de desarrollo futuro se centran en ampliar el catálogo de métricas, mejorar el rendimiento para datasets grandes, proporcionar recomendaciones más detalladas y crear visualizaciones avanzadas para facilitar la interpretación de resultados.

La implementación de estas mejoras permitirá a los usuarios identificar y resolver problemas de calidad de datos de manera más eficiente, lo que resultará en modelos de IA más precisos y confiables.
