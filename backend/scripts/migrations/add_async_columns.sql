-- Migración para añadir nuevas columnas a la tabla evaluation
ALTER TABLE evaluation ADD COLUMN IF NOT EXISTS task_id VARCHAR(255);
ALTER TABLE evaluation ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE evaluation ADD COLUMN IF NOT EXISTS current_step VARCHAR(255);
ALTER TABLE evaluation ADD COLUMN IF NOT EXISTS error TEXT;

-- Actualizar evaluaciones existentes
UPDATE evaluation SET progress = 100 WHERE status = 'completed';
UPDATE evaluation SET progress = 0 WHERE status = 'pending';
UPDATE evaluation SET progress = 0 WHERE status = 'failed';
