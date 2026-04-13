"""Add affected_rows_pct to data_quality_issues

Revision ID: add_affected_rows_pct
Revises: rename_currentness_to_currentness
Create Date: 2026-04-13
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_affected_rows_pct'
down_revision = 'rename_currentness_to_currentness'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('data_quality_issues',
                  sa.Column('affected_rows_pct', sa.Float(), nullable=True))


def downgrade():
    op.drop_column('data_quality_issues', 'affected_rows_pct')
