"""Rename metric 'timeliness' to 'currentness' (ISO/IEC 5259-2 Cur-ML-1)

currentness (ΔT₁) and Currentness (ΔT₂) are distinct concepts in the standard.
What the system actually measures is Currentness: how old the most recent record
is relative to today. Timeliness would require external event timestamps.

Revision ID: rename_currentness_to_currentness
Revises: remove_obsolete_translate
Create Date: 2026-04-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'rename_currentness_to_currentness'
down_revision = 'dd685e7e770a'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Rename the metric itself
    conn.execute(sa.text("""
        UPDATE metrics
        SET name = 'currentness',
            description = 'Evalúa la frescura y antigüedad de fechas (Currentness, ISO 5259-2 Cur-ML-1). Detecta datos obsoletos o fuera del rango temporal esperado.'
        WHERE name = 'timeliness'
    """))

    # Update issue_type in existing issue tables
    conn.execute(sa.text("""
        UPDATE data_quality_issues
        SET issue_type = 'currentness'
        WHERE issue_type = 'timeliness'
    """))
    conn.execute(sa.text("""
        UPDATE issues
        SET issue_type = 'currentness'
        WHERE issue_type = 'timeliness'
    """))

    # Update metrics_config JSON array in projects: replace id/name='timeliness' with 'currentness'
    # metrics_config is a JSON array of {id, parameters, weight} or {name, parameters} objects
    conn.execute(sa.text("""
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
        WHERE metrics_config::text LIKE '%timeliness%'
    """))

    # Update metric_templates JSON array too
    conn.execute(sa.text("""
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
        WHERE metrics::text LIKE '%timeliness%'
    """))

    print("✓ Renamed metric 'timeliness' → 'currentness' (ISO 5259-2 Cur-ML-1)")


def downgrade():
    conn = op.get_bind()

    conn.execute(sa.text("""
        UPDATE metrics
        SET name = 'timeliness',
            description = 'Evalúa la frescura y antigüedad de fechas. Detecta datos obsoletos o fuera del rango temporal esperado.'
        WHERE name = 'currentness'
    """))

    conn.execute(sa.text("""
        UPDATE data_quality_issues
        SET issue_type = 'timeliness'
        WHERE issue_type = 'currentness'
    """))
    conn.execute(sa.text("""
        UPDATE issues
        SET issue_type = 'timeliness'
        WHERE issue_type = 'currentness'
    """))

    conn.execute(sa.text("""
        UPDATE projects
        SET metrics_config = (
            SELECT json_agg(
                CASE
                    WHEN elem->>'id' = 'currentness'
                    THEN jsonb_set(elem::jsonb, '{id}', '"timeliness"')::json
                    WHEN elem->>'name' = 'currentness'
                    THEN jsonb_set(elem::jsonb, '{name}', '"timeliness"')::json
                    ELSE elem
                END
            )
            FROM json_array_elements(metrics_config) elem
        )
        WHERE metrics_config::text LIKE '%currentness%'
    """))

    conn.execute(sa.text("""
        UPDATE metric_templates
        SET metrics = (
            SELECT json_agg(
                CASE
                    WHEN elem->>'id' = 'currentness'
                    THEN jsonb_set(elem::jsonb, '{id}', '"timeliness"')::json
                    WHEN elem->>'name' = 'currentness'
                    THEN jsonb_set(elem::jsonb, '{name}', '"timeliness"')::json
                    ELSE elem
                END
            )
            FROM json_array_elements(metrics) elem
        )
        WHERE metrics::text LIKE '%currentness%'
    """))
