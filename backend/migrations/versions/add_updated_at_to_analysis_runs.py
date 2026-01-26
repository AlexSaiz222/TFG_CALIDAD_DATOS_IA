"""Add updated_at column to analysis_runs table

Revision ID: add_updated_at_analysis
Revises: add_sonar_lite_tables
Create Date: 2026-01-26 01:25:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_updated_at_analysis'
down_revision = 'add_sonar_lite_tables'
branch_labels = None
depends_on = None


def upgrade():
    # Añadir columna updated_at a analysis_runs
    op.add_column(
        'analysis_runs',
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.text('NOW()'))
    )


def downgrade():
    op.drop_column('analysis_runs', 'updated_at')
