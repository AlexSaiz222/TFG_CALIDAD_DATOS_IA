-- Script para actualizar métricas a español y eliminar obsoletas
-- Ejecutar directamente en la base de datos existente

-- 1. Eliminar issues que referencian métricas obsoletas
DELETE FROM issues WHERE metric_id IN (
    SELECT id FROM metrics WHERE name IN ('drift', 'distribution', 'accuracy', 'consistency')
);

-- 2. Eliminar métricas obsoletas
DELETE FROM metrics WHERE name IN ('drift', 'distribution', 'accuracy', 'consistency', 'feature_correlation');

-- 3. Actualizar descripciones y parámetros de métricas existentes a español
UPDATE metrics SET 
    description = 'Mide el porcentaje de valores no nulos en cada columna. Detecta campos vacíos, nulos o faltantes que pueden afectar la calidad del análisis.',
    category = 'data_quality',
    parameters = '{"threshold": 0.95, "columns": []}'::jsonb
WHERE name = 'completeness';

UPDATE metrics SET 
    description = 'Detecta filas duplicadas y mide la variabilidad de valores únicos por columna. Identifica problemas de duplicación y baja cardinalidad.',
    category = 'data_quality',
    parameters = '{"threshold": 1.0, "columns": []}'::jsonb
WHERE name = 'uniqueness';

UPDATE metrics SET 
    description = 'Detecta valores atípicos en columnas numéricas usando métodos estadísticos (IQR, Z-score). Identifica datos anómalos que pueden ser errores o casos excepcionales.',
    category = 'data_quality',
    parameters = '{"method": "iqr", "factor": 1.5, "columns": [], "auto_detect": true}'::jsonb
WHERE name = 'outliers';

UPDATE metrics SET 
    description = 'Evalúa la frescura y antigüedad de fechas (Currentness, ISO 5259-2 Cur-ML-1). Detecta datos obsoletos o fuera del rango temporal esperado.',
    category = 'data_quality',
    parameters = '{"columns": [], "staleness_threshold_days": 30, "auto_detect": true}'::jsonb
WHERE name = 'currentness';

UPDATE metrics SET 
    description = 'Mide el equilibrio en la distribución de variables categóricas. Detecta desbalances que pueden afectar modelos de clasificación.',
    category = 'distribution',
    parameters = '{"columns": [], "auto_detect": true, "imbalance_threshold_high": 0.90, "imbalance_threshold_low": 0.05, "max_cardinality": 50}'::jsonb
WHERE name = 'class_balance';

UPDATE metrics SET 
    description = 'Mide la cobertura de valores esperados por columna (ISO 5259-2). Para categóricas comprueba la presencia de valores definidos; para numéricas, la cobertura del rango esperado.',
    category = 'data_quality',
    parameters = '{"columns": {}, "threshold": 0.60}'::jsonb
WHERE name = 'diversity';

-- 4. Insertar métricas nuevas si no existen
INSERT INTO metrics (name, description, category, parameters)
SELECT 'syntactic_accuracy', 
       'Valida que los valores cumplan con el tipo de dato esperado, patrones regex o restricciones de longitud. Detecta errores de formato y valores mal tipados.',
       'accuracy',
       '{"columns": [], "custom_patterns": {}, "auto_detect_types": true, "threshold": 0.95}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM metrics WHERE name = 'syntactic_accuracy');

INSERT INTO metrics (name, description, category, parameters)
SELECT 'logical_consistency',
       'Valida reglas lógicas entre campos dentro de cada registro. Detecta inconsistencias como fechas de fin anteriores a fechas de inicio o valores mutuamente excluyentes.',
       'consistency',
       '{"rules": []}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM metrics WHERE name = 'logical_consistency');

INSERT INTO metrics (name, description, category, parameters)
SELECT 'diversity',
       'Mide la cobertura de valores esperados por columna (ISO 5259-2). Para categóricas comprueba la presencia de valores definidos; para numéricas, la cobertura del rango esperado.',
       'data_quality',
       '{"columns": {}, "threshold": 0.60}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM metrics WHERE name = 'diversity');

-- 5. Verificar resultado
SELECT name, LEFT(description, 60) as description_preview, category 
FROM metrics 
ORDER BY name;
