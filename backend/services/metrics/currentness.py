"""Métrica de actualidad (Currentness): frescura y antigüedad de columnas de fecha.

Implementa la dimensión Currentness (ΔT₂) de ISO/IEC 5259-2:2024 §6.2.5 / §6.5.9,
medida Cur-ML-1 (Feature currentness).

Currentness mide el tiempo transcurrido desde que se registró el dato hasta hoy
(staleness/frescura). No confundir con currentness (ΔT₁), que sería la latencia
entre el evento real y su ingesta en el sistema — esa medida requiere dos
timestamps externos y no es calculable desde un dataset estático.
"""
import logging

import pandas as pd

from utils.fingerprint_utils import generate_issue_fingerprint, generate_currentness_fingerprint
from .base import BaseMetric, MetricResult

logger = logging.getLogger(__name__)


class CurrentnessMetric(BaseMetric):
    log_prefix = "CURRENTNESS"

    # Scale controls how slowly the score decays once the dataset is past the
    # staleness threshold. score reaches 0 at (1 + DECAY_SCALE) × threshold.
    # value 3 means: threshold=30d → score=0 at 120d, aligned with the severity
    # ladder (medium ≥ 1x, high ≥ 3x, critical ≥ 10x).
    DECAY_SCALE = 3

    def evaluate(self, df, parameters, dataset, evaluation_id, metrics_map):
        auto_detect = parameters.get("auto_detect", True)
        user_columns = parameters.get("columns", [])
        staleness_days = parameters.get("staleness_threshold_days", 30)

        now = pd.Timestamp.now()
        date_columns = {}

        for col in user_columns:
            if col in df.columns:
                parsed = pd.to_datetime(df[col], errors="coerce", infer_datetime_format=True)
                success_rate = parsed.notna().sum() / len(df) if len(df) > 0 else 0
                if success_rate >= 0.50:
                    date_columns[col] = parsed

        if auto_detect:
            for col in df.columns:
                if col in date_columns:
                    continue
                if pd.api.types.is_datetime64_any_dtype(df[col]):
                    date_columns[col] = df[col]
                    continue
                if df[col].dtype == "object":
                    sample = df[col].dropna().head(50)
                    if len(sample) == 0:
                        continue
                    try:
                        parsed_sample = pd.to_datetime(
                            sample, errors="coerce", infer_datetime_format=True
                        )
                        if parsed_sample.notna().sum() / len(sample) >= 0.50:
                            date_columns[col] = pd.to_datetime(
                                df[col], errors="coerce", infer_datetime_format=True
                            )
                    except Exception:
                        continue

        currentness_results = {}
        freshness_scores = []
        issues = []

        for col_name, parsed_series in date_columns.items():
            valid_dates = parsed_series.dropna()
            if len(valid_dates) == 0:
                continue

            parse_success_rate = float(
                parsed_series.notna().sum() / len(df)
            ) if len(df) > 0 else 0
            max_date = valid_dates.max()
            min_date = valid_dates.min()
            age_days = (now - max_date).days if pd.notna(max_date) else None
            date_range_days = (
                (max_date - min_date).days
                if pd.notna(max_date) and pd.notna(min_date)
                else None
            )

            is_stale = age_days is not None and age_days > staleness_days

            if age_days is None:
                col_freshness = 0.0
            elif age_days <= staleness_days:
                col_freshness = 1.0
            else:
                decay_window = max(1, staleness_days * self.DECAY_SCALE)
                col_freshness = max(0.0, 1.0 - (age_days - staleness_days) / decay_window)

            freshness_scores.append(col_freshness)
            age_human = self._format_age(age_days)

            currentness_results[col_name] = {
                "max_date": max_date.isoformat() if pd.notna(max_date) else None,
                "min_date": min_date.isoformat() if pd.notna(min_date) else None,
                "age_days": int(age_days) if age_days is not None else None,
                "age_human": age_human,
                "date_range_days": int(date_range_days) if date_range_days is not None else None,
                "parse_success_rate": round(parse_success_rate, 4),
                "valid_dates_count": len(valid_dates),
                "is_stale": is_stale,
                "freshness_score": round(col_freshness, 4),
                "staleness_threshold_days": staleness_days,
            }

            if is_stale:
                ratio = age_days / staleness_days if staleness_days > 0 else 10
                if ratio >= 10:
                    severity = "critical"
                elif ratio >= 3:
                    severity = "high"
                elif ratio >= 1:
                    severity = "medium"
                else:
                    severity = "low"

                issues.append({
                    "evaluation_id": evaluation_id,
                    "metric_id": metrics_map.get("currentness"),
                    "severity": severity,
                    "description": (
                        f"La columna '{col_name}' contiene datos desactualizados: el registro más reciente "
                        f"tiene {age_human} de antigüedad (umbral: {staleness_days} días)"
                    ),
                    "affected_columns": [{
                        "column": col_name,
                        "age_days": int(age_days),
                        "max_date": max_date.isoformat(),
                        "freshness_score": round(col_freshness, 4),
                    }],
                    "issue_type": "currentness",
                    "actual_value": age_human,
                    "fingerprint": generate_currentness_fingerprint(
                        column_name=col_name,
                        staleness_threshold_days=staleness_days,
                    ),
                })

            if parse_success_rate < 0.80 and len(df) > 10:
                issues.append({
                    "evaluation_id": evaluation_id,
                    "metric_id": metrics_map.get("currentness"),
                    "severity": "low",
                    "description": (
                        f"La columna '{col_name}' tiene baja tasa de parseo de fechas "
                        f"({parse_success_rate:.1%}): algunos valores pueden no ser fechas válidas"
                    ),
                    "affected_columns": [{
                        "column": col_name,
                        "parse_success_rate": round(parse_success_rate, 4),
                    }],
                    "issue_type": "currentness",
                    "fingerprint": generate_issue_fingerprint(
                        issue_type="currentness",
                        column_name=col_name,
                        rule_key="parse_quality_check",
                    ),
                })

        overall_freshness = (
            sum(freshness_scores) / len(freshness_scores) if freshness_scores else 1.0
        )

        logger.info(
            f"[{self.log_prefix}] analyzed={len(currentness_results)} cols, "
            f"stale={sum(1 for r in currentness_results.values() if r.get('is_stale'))}, "
            f"freshness={overall_freshness:.2%}"
        )
        return MetricResult(
            metric_id="currentness",
            score=float(overall_freshness),
            results={"currentness": {
                "overall_freshness_score": round(overall_freshness, 4),
                "columns_analyzed": len(currentness_results),
                "columns_stale": sum(
                    1 for r in currentness_results.values() if r.get("is_stale")
                ),
                "staleness_threshold_days": staleness_days,
                "analysis_timestamp": now.isoformat(),
                "columns": currentness_results,
            }},
            issues=issues,
        )

    @staticmethod
    def _format_age(age_days):
        if age_days is None:
            return "Desconocido"
        if age_days == 0:
            return "Hoy"
        if age_days == 1:
            return "1 dia"
        if age_days < 30:
            return f"{age_days} dias"
        if age_days < 365:
            months = age_days // 30
            remaining = age_days % 30
            result = f'{months} mes{"es" if months > 1 else ""}'
            if remaining > 0:
                result += f' y {remaining} dia{"s" if remaining > 1 else ""}'
            return result
        years = age_days // 365
        remaining_months = (age_days % 365) // 30
        result = f'{years} año{"s" if years > 1 else ""}'
        if remaining_months > 0:
            result += f' y {remaining_months} mes{"es" if remaining_months > 1 else ""}'
        return result
