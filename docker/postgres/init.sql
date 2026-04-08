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
    metrics_config JSONB DEFAULT '[]',
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
    sensitive_columns JSONB DEFAULT '[]'::jsonb,
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
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    is_system BOOLEAN DEFAULT false,
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

-- Insert default metrics (Spanish descriptions, active metrics only)
INSERT INTO metrics (name, description, category, parameters) VALUES
('completeness', 'Mide el porcentaje de valores no nulos en cada columna. Detecta campos vacíos, nulos o faltantes que pueden afectar la calidad del análisis.', 'data_quality', '{"threshold": 0.95, "columns": []}'),
('uniqueness', 'Detecta filas duplicadas y mide la variabilidad de valores únicos por columna. Identifica problemas de duplicación y baja cardinalidad.', 'data_quality', '{"threshold": 1.0, "columns": []}'),
('outliers', 'Detecta valores atípicos en columnas numéricas usando métodos estadísticos (IQR, Z-score). Identifica datos anómalos que pueden ser errores o casos excepcionales.', 'data_quality', '{"method": "iqr", "factor": 1.5, "columns": [], "auto_detect": true}'),
('syntactic_accuracy', 'Valida que los valores cumplan con el tipo de dato esperado, patrones regex o restricciones de longitud. Detecta errores de formato y valores mal tipados.', 'accuracy', '{"columns": [], "custom_patterns": {}, "auto_detect_types": true, "threshold": 0.95}'),
('logical_consistency', 'Valida reglas lógicas entre campos dentro de cada registro. Detecta inconsistencias como fechas de fin anteriores a fechas de inicio o valores mutuamente excluyentes.', 'consistency', '{"rules": []}'),
('class_balance', 'Mide el equilibrio en la distribución de variables categóricas. Detecta desbalances que pueden afectar modelos de clasificación.', 'distribution', '{"columns": [], "threshold": 0.8, "auto_detect": true}'),
('currentness', 'Evalúa la frescura y antigüedad de fechas. Detecta datos obsoletos o fuera del rango temporal esperado.', 'data_quality', '{"date_columns": [], "max_age_days": 365, "expected_range": null, "auto_detect": true}');

-- Insert demo user
INSERT INTO users (username, email, password_hash, first_name, last_name, organization, role)
VALUES ('demo', 'demo@example.com', '$2b$12$tPBUXAoX8vVQxU9DOiKOh.wPrLg4MR1jueKIGsM3NIHdUmwzKw5cO', 'Demo', 'User', 'Demo Organization', 'admin');
