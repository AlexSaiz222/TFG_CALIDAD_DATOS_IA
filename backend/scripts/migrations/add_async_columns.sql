-- Migración para añadir nuevas columnas a la tabla evaluation
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS task_id VARCHAR(255);
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS current_step VARCHAR(255);
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS error TEXT;

-- Actualizar evaluaciones existentes
UPDATE evaluations SET progress = 100 WHERE status = 'completed';
UPDATE evaluations SET progress = 0 WHERE status = 'pending';
UPDATE evaluations SET progress = 0 WHERE status = 'failed';
