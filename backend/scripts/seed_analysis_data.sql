-- ============================================================
-- SEED DATA: Datos de prueba para Sonar-Lite
-- Ejecutar en DBeaver o psql
-- ============================================================

-- Primero verificamos qué proyectos y datasets existen
-- SELECT id, name FROM projects;
-- SELECT id, name, project_id FROM datasets;

-- ============================================================
-- LIMPIAR DATOS ANTERIORES (opcional - descomentar si necesario)
-- ============================================================
-- DELETE FROM data_quality_issues;
-- DELETE FROM analysis_runs;

-- ============================================================
-- INSERTAR ANALYSIS RUNS DE PRUEBA
-- Ajusta project_id y dataset_id según tus datos existentes
-- ============================================================

-- Obtener el primer proyecto y dataset disponibles
DO $$
DECLARE
    v_project_id INTEGER;
    v_dataset_id INTEGER;
    v_run_id INTEGER;
    v_base_date TIMESTAMP;
    v_run_date TIMESTAMP;
    v_quality_score DECIMAL;
    v_gate_status VARCHAR(20);
    v_total_issues INTEGER;
    v_critical_issues INTEGER;
    v_new_issues INTEGER;
    v_fixed_issues INTEGER;
    v_baseline_id INTEGER;
    i INTEGER;
BEGIN
    -- Obtener primer proyecto
    SELECT id INTO v_project_id FROM projects LIMIT 1;
    
    IF v_project_id IS NULL THEN
        RAISE NOTICE 'No hay proyectos en la base de datos. Crea un proyecto primero.';
        RETURN;
    END IF;
    
    -- Obtener primer dataset del proyecto
    SELECT id INTO v_dataset_id FROM datasets WHERE project_id = v_project_id LIMIT 1;
    
    IF v_dataset_id IS NULL THEN
        RAISE NOTICE 'El proyecto % no tiene datasets. Crea un dataset primero.', v_project_id;
        RETURN;
    END IF;
    
    RAISE NOTICE 'Creando datos para proyecto % con dataset %', v_project_id, v_dataset_id;
    
    -- Verificar si ya existen análisis para este proyecto
    IF EXISTS (SELECT 1 FROM analysis_runs WHERE project_id = v_project_id) THEN
        RAISE NOTICE 'El proyecto ya tiene análisis. Saltando...';
        RETURN;
    END IF;
    
    v_base_date := NOW() - INTERVAL '42 days';
    v_baseline_id := NULL;
    
    -- Crear 6 análisis con evolución temporal
    FOR i IN 1..6 LOOP
        v_run_date := v_base_date + (i * INTERVAL '7 days');
        
        -- Simular mejora gradual del score (60-90%)
        v_quality_score := 60 + (i * 5) + (RANDOM() * 5);
        IF v_quality_score > 95 THEN v_quality_score := 95; END IF;
        
        -- Determinar Quality Gate status
        IF v_quality_score >= 80 THEN
            v_gate_status := 'PASSED';
        ELSIF v_quality_score >= 60 THEN
            v_gate_status := 'WARNING';
        ELSE
            v_gate_status := 'FAILED';
        END IF;
        
        -- Issues decrecen con el tiempo
        v_total_issues := 25 - (i * 3) + FLOOR(RANDOM() * 5);
        IF v_total_issues < 5 THEN v_total_issues := 5; END IF;
        
        v_critical_issues := FLOOR(v_total_issues * 0.1);
        v_new_issues := FLOOR(v_total_issues * 0.3);
        v_fixed_issues := CASE WHEN i > 1 THEN FLOOR(RANDOM() * 5) ELSE 0 END;
        
        -- Insertar AnalysisRun
        INSERT INTO analysis_runs (
            project_id, dataset_id, status, quality_gate_status, quality_score,
            total_issues_count, critical_issues_count, new_issues_count, fixed_issues_count,
            baseline_analysis_id, progress, current_step,
            created_at, started_at, completed_at, updated_at,
            metrics_config, results
        ) VALUES (
            v_project_id, v_dataset_id, 'COMPLETED', v_gate_status, v_quality_score,
            v_total_issues, v_critical_issues, v_new_issues, v_fixed_issues,
            v_baseline_id, 100, 'Análisis completado',
            v_run_date, v_run_date, v_run_date + INTERVAL '3 minutes', v_run_date,
            '{"metrics": [{"id": "completeness"}, {"id": "uniqueness"}]}'::jsonb,
            ('{"overall": {"quality_score": ' || v_quality_score || '}}')::jsonb
        ) RETURNING id INTO v_run_id;
        
        RAISE NOTICE 'Run %: ID=%, Score=%, Gate=%', i, v_run_id, ROUND(v_quality_score::numeric, 1), v_gate_status;
        
        -- Guardar como baseline para el siguiente
        v_baseline_id := v_run_id;
        
        -- Insertar Issues para este run
        INSERT INTO data_quality_issues (analysis_run_id, fingerprint, issue_type, severity, description, affected_columns, affected_row_count, is_new, rule_key, created_at)
        SELECT 
            v_run_id,
            MD5(v_run_id::text || n::text || 'completeness'),
            'completeness',
            CASE WHEN n <= v_critical_issues THEN 'critical' 
                 WHEN n <= v_critical_issues + 3 THEN 'major'
                 WHEN n <= v_critical_issues + 6 THEN 'minor'
                 ELSE 'info' END,
            'Columna "col_' || n || '" tiene ' || (5 + n * 2) || '% de valores nulos',
            ('[{"column": "col_' || n || '", "null_rate": ' || ((5 + n * 2) / 100.0) || '}]')::jsonb,
            100 + n * 50,
            CASE WHEN RANDOM() > 0.6 THEN true ELSE false END,
            'completeness_check',
            v_run_date
        FROM generate_series(1, LEAST(v_total_issues / 2, 10)) AS n;
        
        INSERT INTO data_quality_issues (analysis_run_id, fingerprint, issue_type, severity, description, affected_columns, affected_row_count, is_new, rule_key, created_at)
        SELECT 
            v_run_id,
            MD5(v_run_id::text || n::text || 'uniqueness'),
            'uniqueness',
            CASE WHEN n = 1 THEN 'major' ELSE 'minor' END,
            'Se encontraron ' || (10 + n * 5) || ' valores duplicados en "col_' || n || '"',
            ('["col_' || n || '"]')::jsonb,
            10 + n * 5,
            CASE WHEN RANDOM() > 0.5 THEN true ELSE false END,
            'uniqueness_check',
            v_run_date
        FROM generate_series(1, LEAST(v_total_issues / 2, 8)) AS n;
        
    END LOOP;
    
    RAISE NOTICE '✅ Seed completado: 6 análisis con issues creados para proyecto %', v_project_id;
END $$;

-- ============================================================
-- VERIFICAR DATOS CREADOS
-- ============================================================
SELECT 
    ar.id,
    ar.project_id,
    ar.status,
    ar.quality_gate_status,
    ROUND(ar.quality_score::numeric, 1) as score,
    ar.total_issues_count,
    ar.new_issues_count,
    ar.fixed_issues_count,
    ar.created_at::date as fecha
FROM analysis_runs ar
ORDER BY ar.created_at DESC
LIMIT 10;

SELECT 
    COUNT(*) as total_issues,
    issue_type,
    severity
FROM data_quality_issues
GROUP BY issue_type, severity
ORDER BY issue_type, severity;
