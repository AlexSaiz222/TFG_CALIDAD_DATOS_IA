-- Migración para añadir la columna metrics_config a la tabla projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS metrics_config JSONB DEFAULT '[]'::jsonb;
