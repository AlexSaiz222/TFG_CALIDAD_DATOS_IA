-- Migration: Add diversity metric to existing databases
-- Run this if the DB was already initialized before the diversity metric was added to init.sql

INSERT INTO metrics (name, description, category, parameters)
SELECT 'diversity',
       'Mide la cobertura de valores esperados por columna (ISO 5259-2). Para categóricas: presencia de valores definidos. Para numéricas: cobertura de rango.',
       'data_quality',
       '{"columns": {}, "threshold": 0.60}'
WHERE NOT EXISTS (SELECT 1 FROM metrics WHERE name = 'diversity');
