"""Fix cascade deletes for project relationships

Revision ID: fix_cascade_deletes
Revises: add_updated_at_to_analysis_runs
Create Date: 2026-03-17 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fix_cascade_deletes'
down_revision = 'add_updated_at_to_analysis_runs'
branch_labels = None
depends_on = None


def upgrade():
    # Drop and recreate foreign key constraints with CASCADE for datasets table
    op.drop_constraint('datasets_project_id_fkey', 'datasets', type_='foreignkey')
    op.create_foreign_key(
        'datasets_project_id_fkey',
        'datasets', 'projects',
        ['project_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # Drop and recreate foreign key constraints with CASCADE for evaluations table
    op.drop_constraint('evaluations_dataset_id_fkey', 'evaluations', type_='foreignkey')
    op.create_foreign_key(
        'evaluations_dataset_id_fkey',
        'evaluations', 'datasets',
        ['dataset_id'], ['id'],
        ondelete='CASCADE'
    )


def downgrade():
    # Revert to original foreign key constraints without CASCADE
    op.drop_constraint('evaluations_dataset_id_fkey', 'evaluations', type_='foreignkey')
    op.create_foreign_key(
        'evaluations_dataset_id_fkey',
        'evaluations', 'datasets',
        ['dataset_id'], ['id']
    )
    
    op.drop_constraint('datasets_project_id_fkey', 'datasets', type_='foreignkey')
    op.create_foreign_key(
        'datasets_project_id_fkey',
        'datasets', 'projects',
        ['project_id'], ['id']
    )
