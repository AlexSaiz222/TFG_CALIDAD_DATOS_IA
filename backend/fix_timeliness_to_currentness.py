"""
Script de reparación: renombra 'timeliness' → 'currentness' en datos existentes.

La migración rename_timeliness_to_currentness.py tenía un bug: usaba 'currentness'
en los WHERE en lugar de 'timeliness', por lo que no hacía nada. Este script
aplica la corrección directamente a los datos almacenados.

Ejecutar desde el directorio backend/:
    python fix_timeliness_to_currentness.py
"""
from app import create_app
from extensions import db
from sqlalchemy import text

app = create_app()

with app.app_context():
    print("Reparando referencias 'timeliness' -> 'currentness'...")

    # 1. Renombrar métrica en la tabla metrics
    result = db.session.execute(text("""
        UPDATE metrics
        SET name = 'currentness',
            description = 'Evalúa la frescura y antigüedad de fechas (Currentness, ISO 5259-2 Cur-ML-1). Detecta datos obsoletos o fuera del rango temporal esperado.'
        WHERE name = 'timeliness'
    """))
    print(f"  metrics: {result.rowcount} fila(s) actualizadas")

    # 2. Actualizar issue_type en issues
    result = db.session.execute(text("""
        UPDATE issues
        SET issue_type = 'currentness'
        WHERE issue_type = 'timeliness'
    """))
    print(f"  issues: {result.rowcount} fila(s) actualizadas")

    # 3. Actualizar issue_type en data_quality_issues (si existe)
    try:
        result = db.session.execute(text("""
            UPDATE data_quality_issues
            SET issue_type = 'currentness'
            WHERE issue_type = 'timeliness'
        """))
        print(f"  data_quality_issues: {result.rowcount} fila(s) actualizadas")
    except Exception:
        pass  # tabla puede no existir

    # 4. Actualizar metrics_config en proyectos (soporta formato {id:...} y {name:...})
    result = db.session.execute(text("""
        UPDATE projects
        SET metrics_config = (
            SELECT json_agg(
                CASE
                    WHEN elem->>'id' = 'timeliness'
                    THEN jsonb_set(elem::jsonb, '{id}', '"currentness"')::json
                    WHEN elem->>'name' = 'timeliness'
                    THEN jsonb_set(elem::jsonb, '{name}', '"currentness"')::json
                    ELSE elem
                END
            )
            FROM json_array_elements(metrics_config) elem
        )
        WHERE metrics_config IS NOT NULL
          AND metrics_config::text LIKE '%timeliness%'
    """))
    print(f"  projects.metrics_config: {result.rowcount} proyecto(s) actualizados")

    # 5. Actualizar templates de métricas
    result = db.session.execute(text("""
        UPDATE metric_templates
        SET metrics = (
            SELECT json_agg(
                CASE
                    WHEN elem->>'id' = 'timeliness'
                    THEN jsonb_set(elem::jsonb, '{id}', '"currentness"')::json
                    WHEN elem->>'name' = 'timeliness'
                    THEN jsonb_set(elem::jsonb, '{name}', '"currentness"')::json
                    ELSE elem
                END
            )
            FROM json_array_elements(metrics) elem
        )
        WHERE metrics IS NOT NULL
          AND metrics::text LIKE '%timeliness%'
    """))
    print(f"  metric_templates: {result.rowcount} plantilla(s) actualizadas")

    db.session.commit()
    print("\nReparacion completada.")
