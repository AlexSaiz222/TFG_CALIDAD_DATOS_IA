"""Métrica de diversidad: cobertura de valores esperados por columna (ISO 5259-2)."""
import logging
from typing import Any

import numpy as np
import pandas as pd

from utils.fingerprint_utils import generate_diversity_fingerprint
from .base import BaseMetric, MetricResult

logger = logging.getLogger(__name__)


class DiversityMetric(BaseMetric):
    """Mide si el dataset cubre los valores/rangos que el usuario espera.

    Columnas categóricas → ratio de valores esperados presentes (+ representación mínima).
    Columnas numéricas   → cobertura de bins sobre el rango esperado.

    Es una métrica **opt-in por columna**: solo se evalúan las columnas para
    las que el usuario define expectativas en ``parameters["columns"]``.
    Si no hay expectativas definidas, la métrica devuelve ``score=None`` y
    queda excluida del Quality Score.
    """

    log_prefix = "DIVERSITY"

    # ------------------------------------------------------------------
    # evaluate
    # ------------------------------------------------------------------
    def evaluate(self, df, parameters, dataset, evaluation_id, metrics_map):
        col_configs: dict[str, dict[str, Any]] = parameters.get("columns", {})
        if not isinstance(col_configs, dict):
            # Tolerar el formato de lista usado por otras métricas: sin expectativas por columna
            col_configs = {str(c): {} for c in col_configs}
        threshold: float = parameters.get("threshold", 0.60)

        issues: list[dict[str, Any]] = []
        col_results: dict[str, dict[str, Any]] = {}
        col_scores: list[float] = []

        sensitive_columns = getattr(dataset, "sensitive_columns", None) or []

        for col_name, col_cfg in col_configs.items():
            if col_name not in df.columns:
                logger.warning(f"[{self.log_prefix}] Column '{col_name}' not in DataFrame, skipping")
                continue

            col_type = col_cfg.get("type", "categorical")
            sensitive = col_name in sensitive_columns

            if col_type == "categorical":
                score, result, col_issues = self._evaluate_categorical(
                    df, col_name, col_cfg, threshold, evaluation_id, metrics_map, sensitive,
                )
            elif col_type == "numeric":
                score, result, col_issues = self._evaluate_numeric(
                    df, col_name, col_cfg, threshold, evaluation_id, metrics_map, sensitive,
                )
            else:
                logger.warning(f"[{self.log_prefix}] Unknown type '{col_type}' for '{col_name}', skipping")
                continue

            col_results[col_name] = result
            col_scores.append(score)
            issues.extend(col_issues)

        # Global score
        if col_scores:
            overall = float(np.mean(col_scores))
        else:
            overall = 1.0

        has_expectations = len(col_configs) > 0 and len(col_scores) > 0
        score_value = float(overall) if has_expectations else None

        logger.info(
            f"[{self.log_prefix}] columns={len(col_results)}, "
            f"overall={overall:.4f}, has_expectations={has_expectations}"
        )

        return MetricResult(
            metric_id="diversity",
            score=score_value,
            results={"diversity": {
                "overall_diversity": round(overall * 100, 2),
                "columns_analyzed": len(col_results),
                "columns_below_threshold": sum(1 for s in col_scores if s < threshold),
                "threshold": threshold,
                "columns": col_results,
            }},
            issues=issues,
        )

    # ------------------------------------------------------------------
    # Categorical evaluation
    # ------------------------------------------------------------------
    def _evaluate_categorical(
        self, df, col_name, col_cfg, threshold, evaluation_id, metrics_map, sensitive,
    ):
        expected_values: list[str] = [str(v) for v in col_cfg.get("expected_values", [])]
        min_representation: float = col_cfg.get("min_representation", 0.01)

        series = df[col_name].dropna()
        actual_values = set(series.astype(str).unique())
        issues: list[dict[str, Any]] = []

        # Presence check
        present = []
        missing = []
        underrepresented = []

        if expected_values:
            value_counts = series.astype(str).value_counts(normalize=True)
            for ev in expected_values:
                if ev in actual_values:
                    prop = float(value_counts.get(ev, 0.0))
                    if prop < min_representation:
                        underrepresented.append({"value": ev, "proportion": round(prop, 6)})
                        present.append(ev)  # present but under-represented
                    else:
                        present.append(ev)
                else:
                    missing.append(ev)

            n_expected = len(expected_values)
            # Full credit for present + adequate representation
            # Half credit for present but under-represented
            full_present = len(present) - len(underrepresented)
            col_score = (full_present + 0.5 * len(underrepresented)) / n_expected if n_expected > 0 else 1.0
        else:
            # No expectations → score = 1.0, purely informational
            col_score = 1.0

        col_score = float(np.clip(col_score, 0.0, 1.0))

        # Build result dict
        result: dict[str, Any] = {
            "type": "categorical",
            "diversity_score": round(col_score * 100, 2),
            "expected_values": ["***"] * len(expected_values) if sensitive else expected_values,
            "present_values": len(present),
            "missing_values": ["***"] * len(missing) if sensitive else missing,
            "underrepresented": (
                [{"value": "***", "proportion": u["proportion"]} for u in underrepresented]
                if sensitive else underrepresented
            ),
            "total_unique_actual": len(actual_values),
            "total_rows": len(series),
        }

        # Issues — missing values
        for mv in missing:
            severity = self.calculate_dynamic_severity(col_score, threshold, metric_type="diversity")
            label = "***" if sensitive else mv
            issues.append({
                "evaluation_id": evaluation_id,
                "metric_id": metrics_map.get("diversity"),
                "severity": severity,
                "description": (
                    f"El valor esperado '{label}' no está presente en la columna '{col_name}'"
                ),
                "affected_columns": [{"column": col_name, "missing_value": label}],
                "issue_type": "diversity",
                "actual_value": f"{len(present)}/{len(expected_values)} valores presentes",
                "fingerprint": generate_diversity_fingerprint(
                    column_name=col_name,
                    diversity_type="missing_value",
                    expected_value=mv,
                ),
            })

        # Issues — under-represented values
        for ur in underrepresented:
            label = "***" if sensitive else ur["value"]
            issues.append({
                "evaluation_id": evaluation_id,
                "metric_id": metrics_map.get("diversity"),
                "severity": "medium" if ur["proportion"] < min_representation / 2 else "low",
                "description": (
                    f"El valor '{label}' en '{col_name}' tiene solo {ur['proportion']:.2%} "
                    f"de representación (mínimo esperado: {min_representation:.2%})"
                ),
                "affected_columns": [{
                    "column": col_name,
                    "value": label,
                    "proportion": ur["proportion"],
                }],
                "issue_type": "diversity",
                "actual_value": f"{ur['proportion']:.2%}",
                "fingerprint": generate_diversity_fingerprint(
                    column_name=col_name,
                    diversity_type="underrepresented",
                    expected_value=ur["value"],
                ),
            })

        return col_score, result, issues

    # ------------------------------------------------------------------
    # Numeric evaluation
    # ------------------------------------------------------------------
    def _evaluate_numeric(
        self, df, col_name, col_cfg, threshold, evaluation_id, metrics_map, sensitive,
    ):
        expected_range: list = col_cfg.get("expected_range", [])
        num_bins: int = col_cfg.get("num_bins", 10)

        series = pd.to_numeric(df[col_name], errors="coerce").dropna()
        issues: list[dict[str, Any]] = []

        if len(expected_range) != 2 or len(series) == 0:
            # No valid range or no data → informational only
            result = {
                "type": "numeric",
                "diversity_score": 100.0,
                "expected_range": expected_range,
                "actual_range": [float(series.min()), float(series.max())] if len(series) > 0 else None,
                "bins_covered": 0,
                "total_bins": num_bins,
                "total_rows": len(series),
            }
            return 1.0, result, issues

        range_min, range_max = float(expected_range[0]), float(expected_range[1])
        if range_min >= range_max:
            return 1.0, {"type": "numeric", "error": "invalid range"}, issues

        # Clip values to expected range and bin them
        clipped = series.clip(lower=range_min, upper=range_max)
        bin_edges = np.linspace(range_min, range_max, num_bins + 1)
        hist_counts, _ = np.histogram(clipped, bins=bin_edges)

        bins_covered = int(np.sum(hist_counts > 0))
        col_score = float(bins_covered / num_bins)

        actual_min = float(series.min())
        actual_max = float(series.max())

        result: dict[str, Any] = {
            "type": "numeric",
            "diversity_score": round(col_score * 100, 2),
            "expected_range": [range_min, range_max],
            "actual_range": [actual_min, actual_max],
            "bins_covered": bins_covered,
            "total_bins": num_bins,
            "bin_counts": [int(c) for c in hist_counts],
            "total_rows": len(series),
        }

        # Issue — low range coverage
        if col_score < threshold:
            severity = self.calculate_dynamic_severity(col_score, threshold, metric_type="diversity")
            empty_bins = []
            for i, count in enumerate(hist_counts):
                if count == 0:
                    empty_bins.append(f"[{bin_edges[i]:.1f}, {bin_edges[i+1]:.1f})")
            issues.append({
                "evaluation_id": evaluation_id,
                "metric_id": metrics_map.get("diversity"),
                "severity": severity,
                "description": (
                    f"La columna '{col_name}' solo cubre {col_score:.0%} del rango esperado "
                    f"[{range_min}, {range_max}] ({bins_covered}/{num_bins} bins con datos)"
                ),
                "affected_columns": [{
                    "column": col_name,
                    "bins_covered": bins_covered,
                    "total_bins": num_bins,
                    "empty_bins_sample": empty_bins[:5],
                }],
                "issue_type": "diversity",
                "actual_value": f"{col_score:.0%}",
                "fingerprint": generate_diversity_fingerprint(
                    column_name=col_name,
                    diversity_type="low_range_coverage",
                ),
            })

        return col_score, result, issues
