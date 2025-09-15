-- Migration script to add missing columns to evaluations table

-- Add task_id column
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS task_id varchar(100);

-- Add progress column with default value 0
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0 NOT NULL;

-- Add current_step column
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS current_step varchar(255);

-- Add error column
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS error text;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'evaluations' AND table_schema = 'public'
ORDER BY ordinal_position;
