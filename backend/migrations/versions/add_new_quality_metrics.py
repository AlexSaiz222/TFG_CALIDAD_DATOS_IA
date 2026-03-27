"""Add 4 new quality metrics: syntactic_accuracy, logical_consistency, class_balance, timeliness

Revision ID: add_new_quality_metrics
Revises: move_sensitive_to_datasets
Create Date: 2026-03-27 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime
import json

# revision identifiers, used by Alembic.
revision = 'add_new_quality_metrics'
down_revision = 'move_sensitive_to_datasets'
branch_labels = None
depends_on = None

# Metric definitions: (name, description, category, parameters)
METRICS = [
    (
        'syntactic_accuracy',
        'Validates that values conform to expected data types, regex patterns, or length constraints. Detects format violations like invalid emails, malformed dates, or incorrect ID formats.',
        'accuracy',
        {"auto_detect_types": True, "custom_patterns": {}, "columns": [], "threshold": 0.95},
    ),
    (
        'logical_consistency',
        'Validates cross-field logical rules within each record. Detects inconsistencies like a deceased patient with a future appointment or an end date before a start date.',
        'consistency',
        {"rules": []},
    ),
    (
        'class_balance',
        'Measures the distribution balance of categorical variables using Shannon entropy. Detects class imbalance that could bias ML models.',
        'distribution',
        {"columns": [], "auto_detect": True, "max_cardinality": 50, "imbalance_threshold_high": 0.90, "imbalance_threshold_low": 0.05},
    ),
    (
        'timeliness',
        'Measures data freshness and recency by analyzing date columns. Detects stale data that may no longer be relevant for analysis or model training.',
        'timeliness',
        {"columns": [], "auto_detect": True, "staleness_threshold_days": 30},
    ),
]


def upgrade():
    """Insert or update 4 quality metrics (idempotent)."""
    connection = op.get_bind()
    now = datetime.utcnow()

    for name, description, category, parameters in METRICS:
        # Check if metric already exists
        result = connection.execute(
            sa.text("SELECT id FROM metrics WHERE name = :name"),
            {"name": name}
        )
        existing = result.fetchone()

        if existing:
            # Update existing metric with new parameters and description
            connection.execute(
                sa.text(
                    "UPDATE metrics SET description = :desc, category = :cat, "
                    "parameters = :params, updated_at = :now WHERE name = :name"
                ),
                {"desc": description, "cat": category, "params": json.dumps(parameters), "now": now, "name": name}
            )
            print(f"  ✓ Updated existing metric: {name}")
        else:
            # Insert new metric
            connection.execute(
                sa.text(
                    "INSERT INTO metrics (name, description, category, parameters, created_at, updated_at) "
                    "VALUES (:name, :desc, :cat, :params, :now, :now)"
                ),
                {"name": name, "desc": description, "cat": category, "params": json.dumps(parameters), "now": now}
            )
            print(f"  ✓ Inserted new metric: {name}")

    print("✓ 4 quality metrics ready: syntactic_accuracy, logical_consistency, class_balance, timeliness")


def downgrade():
    """Remove only the metrics that were newly inserted (not pre-existing ones)."""
    connection = op.get_bind()
    connection.execute(
        sa.text(
            "DELETE FROM metrics WHERE name IN ('syntactic_accuracy', 'logical_consistency')"
        )
    )
    # Revert class_balance and timeliness to their original placeholder state
    connection.execute(
        sa.text(
            "UPDATE metrics SET category = 'ml_specific', parameters = :cb_params, "
            "description = NULL WHERE name = 'class_balance'"
        ),
        {"cb_params": json.dumps({"threshold": 0.8})}
    )
    connection.execute(
        sa.text(
            "UPDATE metrics SET category = 'data_quality', parameters = :t_params, "
            "description = NULL WHERE name = 'timeliness'"
        ),
        {"t_params": json.dumps({"threshold": 0.8})}
    )
    print("✓ Quality metrics reverted")
