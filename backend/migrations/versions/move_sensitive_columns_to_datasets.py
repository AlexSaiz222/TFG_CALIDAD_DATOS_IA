"""Move sensitive_columns from projects to datasets

Revision ID: move_sensitive_to_datasets
Revises: add_templates_and_sensitive_columns
Create Date: 2024-03-25 14:10:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'move_sensitive_to_datasets'
down_revision = 'add_templates_and_sensitive_columns'
branch_labels = None
depends_on = None


def upgrade():
    # Add sensitive_columns to datasets table
    op.add_column('datasets', sa.Column('sensitive_columns', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    
    # Set default empty array for existing datasets
    op.execute("UPDATE datasets SET sensitive_columns = '[]'::json WHERE sensitive_columns IS NULL")
    
    # Remove sensitive_columns from projects table
    op.drop_column('projects', 'sensitive_columns')


def downgrade():
    # Add sensitive_columns back to projects table
    op.add_column('projects', sa.Column('sensitive_columns', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    
    # Set default empty array for existing projects
    op.execute("UPDATE projects SET sensitive_columns = '[]'::json WHERE sensitive_columns IS NULL")
    
    # Remove sensitive_columns from datasets table
    op.drop_column('datasets', 'sensitive_columns')
