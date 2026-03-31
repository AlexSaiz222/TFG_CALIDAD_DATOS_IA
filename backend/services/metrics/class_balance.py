"""Métrica de equilibrio de clases: distribución de variables categóricas."""
import logging

import numpy as np
import pandas as pd

from utils.fingerprint_utils import generate_class_balance_fingerprint
from .base import BaseMetric, MetricResult

logger = logging.getLogger(__name__)


class ClassBalanceMetric(BaseMetric):
    log_prefix = "CLASS_BALANCE"

    def evaluate(self, df, parameters, dataset, evaluation_id, metrics_map):
        weight = parameters.get("weight", 1.0)
        auto_detect = parameters.get("auto_detect", True)
        user_columns = parameters.get("columns", [])
        max_cardinality = parameters.get("max_cardinality", 50)
        threshold_high = parameters.get("imbalance_threshold_high", 0.90)
        threshold_low = parameters.get("imbalance_threshold_low", 0.05)

        target_columns = [c for c in user_columns if c in df.columns]

        if auto_detect:
            for col in df.columns:
                if col in target_columns:
                    continue
                n_unique = df[col].nunique(dropna=True)
                if n_unique <= 1:
                    continue
                if n_unique <= max_cardinality:
                    if df[col].dtype == "object" or str(df[col].dtype) == "category":
                        target_columns.append(col)
                    elif pd.api.types.is_integer_dtype(df[col]) and n_unique <= 20:
                        target_columns.append(col)

        balance_results = {}
        balance_scores = []
        issues = []

        for col in target_columns:
            non_null = df[col].dropna()
            if len(non_null) == 0:
                continue

            value_counts = non_null.value_counts(normalize=True)
            n_classes = len(value_counts)

            if n_classes <= 1:
                balance_index, entropy_val, max_entropy = 0.0, 0.0, 0.0
            else:
                probs = value_counts.values
                entropy_val = float(-np.sum(probs * np.log2(probs + 1e-12)))
                max_entropy = float(np.log2(n_classes))
                balance_index = float((entropy_val / max_entropy) * 100) if max_entropy > 0 else 100.0

            balance_scores.append(balance_index / 100.0)

            abs_counts = non_null.value_counts()
            freq_table = {}
            for i, (val, count) in enumerate(abs_counts.items()):
                if i < 20:
                    freq_table[str(val)] = {
                        "count": int(count),
                        "proportion": float(value_counts.iloc[i]),
                    }
                else:
                    freq_table["__others__"] = {
                        "count": int(abs_counts.iloc[20:].sum()),
                        "proportion": float(value_counts.iloc[20:].sum()),
                        "num_classes": n_classes - 20,
                    }
                    break

            dominant_class = str(value_counts.index[0])
            dominant_prop = float(value_counts.iloc[0])
            minority_class = str(value_counts.index[-1])
            minority_prop = float(value_counts.iloc[-1])

            sensitive = col in (dataset.sensitive_columns or [])
            if sensitive:
                dominant_class = minority_class = "***"
                freq_table = {"***": {"count": len(non_null), "proportion": 1.0}}

            alerts = []
            if dominant_prop >= threshold_high:
                lbl = "***" if sensitive else dominant_class
                alerts.append(f"Clase dominante '{lbl}' ocupa {dominant_prop:.1%} del total")
            if minority_prop <= threshold_low and n_classes > 1:
                lbl = "***" if sensitive else minority_class
                alerts.append(f"Clase minoritaria '{lbl}' solo ocupa {minority_prop:.2%} del total")

            balance_results[col] = {
                "balance_index": round(balance_index, 2),
                "entropy": round(entropy_val, 4),
                "max_entropy": round(max_entropy, 4),
                "num_classes": n_classes,
                "total_values": len(non_null),
                "frequency_table": freq_table,
                "dominant_class": {"value": dominant_class, "proportion": round(dominant_prop, 4)},
                "minority_class": {"value": minority_class, "proportion": round(minority_prop, 4)},
                "alerts": alerts,
            }

            if dominant_prop >= threshold_high:
                severity = self.calculate_dynamic_severity(
                    dominant_prop, 0.0, metric_type="class_balance"
                )
                issues.append({
                    "evaluation_id": evaluation_id,
                    "metric_id": metrics_map.get("class_balance"),
                    "severity": severity,
                    "description": (
                        f"La columna '{col}' está muy desequilibrada: la clase dominante "
                        f"'{dominant_class}' representa el {dominant_prop:.1%} de los valores "
                        f"(índice de equilibrio: {balance_index:.1f}/100)"
                    ),
                    "affected_columns": [{
                        "column": col,
                        "dominant_class": dominant_class,
                        "dominant_proportion": round(dominant_prop, 4),
                        "balance_index": round(balance_index, 2),
                    }],
                    "issue_type": "class_balance",
                    "fingerprint": generate_class_balance_fingerprint(
                        column_name=col, imbalance_type="dominant_class"
                    ),
                })

            if minority_prop <= threshold_low and n_classes > 1:
                issues.append({
                    "evaluation_id": evaluation_id,
                    "metric_id": metrics_map.get("class_balance"),
                    "severity": "medium" if minority_prop < 0.02 else "low",
                    "description": (
                        f"La columna '{col}' tiene una clase minoritaria subrepresentada "
                        f"'{minority_class}' con {minority_prop:.2%} de los valores"
                    ),
                    "affected_columns": [{
                        "column": col,
                        "minority_class": minority_class,
                        "minority_proportion": round(minority_prop, 4),
                        "balance_index": round(balance_index, 2),
                    }],
                    "issue_type": "class_balance",
                    "fingerprint": generate_class_balance_fingerprint(
                        column_name=col, imbalance_type="minority_class"
                    ),
                })

        overall = sum(balance_scores) / len(balance_scores) if balance_scores else 1.0

        logger.info(
            f"[{self.log_prefix}] analyzed={len(balance_results)} cols, "
            f"overall index={overall * 100:.1f}/100"
        )
        return MetricResult(
            metric_id="class_balance",
            score=overall * weight,
            results={"class_balance": {
                "overall_balance_index": round(overall * 100, 2),
                "columns_analyzed": len(balance_results),
                "columns_with_alerts": sum(1 for r in balance_results.values() if r["alerts"]),
                "columns": balance_results,
            }},
            issues=issues,
        )
