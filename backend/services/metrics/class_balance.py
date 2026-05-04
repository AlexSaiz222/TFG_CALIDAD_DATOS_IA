"""Métrica de equilibrio de clases: distribución de variables categóricas."""
import logging
from typing import Any

import numpy as np
import pandas as pd

from utils.fingerprint_utils import generate_class_balance_fingerprint
from .base import BaseMetric, MetricResult

logger = logging.getLogger(__name__)


class ClassBalanceMetric(BaseMetric):
    log_prefix = "CLASS_BALANCE"

    def evaluate(self, df, parameters, dataset, evaluation_id, metrics_map):
        auto_detect = parameters.get("auto_detect", True)
        user_columns = parameters.get("columns", [])
        max_cardinality = parameters.get("max_cardinality", 50)
        threshold_high = parameters.get("imbalance_threshold_high", 0.90)
        threshold_low = parameters.get("imbalance_threshold_low", 0.05)
        expected_distribution: dict[str, dict[str, list]] = parameters.get("expected_distribution", {})

        # Class balance is opt-in: it only contributes to the Quality Score when
        # the user explicitly selects columns to track. Auto-detected columns
        # still produce informational issues but do not pull the score down,
        # because natural class imbalance (e.g. 97/3 fraud) is not a data-quality
        # defect in itself per ISO/IEC 5259.
        explicit_mode = bool([c for c in user_columns if c in df.columns])
        target_columns = [c for c in user_columns if c in df.columns]

        if auto_detect:
            for col in df.columns:
                if col in target_columns:
                    continue
                n_unique = df[col].nunique(dropna=True)
                if n_unique <= 1:
                    continue
                n_total = df[col].count()
                unique_ratio = n_unique / n_total if n_total > 0 else 1.0
                # Skip high-cardinality columns: if >25% of values are unique the column
                # is likely an identifier, free-text or email — not a true category.
                if unique_ratio > 0.25:
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

            # --- Expected distribution conformity (new feature) ---
            col_expected = expected_distribution.get(col, {})
            conformity_result = None
            if col_expected:
                conformity_result, conf_issues = self._evaluate_conformity(
                    col, value_counts, col_expected, sensitive,
                    evaluation_id, metrics_map,
                )
                issues.extend(conf_issues)

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
            if conformity_result is not None:
                balance_results[col]["expected_distribution"] = conformity_result

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
                    "actual_value": f"{dominant_prop:.1%}",
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
                    "actual_value": f"{minority_prop:.2%}",
                    "fingerprint": generate_class_balance_fingerprint(
                        column_name=col, imbalance_type="minority_class"
                    ),
                })

        # Only the explicitly-selected columns contribute to the score.
        # Auto-detected columns are kept in `results` for visibility and still
        # generate issues, but do not affect the Quality Score.
        #
        # Columns with expected_distribution are always treated as explicit,
        # even if they were auto-detected.
        dist_columns = set(expected_distribution.keys())
        effective_explicit = explicit_mode or bool(dist_columns & set(balance_results.keys()))

        if effective_explicit:
            explicit_cols = set(c for c in user_columns if c in balance_results) | (dist_columns & set(balance_results.keys()))
            explicit_scores = []
            for c in explicit_cols:
                br = balance_results[c]
                entropy_score = br["balance_index"] / 100.0
                if "expected_distribution" in br:
                    conf_score = br["expected_distribution"]["conformity_score"] / 100.0
                    explicit_scores.append(0.5 * entropy_score + 0.5 * conf_score)
                else:
                    explicit_scores.append(entropy_score)
            overall = (
                sum(explicit_scores) / len(explicit_scores)
                if explicit_scores else 1.0
            )
            score_value: float | None = float(overall)
        else:
            overall = sum(balance_scores) / len(balance_scores) if balance_scores else 1.0
            score_value = None  # Opt-in: auto-detected only → excluded from Quality Score

        logger.info(
            f"[{self.log_prefix}] analyzed={len(balance_results)} cols, "
            f"overall index={overall * 100:.1f}/100, explicit_mode={explicit_mode}"
        )
        return MetricResult(
            metric_id="class_balance",
            score=score_value,
            results={"class_balance": {
                "overall_balance_index": round(overall * 100, 2),
                "columns_analyzed": len(balance_results),
                "columns_with_alerts": sum(1 for r in balance_results.values() if r["alerts"]),
                "has_expected_distribution": bool(dist_columns & set(balance_results.keys())),
                "columns": balance_results,
            }},
            issues=issues,
        )

    # ------------------------------------------------------------------
    # Expected distribution conformity
    # ------------------------------------------------------------------
    def _evaluate_conformity(
        self,
        col_name: str,
        value_counts: pd.Series,
        col_expected: dict[str, list],
        sensitive: bool,
        evaluation_id,
        metrics_map: dict,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        """Compare actual proportions against user-defined expected ranges.

        Args:
            col_expected: {"junior": [70, 85], "senior": [10, 20], ...}
                          Values are [min%, max%] expressed as percentages (0-100).
        Returns:
            (result_dict, issues_list)
        """
        issues: list[dict[str, Any]] = []
        class_results: list[dict[str, Any]] = []
        classes_in_range = 0
        total_classes = len(col_expected)

        for class_name, expected_range in col_expected.items():
            if not isinstance(expected_range, list) or len(expected_range) != 2:
                continue
            min_pct, max_pct = float(expected_range[0]), float(expected_range[1])
            actual_prop = float(value_counts.get(class_name, 0.0))
            actual_pct = actual_prop * 100.0

            in_range = min_pct <= actual_pct <= max_pct
            if in_range:
                classes_in_range += 1
                deviation = 0.0
            else:
                deviation = min(abs(actual_pct - min_pct), abs(actual_pct - max_pct))

            label = "***" if sensitive else class_name
            class_results.append({
                "class": label,
                "expected_range": [min_pct, max_pct],
                "actual_pct": round(actual_pct, 2),
                "in_range": in_range,
                "deviation_pp": round(deviation, 2),
            })

            if not in_range:
                sev = self.calculate_dynamic_severity(
                    deviation / 100.0, 0.0, metric_type="class_balance_deviation"
                )
                direction = "por debajo" if actual_pct < min_pct else "por encima"
                issues.append({
                    "evaluation_id": evaluation_id,
                    "metric_id": metrics_map.get("class_balance"),
                    "severity": sev,
                    "description": (
                        f"La clase '{label}' en '{col_name}' tiene {actual_pct:.1f}% "
                        f"({direction} del rango esperado [{min_pct:.0f}%-{max_pct:.0f}%], "
                        f"desviación: {deviation:.1f}pp)"
                    ),
                    "affected_columns": [{
                        "column": col_name,
                        "class": label,
                        "actual_pct": round(actual_pct, 2),
                        "expected_range": [min_pct, max_pct],
                        "deviation_pp": round(deviation, 2),
                    }],
                    "issue_type": "class_balance",
                    "actual_value": f"{actual_pct:.1f}%",
                    "fingerprint": generate_class_balance_fingerprint(
                        column_name=col_name,
                        imbalance_type="distribution_deviation",
                        class_name=class_name,
                    ),
                })

        conformity_score = (classes_in_range / total_classes * 100.0) if total_classes > 0 else 100.0

        result: dict[str, Any] = {
            "conformity_score": round(conformity_score, 2),
            "classes_in_range": classes_in_range,
            "total_expected_classes": total_classes,
            "class_details": class_results,
        }
        return result, issues
