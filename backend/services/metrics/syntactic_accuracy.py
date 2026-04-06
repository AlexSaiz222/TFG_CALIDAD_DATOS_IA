"""Métrica de exactitud sintáctica: validación de tipos y patrones regex."""
import logging
import re

from utils.fingerprint_utils import generate_syntactic_accuracy_fingerprint
from .base import BaseMetric, MetricResult

logger = logging.getLogger(__name__)

SYNTACTIC_PATTERNS = {
    "email":           r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$",
    "url":             r"^https?://[^\s]+$",
    "phone_es":        r"^(\+34)?[6-9]\d{8}$",
    "phone_intl":      r"^\+?\d{1,4}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{4,14}$",
    "dni_es":          r"^\d{8}[A-Za-z]$",
    "date_iso":        r"^\d{4}-\d{2}-\d{2}$",
    "date_eu":         r"^\d{2}/\d{2}/\d{4}$",
    "integer":         r"^-?\d+$",
    "decimal":         r"^-?\d+[.,]?\d*$",
    "uuid":            r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
    "ip_v4":           r"^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$",
    "postal_code_es":  r"^\d{5}$",
    "credit_card":     r"^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$",
}


class SyntacticAccuracyMetric(BaseMetric):
    log_prefix = "SYNTACTIC"

    # Auto-detect only assigns a type when at least this fraction of the sample matches.
    AUTO_DETECT_MIN_MATCH = 0.85

    def evaluate(self, df, parameters, dataset, evaluation_id, metrics_map):
        auto_detect = parameters.get("auto_detect_types", True)
        custom_patterns = parameters.get("custom_patterns", {})
        user_columns = parameters.get("columns", [])
        threshold = parameters.get("threshold", 0.95)

        # Build column → (expected_type, pattern) mapping
        column_checks: dict[str, tuple[str, str]] = {}
        mixed_format_columns: list[dict] = []

        for col_cfg in user_columns:
            if not isinstance(col_cfg, dict):
                continue
            col_name = col_cfg.get("column", "")
            exp_type = col_cfg.get("expected_type", "")
            custom_pat = col_cfg.get("pattern", "")
            if col_name and col_name in df.columns:
                if custom_pat:
                    column_checks[col_name] = (exp_type or "custom", custom_pat)
                elif exp_type in SYNTACTIC_PATTERNS:
                    column_checks[col_name] = (exp_type, SYNTACTIC_PATTERNS[exp_type])

        for col_name, pattern_str in custom_patterns.items():
            if col_name in df.columns and col_name not in column_checks:
                column_checks[col_name] = ("custom", pattern_str)

        if auto_detect:
            string_cols = [c for c in df.columns
                           if df[c].dtype == "object" and c not in column_checks]
            for col in string_cols:
                sample = df[col].dropna().head(100).astype(str)
                if len(sample) == 0:
                    continue
                # Collect every type whose match rate passes the threshold.
                matches: list[tuple[str, float]] = []
                for type_name, pat in SYNTACTIC_PATTERNS.items():
                    try:
                        rgx = re.compile(pat)
                        rate = sum(1 for v in sample if rgx.match(v)) / len(sample)
                    except re.error:
                        continue
                    if rate >= self.AUTO_DETECT_MIN_MATCH:
                        matches.append((type_name, rate))
                if not matches:
                    continue
                # If two or more distinct formats qualify, flag the column as
                # "mixed_format" instead of guessing one and generating false positives.
                if len(matches) >= 2:
                    matches.sort(key=lambda x: x[1], reverse=True)
                    mixed_format_columns.append({
                        "column": col,
                        "detected_types": [
                            {"type": t, "match_rate": round(r, 4)} for t, r in matches
                        ],
                    })
                    continue
                best_type, _ = matches[0]
                column_checks[col] = (best_type, SYNTACTIC_PATTERNS[best_type])

        accuracy_results: dict = {}
        conformance_scores: list[float] = []
        issues = []

        for col_name, (expected_type, pattern_str) in column_checks.items():
            try:
                regex = re.compile(pattern_str)
            except re.error:
                logger.warning(f"[{self.log_prefix}] Invalid regex for '{col_name}': {pattern_str}")
                continue

            non_null = df[col_name].dropna()
            if len(non_null) == 0:
                continue

            valid_count = 0
            invalid_count = 0
            invalid_samples: list[str] = []

            for value in non_null:
                sv = str(value)
                if regex.match(sv):
                    valid_count += 1
                else:
                    invalid_count += 1
                    if len(invalid_samples) < 5:
                        invalid_samples.append(sv)

            total = valid_count + invalid_count
            conformance_rate = valid_count / total if total > 0 else 1.0
            conformance_scores.append(conformance_rate)

            if col_name in (dataset.sensitive_columns or []):
                invalid_samples = ["***" for _ in invalid_samples]

            accuracy_results[col_name] = {
                "expected_type": expected_type,
                "pattern": pattern_str,
                "conformance_rate": float(conformance_rate),
                "valid_count": valid_count,
                "invalid_count": invalid_count,
                "total_checked": total,
                "sample_invalid": invalid_samples,
            }

            if conformance_rate < threshold:
                severity = self.calculate_dynamic_severity(
                    conformance_rate, threshold, higher_is_better=True
                )
                issues.append({
                    "evaluation_id": evaluation_id,
                    "metric_id": metrics_map.get("syntactic_accuracy"),
                    "severity": severity,
                    "description": (
                        f"La columna '{col_name}' tiene {invalid_count} valores que no coinciden "
                        f"con el tipo esperado '{expected_type}' ({conformance_rate:.2%} de conformidad)"
                    ),
                    "affected_columns": [{
                        "column": col_name,
                        "expected_type": expected_type,
                        "invalid_count": invalid_count,
                        "conformance_rate": float(conformance_rate),
                    }],
                    "issue_type": "syntactic_accuracy",
                    "fingerprint": generate_syntactic_accuracy_fingerprint(
                        column_name=col_name,
                        expected_type=expected_type,
                        pattern=pattern_str,
                    ),
                })

        # Emit an informational issue per column with mixed formats detected.
        for mf in mixed_format_columns:
            type_labels = ", ".join(f"{t['type']} ({t['match_rate']:.0%})" for t in mf["detected_types"])
            issues.append({
                "evaluation_id": evaluation_id,
                "metric_id": metrics_map.get("syntactic_accuracy"),
                "severity": "medium",
                "description": (
                    f"La columna '{mf['column']}' contiene múltiples formatos detectados: "
                    f"{type_labels}. Especifica el tipo esperado en la configuración."
                ),
                "affected_columns": [mf],
                "issue_type": "mixed_format",
                "fingerprint": generate_syntactic_accuracy_fingerprint(
                    column_name=mf["column"],
                    expected_type="mixed_format",
                    pattern="",
                ),
            })

        overall = sum(conformance_scores) / len(conformance_scores) if conformance_scores else 1.0

        logger.info(
            f"[{self.log_prefix}] checked={len(column_checks)} cols, "
            f"mixed={len(mixed_format_columns)}, overall={overall:.2%}"
        )
        return MetricResult(
            metric_id="syntactic_accuracy",
            score=float(overall),
            results={"syntactic_accuracy": {
                "overall_conformance": float(overall),
                "columns_checked": len(column_checks),
                "mixed_format_columns": mixed_format_columns,
                "columns": accuracy_results,
            }},
            issues=issues,
        )
