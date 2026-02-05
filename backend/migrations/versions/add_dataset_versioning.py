"""Add dataset versioning columns

Revision ID: add_dataset_versioning
Revises: add_updated_at_to_analysis_runs
Create Date: 2026-02-05 17:30:00.000000

This migration adds versioning support to datasets:
- parent_dataset_id: Reference to the parent dataset (for version chains)
- version: Version number (1, 2, 3...)
- version_tag: Optional label (e.g., "v1.0", "corregido", "final")
- is_latest: Indicates if this is the latest version in the chain
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_dataset_versioning'
down_revision = 'add_updated_at_analysis'
branch_labels = None
depends_on = None


def upgrade():
    # Add versioning columns to datasets table
    op.add_column('datasets', sa.Column('parent_dataset_id', sa.Integer(), nullable=True))
    op.add_column('datasets', sa.Column('version', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('datasets', sa.Column('version_tag', sa.String(length=50), nullable=True))
    op.add_column('datasets', sa.Column('is_latest', sa.Boolean(), nullable=False, server_default='true'))
    
    # Create foreign key constraint for parent_dataset_id
    op.create_foreign_key(
        'fk_datasets_parent_dataset_id',
        'datasets', 'datasets',
        ['parent_dataset_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Create index for faster lookups of dataset versions
    op.create_index('ix_datasets_parent_dataset_id', 'datasets', ['parent_dataset_id'])
    op.create_index('ix_datasets_is_latest', 'datasets', ['is_latest'])


def downgrade():
    # Remove indexes
    op.drop_index('ix_datasets_is_latest', table_name='datasets')
    op.drop_index('ix_datasets_parent_dataset_id', table_name='datasets')
    
    # Remove foreign key constraint
    op.drop_constraint('fk_datasets_parent_dataset_id', 'datasets', type_='foreignkey')
    
    # Remove columns
    op.drop_column('datasets', 'is_latest')
    op.drop_column('datasets', 'version_tag')
    op.drop_column('datasets', 'version')
    op.drop_column('datasets', 'parent_dataset_id')
