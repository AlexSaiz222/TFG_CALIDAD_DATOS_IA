"""Métrica de unicidad: filas duplicadas y variabilidad por columna."""
import json
import logging

import pandas as pd

from utils.fingerprint_utils import (
    generate_duplicate_issue_fingerprint,
    generate_issue_fingerprint,
)
from .base import BaseMetric, MetricResult

logger = logging.getLogger(__name__)


class UniquenessMetric(BaseMetric):
    log_prefix = "UNIQUENESS"

    def evaluate(self, df, parameters, dataset, evaluation_id, metrics_map):
        weight = parameters.get("weight", 1.0)
        uniqueness_threshold = parameters.get("threshold", 1.0)

        issues = []
        column_variability_issues = []

        # 1. Row-level uniqueness
        row_uniqueness = float(len(df.drop_duplicates()) / len(df)) if len(df) > 0 else 1.0

        # 2. Column-level variability
        for col in df.columns:
            non_null_count = int(df[col].notna().sum())
            if non_null_count == 0:
                continue
            num_unique = int(df[col].nunique(dropna=True))
            col_variability = num_unique / non_null_count
            threshold = self._adaptive_variability_threshold(df[col], col)
            if col_variability < threshold and len(df) > 10:
                column_variability_issues.append({
                    "column": col,
                    "variability": float(col_variability),
                    "unique_values": num_unique,
                    "non_null_count": non_null_count,
                    "threshold_used": float(threshold),
                    "column_type": self.infer_column_type(df[col], col),
                })

        results = {"uniqueness": row_uniqueness, "row_uniqueness": row_uniqueness}
        if column_variability_issues:
            results["column_variability_avg"] = sum(
                c["variability"] for c in column_variability_issues
            ) / len(column_variability_issues)

        # 3. Issues: column variability
        for col_issue in column_variability_issues:
            severity = self.calculate_dynamic_severity(
                col_issue["variability"], col_issue["threshold_used"], higher_is_better=True
            )
            issues.append({
                "evaluation_id": evaluation_id,
                "metric_id": metrics_map.get("uniqueness"),
                "severity": severity,
                "description": (
                    f"Low variability in {col_issue['column_type']} column "
                    f"'{col_issue['column']}' ({col_issue['variability']:.2%} unique values)"
                ),
                "affected_columns": [col_issue],
                "issue_type": "low_variability",
                "fingerprint": generate_issue_fingerprint(
                    issue_type="low_variability",
                    column_name=col_issue["column"],
                    rule_key="adaptive_threshold",
                    extra_params={"threshold": col_issue["threshold_used"]},
                ),
            })

        # 4. Issues: row duplicates
        if row_uniqueness < uniqueness_threshold:
            duplicates = df[df.duplicated(keep="first")]
            duplicate_count = len(duplicates)
            if duplicate_count > 0:
                severity = self.calculate_dynamic_severity(
                    row_uniqueness, uniqueness_threshold, higher_is_better=True
                )
                sample_data = json.loads(duplicates.head(5).to_json(orient="records"))
                for row in sample_data:
                    for sc in dataset.sensitive_columns or []:
                        if sc in row:
                            row[sc] = "***"
                issues.append({
                    "evaluation_id": evaluation_id,
                    "metric_id": metrics_map.get("uniqueness"),
                    "severity": severity,
                    "description": (
                        f"Dataset contains {duplicate_count} duplicate rows "
                        f"({(1 - row_uniqueness):.2%} of total)"
                    ),
                    "affected_rows": {"count": duplicate_count, "sample": sample_data},
                    "issue_type": "duplicate_rows",
                    "fingerprint": generate_duplicate_issue_fingerprint(is_row_level=True),
                })

        # 5. Issues: column-specific uniqueness (user-specified columns that must be unique)
        for col in parameters.get("columns", []):
            if col not in df.columns:
                continue
            non_null_count = int(df[col].notna().sum())
            if non_null_count == 0:
                continue
            num_unique = int(df[col].nunique(dropna=True))
            col_uniqueness = num_unique / non_null_count
            duplicate_count = non_null_count - num_unique
            if col_uniqueness < uniqueness_threshold and duplicate_count > 0:
                severity = self.calculate_dynamic_severity(
                    col_uniqueness, uniqueness_threshold, higher_is_better=True
                )
                issues.append({
                    "evaluation_id": evaluation_id,
                    "metric_id": metrics_map.get("uniqueness"),
                    "severity": severity,
                    "description": (
                        f"Column '{col}' expected to be unique but contains "
                        f"{duplicate_count} duplicate values ({col_uniqueness:.2%} unique)"
                    ),
                    "affected_columns": [{
                        "column": col,
                        "duplicate_count": duplicate_count,
                        "uniqueness": float(col_uniqueness),
                    }],
                    "issue_type": "non_unique_identifier",
                    "fingerprint": generate_issue_fingerprint(
                        issue_type="non_unique_identifier",
                        column_name=col,
                        rule_key="expected_unique",
                        extra_params={"threshold": uniqueness_threshold},
                    ),
                })

        logger.info(f"[{self.log_prefix}] row_uniqueness={row_uniqueness:.4f}")
        return MetricResult(
            metric_id="uniqueness",
            score=row_uniqueness * weight,
            results=results,
            issues=issues,
        )

    @staticmethod
    def _adaptive_variability_threshold(series: pd.Series, column_name: str) -> float:
        import re
        id_patterns = [r"_id$", r"^id$", r"_uuid$", r"^uuid$", r"_guid$", r"_key$"]
        if any(re.search(p, column_name.lower()) for p in id_patterns):
            return 0.95
        is_categorical = series.nunique() <= 20 and not pd.api.types.is_numeric_dtype(series)
        return 0.05 if is_categorical else 0.30
