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
        uniqueness_threshold = parameters.get("threshold", 1.0)

        issues = []
        column_variability_issues = []
        id_variability_ratios: list[float] = []

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
            col_type = self.infer_column_type(df[col], col)

            # Track ID columns variability for score contribution
            if col_type == "ID":
                id_variability_ratios.append(
                    min(1.0, col_variability / threshold) if threshold > 0 else 1.0
                )

            if col_variability < threshold and len(df) > 10:
                column_variability_issues.append({
                    "column": col,
                    "variability": float(col_variability),
                    "unique_values": num_unique,
                    "non_null_count": non_null_count,
                    "threshold_used": float(threshold),
                    "column_type": col_type,
                })

        results = {"uniqueness": row_uniqueness, "row_uniqueness": row_uniqueness}
        if column_variability_issues:
            results["column_variability_avg"] = sum(
                c["variability"] for c in column_variability_issues
            ) / len(column_variability_issues)

        # 3. Issues: column variability
        for col_issue in column_variability_issues:
            severity = self._variability_severity(
                col_issue["variability"], col_issue["threshold_used"], col_issue["column_type"]
            )
            issues.append({
                "evaluation_id": evaluation_id,
                "metric_id": metrics_map.get("uniqueness"),
                "severity": severity,
                "description": (
                    f"Baja variabilidad en columna {col_issue['column_type']} "
                    f"'{col_issue['column']}' ({col_issue['variability']:.2%} valores únicos)"
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
                        f"El dataset contiene {duplicate_count} filas duplicadas "
                        f"({(1 - row_uniqueness):.2%} del total)"
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
                        f"La columna '{col}' se esperaba única pero contiene "
                        f"{duplicate_count} valores duplicados ({col_uniqueness:.2%} únicos)"
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

        # Combined score: row uniqueness + ID columns health (if any)
        if id_variability_ratios:
            id_health = sum(id_variability_ratios) / len(id_variability_ratios)
            uniqueness_score = 0.7 * row_uniqueness + 0.3 * id_health
        else:
            uniqueness_score = row_uniqueness

        logger.info(
            f"[{self.log_prefix}] row_uniqueness={row_uniqueness:.4f}, "
            f"id_cols={len(id_variability_ratios)}, score={uniqueness_score:.4f}"
        )
        return MetricResult(
            metric_id="uniqueness",
            score=float(uniqueness_score),
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

    def _variability_severity(self, variability: float, threshold: float, col_type: str) -> str:
        """Severity for low-variability issues.

        ID columns use the standard absolute scale (a near-constant ID is
        always critical). Categorical and text columns use a *relative* gap
        to avoid flagging legitimate repetition as critical: having 3.5% unique
        values in a 200-row department column is expected, not catastrophic.

        Relative gap = (threshold - variability) / threshold:
          >= 50% below threshold → high
          >= 20% below threshold → medium
          <  20% below threshold → low
        """
        if col_type == "ID":
            return self.calculate_dynamic_severity(
                variability, threshold, higher_is_better=True
            )
        if threshold <= 0:
            return "low"
        relative_gap = (threshold - variability) / threshold
        if relative_gap >= 0.50:
            return "high"
        if relative_gap >= 0.20:
            return "medium"
        return "low"
