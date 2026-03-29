"""Métrica de outliers: detección de valores atípicos en columnas numéricas."""
import logging

import numpy as np
import pandas as pd

from utils.fingerprint_utils import generate_outlier_issue_fingerprint
from .base import BaseMetric, MetricResult

logger = logging.getLogger(__name__)


class OutliersMetric(BaseMetric):
    log_prefix = "OUTLIERS"

    def evaluate(self, df, parameters, dataset, evaluation_id, metrics_map):
        weight = parameters.get("weight", 1.0)
        columns = parameters.get("columns", [])
        method = parameters.get("method", "iqr")
        factor = parameters.get("factor", 1.5)

        if not columns:
            columns = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]

        outlier_results = {}
        issues = []

        for col in columns:
            if col not in df.columns or not pd.api.types.is_numeric_dtype(df[col]):
                continue

            outliers = self._detect_outliers(df[col], method, factor)

            if outliers["count"] > 0 and col in (dataset.sensitive_columns or []):
                outliers["sample_values"] = ["***" for _ in outliers.get("sample_values", [])]
                for key in ["series_min", "series_max", "median", "mean",
                            "lower_bound", "upper_bound", "q1", "q3", "iqr",
                            "z_threshold", "std"]:
                    outliers.pop(key, None)

            outlier_results[col] = outliers

            if outliers["count"] > 0:
                non_null = len(df[col].dropna())
                proportion = outliers["count"] / non_null if non_null > 0 else 0
                severity = self.calculate_dynamic_severity(
                    proportion, 0.0, metric_type="outliers", higher_is_better=False
                )
                issues.append({
                    "evaluation_id": evaluation_id,
                    "metric_id": metrics_map.get("outliers"),
                    "severity": severity,
                    "description": (
                        f"Column '{col}' contains {outliers['count']} outliers "
                        f"({proportion:.1%} of values)"
                    ),
                    "affected_columns": [{
                        "column": col,
                        "outlier_count": outliers["count"],
                        "outlier_proportion": float(proportion),
                    }],
                    "issue_type": "outliers",
                    "fingerprint": generate_outlier_issue_fingerprint(
                        column_name=col, method=method, factor=factor
                    ),
                })

        # Score: penalización 3× por ratio de outliers
        cols_with_outliers = {c: d for c, d in outlier_results.items() if d["count"] > 0}
        if cols_with_outliers:
            col_scores = []
            for col, data in cols_with_outliers.items():
                non_null = len(df[col].dropna())
                ratio = data["count"] / non_null if non_null > 0 else 0
                col_scores.append(max(0.0, 1 - ratio * 3))
            score = sum(col_scores) / len(col_scores)
        else:
            score = 1.0

        logger.info(
            f"[{self.log_prefix}] checked={len(outlier_results)} cols, "
            f"score={score:.4f}"
        )
        return MetricResult(
            metric_id="outliers",
            score=score * weight,
            results={"outliers": outlier_results},
            issues=issues,
        )

    @staticmethod
    def _detect_outliers(series: pd.Series, method: str = "iqr", factor: float = 1.5) -> dict:
        series = series.dropna()
        if len(series) == 0:
            return {"count": 0, "indices": []}

        if method == "iqr":
            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)
            iqr = q3 - q1
            lower = q1 - factor * iqr
            upper = q3 + factor * iqr
            outliers = series[(series < lower) | (series > upper)]
            extra = {
                "lower_bound": float(lower), "upper_bound": float(upper),
                "q1": float(q1), "q3": float(q3), "iqr": float(iqr),
                "median": float(series.median()),
            }
        elif method == "zscore":
            mean = series.mean()
            std = series.std()
            z_scores = (series - mean) / std
            outliers = series[abs(z_scores) > factor]
            extra = {
                "mean": float(mean), "std": float(std), "z_threshold": float(factor),
            }
        else:
            raise ValueError(f"Unknown outlier method: {method}")

        result = {
            "count": len(outliers),
            "indices": list(outliers.index),
            "total_values": len(series),
            "proportion": len(outliers) / len(series),
            "method": method,
            "factor": factor,
            "sample_values": [float(v) for v in outliers.head(5).values],
            "series_min": float(series.min()),
            "series_max": float(series.max()),
            "mean": float(series.mean()),
        }
        result.update(extra)
        return result
