"""Add sensitive_columns to projects and owner_id/is_system to metric_templates

Revision ID: add_templates_sensitive_cols
Revises: add_metrics_config_to_projects
Create Date: 2025-03-25 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_templates_sensitive_cols'
down_revision = 'add_metrics_config_to_projects'
branch_labels = None
depends_on = None


def upgrade():
    # Add sensitive_columns to projects table
    op.add_column('projects', sa.Column('sensitive_columns', sa.JSON(), nullable=True, server_default='[]'))

    # Add owner_id and is_system to metric_templates table
    op.add_column('metric_templates', sa.Column('owner_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))
    op.add_column('metric_templates', sa.Column('is_system', sa.Boolean(), nullable=True, server_default='false'))

    # Mark existing templates as system templates
    op.execute("UPDATE metric_templates SET is_system = true WHERE owner_id IS NULL")


def downgrade():
    op.drop_column('metric_templates', 'is_system')
    op.drop_column('metric_templates', 'owner_id')
    op.drop_column('projects', 'sensitive_columns')
