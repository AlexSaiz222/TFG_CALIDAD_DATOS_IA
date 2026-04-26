"""Métrica de completitud: porcentaje de valores no nulos."""
import logging
from typing import Any

import pandas as pd

from utils.fingerprint_utils import generate_column_issue_fingerprint
from .base import BaseMetric, MetricResult

logger = logging.getLogger(__name__)


class CompletenessMetric(BaseMetric):
    log_prefix = "COMPLETENESS"

    def evaluate(self, df, parameters, dataset, evaluation_id, metrics_map):
        columns = parameters.get("columns", [])
        threshold = parameters.get("threshold", 0.95)
        null_patterns = parameters.get("null_patterns")

        df = self.apply_null_patterns(df, null_patterns, columns or None)

        if columns:
            values = [1 - df[c].isna().mean() for c in columns if c in df.columns]
            completeness = sum(values) / len(values) if values else 1.0
        else:
            completeness = float(1 - df.isna().mean().mean())

        issues = []

        if completeness < threshold:
            problem_columns = []
            cols_to_check = [c for c in columns if c in df.columns] if columns else list(df.columns)
            for col in cols_to_check:
                null_rate = float(df[col].isna().mean())
                if null_rate > (1 - threshold):
                    problem_columns.append({"column": col, "null_rate": null_rate})

            severity = self.calculate_dynamic_severity(completeness, threshold, higher_is_better=True)
            problem_col_names = [c["column"] for c in problem_columns]
            null_row_count = int(df[problem_col_names].isna().any(axis=1).sum()) if problem_col_names else 0
            issues.append({
                "evaluation_id": evaluation_id,
                "metric_id": metrics_map.get("completeness"),
                "severity": severity,
                "description": (
                    f"La completitud del dataset ({completeness:.2%}) está por debajo "
                    f"del umbral ({threshold:.2%})"
                ),
                "affected_columns": problem_columns,
                "affected_rows": {"count": null_row_count},
                "issue_type": "completeness",
                "actual_value": f"{completeness:.2%}",
                "fingerprint": generate_column_issue_fingerprint(
                    issue_type="completeness",
                    column_name="_dataset_",
                    threshold=threshold,
                ),
            })

        # Per-column issues: columns below the user-configured threshold
        cols_to_check = [c for c in columns if c in df.columns] if columns else list(df.columns)
        for col in cols_to_check:
            col_completeness = float(1 - df[col].isna().mean())
            if col_completeness < threshold:
                col_severity = self.calculate_dynamic_severity(
                    col_completeness, threshold, higher_is_better=True
                )
                null_count = int(df[col].isna().sum())
                issues.append({
                    "evaluation_id": evaluation_id,
                    "metric_id": metrics_map.get("completeness"),
                    "severity": col_severity,
                    "description": f"La columna '{col}' tiene baja completitud ({col_completeness:.2%})",
                    "affected_columns": [{"column": col, "null_rate": float(1 - col_completeness)}],
                    "affected_rows": {"count": null_count},
                    "issue_type": "completeness",
                    "actual_value": f"{col_completeness:.2%}",
                    "fingerprint": generate_column_issue_fingerprint(
                        issue_type="completeness", column_name=col
                    ),
                })

        logger.info(f"[{self.log_prefix}] score={completeness:.4f}")
        return MetricResult(
            metric_id="completeness",
            score=float(completeness),
            results={"completeness": completeness},
            issues=issues,
        )
