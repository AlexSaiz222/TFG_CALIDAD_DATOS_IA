"""Add Sonar-Lite tables: analysis_runs, quality_gates, data_quality_issues

Revision ID: add_sonar_lite_tables
Revises: add_metrics_config_to_projects
Create Date: 2026-01-26 00:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_sonar_lite_tables'
down_revision = 'add_metrics_config_to_projects'
branch_labels = None
depends_on = None


def upgrade():
    # Crear enum types para PostgreSQL
    analysis_status_enum = sa.Enum(
        'PENDING', 'RUNNING', 'COMPLETED', 'FAILED',
        name='analysisstatus'
    )
    quality_gate_status_enum = sa.Enum(
        'PASSED', 'FAILED', 'WARNING',
        name='qualitygatestatus'
    )
    
    # Crear tabla analysis_runs
    op.create_table(
        'analysis_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('dataset_id', sa.Integer(), nullable=True),
        sa.Column('status', analysis_status_enum, nullable=False, server_default='PENDING'),
        sa.Column('quality_gate_status', quality_gate_status_enum, nullable=True),
        sa.Column('quality_score', sa.Float(), nullable=True),
        sa.Column('critical_issues_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('total_issues_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('baseline_analysis_id', sa.Integer(), nullable=True),
        sa.Column('new_issues_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('fixed_issues_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('metrics_config', sa.JSON(), nullable=True),
        sa.Column('results', sa.JSON(), nullable=True),
        sa.Column('task_id', sa.String(length=100), nullable=True),
        sa.Column('progress', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('current_step', sa.String(length=255), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.text('NOW()')),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['baseline_analysis_id'], ['analysis_runs.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Crear índices para analysis_runs
    op.create_index('ix_analysis_runs_project_id', 'analysis_runs', ['project_id'])
    op.create_index('ix_analysis_runs_dataset_id', 'analysis_runs', ['dataset_id'])
    op.create_index('ix_analysis_runs_status', 'analysis_runs', ['status'])
    op.create_index('ix_analysis_runs_created_at', 'analysis_runs', ['created_at'])
    
    # Crear tabla quality_gates
    op.create_table(
        'quality_gates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=True, server_default='Default Quality Gate'),
        sa.Column('thresholds', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id', name='uq_quality_gates_project_id')
    )
    
    # Crear tabla data_quality_issues
    op.create_table(
        'data_quality_issues',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('analysis_run_id', sa.Integer(), nullable=False),
        sa.Column('metric_id', sa.Integer(), nullable=True),
        sa.Column('fingerprint', sa.String(length=64), nullable=True),
        sa.Column('issue_type', sa.String(length=100), nullable=False),
        sa.Column('severity', sa.String(length=50), nullable=False, server_default='minor'),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('affected_columns', sa.JSON(), nullable=True),
        sa.Column('affected_rows', sa.JSON(), nullable=True),
        sa.Column('affected_row_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('is_new', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('rule_key', sa.String(length=100), nullable=True),
        sa.Column('actual_value', sa.String(length=255), nullable=True),
        sa.Column('expected_value', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['analysis_run_id'], ['analysis_runs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['metric_id'], ['metrics.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Crear índices para data_quality_issues
    op.create_index('ix_data_quality_issues_analysis_run_id', 'data_quality_issues', ['analysis_run_id'])
    op.create_index('ix_data_quality_issues_fingerprint', 'data_quality_issues', ['fingerprint'])
    op.create_index('ix_data_quality_issues_severity', 'data_quality_issues', ['severity'])
    op.create_index('ix_data_quality_issues_is_new', 'data_quality_issues', ['is_new'])


def downgrade():
    # Eliminar índices de data_quality_issues
    op.drop_index('ix_data_quality_issues_is_new', table_name='data_quality_issues')
    op.drop_index('ix_data_quality_issues_severity', table_name='data_quality_issues')
    op.drop_index('ix_data_quality_issues_fingerprint', table_name='data_quality_issues')
    op.drop_index('ix_data_quality_issues_analysis_run_id', table_name='data_quality_issues')
    
    # Eliminar tabla data_quality_issues
    op.drop_table('data_quality_issues')
    
    # Eliminar tabla quality_gates
    op.drop_table('quality_gates')
    
    # Eliminar índices de analysis_runs
    op.drop_index('ix_analysis_runs_created_at', table_name='analysis_runs')
    op.drop_index('ix_analysis_runs_status', table_name='analysis_runs')
    op.drop_index('ix_analysis_runs_dataset_id', table_name='analysis_runs')
    op.drop_index('ix_analysis_runs_project_id', table_name='analysis_runs')
    
    # Eliminar tabla analysis_runs
    op.drop_table('analysis_runs')
    
    # Eliminar enum types
    sa.Enum(name='qualitygatestatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='analysisstatus').drop(op.get_bind(), checkfirst=True)
