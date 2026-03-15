-- Migration: Add issue_type and fingerprint columns to issues table
-- Date: 2026-03-15
-- Description: Add issue_type and fingerprint columns to match DataQualityIssue structure

-- Add issue_type column
ALTER TABLE issues ADD COLUMN IF NOT EXISTS issue_type VARCHAR(100);

-- Add fingerprint column with index
ALTER TABLE issues ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_issues_fingerprint ON issues(fingerprint);

-- Update existing issues to set issue_type based on description patterns
-- This is a best-effort migration for existing data
UPDATE issues 
SET issue_type = CASE
    WHEN description LIKE '%completeness%' OR description LIKE '%null%' OR description LIKE '%missing%' THEN 'completeness'
    WHEN description LIKE '%uniqueness%' OR description LIKE '%duplicate%' OR description LIKE '%variability%' THEN 'uniqueness'
    WHEN description LIKE '%outlier%' OR description LIKE '%atypical%' THEN 'outliers'
    WHEN description LIKE '%consistency%' OR description LIKE '%pattern%' OR description LIKE '%format%' THEN 'consistency'
    ELSE 'unknown'
END
WHERE issue_type IS NULL;
