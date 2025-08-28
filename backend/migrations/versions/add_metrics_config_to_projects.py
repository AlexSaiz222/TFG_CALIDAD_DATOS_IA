"""Add metrics_config to projects table

Revision ID: add_metrics_config_to_projects
Revises: 
Create Date: 2025-08-28 19:47:05.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_metrics_config_to_projects'
down_revision = None  # Update this if there are previous migrations
branch_labels = None
depends_on = None


def upgrade():
    # Add metrics_config column to projects table
    op.add_column('projects', sa.Column('metrics_config', sa.JSON(), nullable=True, server_default='[]'))


def downgrade():
    # Remove metrics_config column from projects table
    op.drop_column('projects', 'metrics_config')
