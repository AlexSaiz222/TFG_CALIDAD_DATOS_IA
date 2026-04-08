"""Rename metric 'currentness' to 'currentness' (ISO/IEC 5259-2 Cur-ML-1)

currentness (ΔT₁) and Currentness (ΔT₂) are distinct concepts in the standard.
What the system actually measures is Currentness: how old the most recent record
is relative to today. currentness would require external event timestamps.

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
        WHERE name = 'currentness'
    """))

    # Update issue_type in existing issue tables
    conn.execute(sa.text("""
        UPDATE data_quality_issues
        SET issue_type = 'currentness'
        WHERE issue_type = 'currentness'
    """))
    conn.execute(sa.text("""
        UPDATE issues
        SET issue_type = 'currentness'
        WHERE issue_type = 'currentness'
    """))

    # Update metrics_config JSON array in projects: replace id='currentness' with id='currentness'
    # metrics_config is a JSON array of {id, parameters, weight} objects
    conn.execute(sa.text("""
        UPDATE projects
        SET metrics_config = (
            SELECT json_agg(
                CASE
                    WHEN elem->>'id' = 'currentness'
                    THEN jsonb_set(elem::jsonb, '{id}', '"currentness"')::json
                    ELSE elem
                END
            )
            FROM json_array_elements(metrics_config) elem
        )
        WHERE metrics_config::text LIKE '%currentness%'
    """))

    print("✓ Renamed metric 'currentness' → 'currentness' (ISO 5259-2 Cur-ML-1)")


def downgrade():
    conn = op.get_bind()

    conn.execute(sa.text("""
        UPDATE metrics
        SET name = 'currentness',
            description = 'Evalúa la frescura y antigüedad de fechas. Detecta datos obsoletos o fuera del rango temporal esperado.'
        WHERE name = 'currentness'
    """))

    conn.execute(sa.text("""
        UPDATE data_quality_issues
        SET issue_type = 'currentness'
        WHERE issue_type = 'currentness'
    """))
    conn.execute(sa.text("""
        UPDATE issues
        SET issue_type = 'currentness'
        WHERE issue_type = 'currentness'
    """))

    conn.execute(sa.text("""
        UPDATE projects
        SET metrics_config = (
            SELECT json_agg(
                CASE
                    WHEN elem->>'id' = 'currentness'
                    THEN jsonb_set(elem::jsonb, '{id}', '"currentness"')::json
                    ELSE elem
                END
            )
            FROM json_array_elements(metrics_config) elem
        )
        WHERE metrics_config::text LIKE '%currentness%'
    """))
