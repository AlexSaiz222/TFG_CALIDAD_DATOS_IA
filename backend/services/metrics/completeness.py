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
        weight = parameters.get("weight", 1.0)

        if columns:
            values = [1 - df[c].isna().mean() for c in columns if c in df.columns]
            completeness = sum(values) / len(values) if values else 1.0
        else:
            completeness = float(1 - df.isna().mean().mean())

        issues = []

        if completeness < threshold:
            problem_columns = []
            for col in df.columns:
                null_rate = float(df[col].isna().mean())
                if null_rate > (1 - threshold):
                    problem_columns.append({"column": col, "null_rate": null_rate})

            severity = self.calculate_dynamic_severity(completeness, threshold, higher_is_better=True)
            issues.append({
                "evaluation_id": evaluation_id,
                "metric_id": metrics_map.get("completeness"),
                "severity": severity,
                "description": (
                    f"La completitud del dataset ({completeness:.2%}) está por debajo "
                    f"del umbral ({threshold:.2%})"
                ),
                "affected_columns": problem_columns,
                "issue_type": "completeness",
                "fingerprint": generate_column_issue_fingerprint(
                    issue_type="completeness",
                    column_name="_dataset_",
                    threshold=threshold,
                ),
            })

        # Per-column issues for columns below 98 %
        for col in df.columns:
            col_completeness = float(1 - df[col].isna().mean())
            if col_completeness < 0.98:
                col_severity = self.calculate_dynamic_severity(
                    col_completeness, 0.98, higher_is_better=True
                )
                issues.append({
                    "evaluation_id": evaluation_id,
                    "metric_id": metrics_map.get("completeness"),
                    "severity": col_severity,
                    "description": f"La columna '{col}' tiene baja completitud ({col_completeness:.2%})",
                    "affected_columns": [{"column": col, "null_rate": float(1 - col_completeness)}],
                    "issue_type": "completeness",
                    "fingerprint": generate_column_issue_fingerprint(
                        issue_type="completeness", column_name=col
                    ),
                })

        logger.info(f"[{self.log_prefix}] score={completeness:.4f}")
        return MetricResult(
            metric_id="completeness",
            score=completeness * weight,
            results={"completeness": completeness},
            issues=issues,
        )
