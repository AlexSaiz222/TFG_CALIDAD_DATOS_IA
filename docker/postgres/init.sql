-- Initialize database schema for Data Quality Evaluation Platform

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    organization VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create datasets table
CREATE TABLE IF NOT EXISTS datasets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    file_path VARCHAR(255) NOT NULL,
    file_size BIGINT,
    row_count INTEGER,
    column_count INTEGER,
    schema JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create metrics table
CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    parameters JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create metric_templates table
CREATE TABLE IF NOT EXISTS metric_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metrics JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create evaluations table
CREATE TABLE IF NOT EXISTS evaluations (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER REFERENCES datasets(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    metrics_config JSONB NOT NULL,
    results JSONB,
    quality_score NUMERIC,
    task_id VARCHAR(255),
    progress INTEGER DEFAULT 0,
    current_step VARCHAR(255),
    error TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create issues table
CREATE TABLE IF NOT EXISTS issues (
    id SERIAL PRIMARY KEY,
    evaluation_id INTEGER REFERENCES evaluations(id) ON DELETE CASCADE,
    metric_id INTEGER REFERENCES metrics(id),
    severity VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    affected_columns JSONB,
    affected_rows JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default metrics
INSERT INTO metrics (name, description, category, parameters) VALUES
('completeness', 'Measures the presence of null values in the dataset', 'data_quality', '{"threshold": 0.95}'),
('uniqueness', 'Identifies duplicate records in the dataset', 'data_quality', '{"threshold": 1.0}'),
('consistency', 'Checks if data follows consistent patterns and formats', 'data_quality', '{"threshold": 0.9}'),
('accuracy', 'Validates data against known reference values', 'data_quality', '{"threshold": 0.9}'),
('timeliness', 'Assesses if data is up-to-date', 'data_quality', '{"threshold": 0.8}'),
('distribution', 'Analyzes the statistical distribution of numeric columns', 'statistical', '{"method": "histogram"}'),
('outliers', 'Detects outliers using statistical methods', 'statistical', '{"method": "iqr", "factor": 1.5}'),
('class_balance', 'Evaluates balance of target classes for classification tasks', 'ml_specific', '{"threshold": 0.8}'),
('feature_correlation', 'Measures correlation between features', 'ml_specific', '{"method": "pearson", "threshold": 0.7}'),
('drift', 'Detects data drift between training and production data', 'ml_specific', '{"method": "ks_test", "threshold": 0.05}');

-- Insert default metric templates
INSERT INTO metric_templates (name, description, metrics) VALUES
('Basic Data Quality', 'Basic metrics for general data quality assessment', 
 '[{"metric_id": 1, "parameters": {"threshold": 0.95}}, 
   {"metric_id": 2, "parameters": {"threshold": 1.0}}, 
   {"metric_id": 3, "parameters": {"threshold": 0.9}}]'),
('ML Classification', 'Metrics for classification datasets', 
 '[{"metric_id": 1, "parameters": {"threshold": 0.95}}, 
   {"metric_id": 2, "parameters": {"threshold": 1.0}}, 
   {"metric_id": 8, "parameters": {"threshold": 0.8}}, 
   {"metric_id": 9, "parameters": {"threshold": 0.7}}]'),
('ML Regression', 'Metrics for regression datasets', 
 '[{"metric_id": 1, "parameters": {"threshold": 0.95}}, 
   {"metric_id": 6, "parameters": {"method": "histogram"}}, 
   {"metric_id": 7, "parameters": {"method": "iqr", "factor": 1.5}}, 
   {"metric_id": 9, "parameters": {"method": "pearson", "threshold": 0.7}}]');

-- Insert demo user
INSERT INTO users (username, email, password_hash, first_name, last_name, organization, role)
VALUES ('demo', 'demo@example.com', '$2b$12$tPBUXAoX8vVQxU9DOiKOh.wPrLg4MR1jueKIGsM3NIHdUmwzKw5cO', 'Demo', 'User', 'Demo Organization', 'admin');
