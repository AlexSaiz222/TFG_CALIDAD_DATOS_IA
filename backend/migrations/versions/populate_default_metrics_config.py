"""Populate default metrics_config for existing projects

Revision ID: populate_default_metrics_config
Revises: add_sonar_lite_tables
Create Date: 2026-03-17 17:40:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
from sqlalchemy import String, Integer, JSON
import json

# revision identifiers, used by Alembic.
revision = 'populate_default_metrics_config'
down_revision = 'add_sonar_lite_tables'
branch_labels = None
depends_on = None

def upgrade():
    """
    Actualiza los proyectos existentes que tienen metrics_config vacío o NULL
    con las métricas por defecto.
    """
    # Definir métricas por defecto
    default_metrics = [
        {
            "id": "completeness",
            "parameters": {},
            "weight": 1.0
        },
        {
            "id": "uniqueness",
            "parameters": {},
            "weight": 1.0
        },
        {
            "id": "outliers",
            "parameters": {"method": "iqr", "factor": 1.5},
            "weight": 1.0
        }
    ]
    
    # Crear una tabla temporal para la actualización
    projects_table = table('projects',
        column('id', Integer),
        column('metrics_config', JSON)
    )
    
    # Obtener conexión
    connection = op.get_bind()
    
    # Actualizar proyectos con metrics_config NULL
    connection.execute(
        projects_table.update().
        where(projects_table.c.metrics_config == None).
        values(metrics_config=default_metrics)
    )
    
    # Actualizar proyectos con metrics_config vacío (array vacío)
    # Nota: Esto requiere SQL específico de PostgreSQL
    connection.execute(
        sa.text(
            "UPDATE projects SET metrics_config = :metrics "
            "WHERE metrics_config = '[]'::jsonb OR "
            "      (metrics_config IS NOT NULL AND jsonb_array_length(metrics_config) = 0)"
        ),
        {"metrics": json.dumps(default_metrics)}
    )
    
    print(f"✓ Proyectos actualizados con métricas por defecto: {default_metrics}")


def downgrade():
    """
    Revertir la actualización estableciendo metrics_config a array vacío
    para todos los proyectos que tienen las métricas por defecto.
    """
    # Crear una tabla temporal para la actualización
    projects_table = table('projects',
        column('id', Integer),
        column('metrics_config', JSON)
    )
    
    # Obtener conexión
    connection = op.get_bind()
    
    # Revertir a array vacío
    connection.execute(
        projects_table.update().
        values(metrics_config=[])
    )
    
    print("✓ Métricas por defecto revertidas a array vacío")
