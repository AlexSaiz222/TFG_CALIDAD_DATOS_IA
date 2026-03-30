"""Merge multiple migration heads

Revision ID: d762936f6042
Revises: 33ca8bafe2f5, add_dataset_versioning, fix_cascade_deletes, populate_default_metrics_config, remove_obsolete_translate
Create Date: 2026-03-29 23:35:03.634179

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd762936f6042'
down_revision = ('33ca8bafe2f5', 'add_dataset_versioning', 'fix_cascade_deletes', 'populate_default_metrics_config', 'remove_obsolete_translate')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
