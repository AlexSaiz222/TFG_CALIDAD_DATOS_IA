"""Métrica de consistencia de patrón: validación regex por columna."""
import logging
import re

from utils.fingerprint_utils import generate_issue_fingerprint, generate_pattern_issue_fingerprint
from .base import BaseMetric, MetricResult

logger = logging.getLogger(__name__)


class ConsistencyMetric(BaseMetric):
    log_prefix = "CONSISTENCY_PATTERN"

    def evaluate(self, df, parameters, dataset, evaluation_id, metrics_map):
        weight = parameters.get("weight", 1.0)
        column = parameters.get("column")
        pattern = parameters.get("pattern")
        threshold = parameters.get("threshold", 0.95)

        issues = []

        if not column or not pattern or column not in df.columns:
            logger.warning(
                f"[{self.log_prefix}] Missing 'column' or 'pattern' parameter, skipping"
            )
            return MetricResult(metric_id="consistency", score=None, results={}, issues=[])

        try:
            regex = re.compile(pattern)
        except re.error:
            issues.append({
                "evaluation_id": evaluation_id,
                "metric_id": metrics_map.get("consistency"),
                "severity": "high",
                "description": f"Invalid regex pattern '{pattern}' for column '{column}'",
                "issue_type": "consistency",
                "fingerprint": generate_issue_fingerprint(
                    issue_type="consistency_error",
                    column_name=column,
                    rule_key="invalid_pattern",
                    extra_params={"pattern": pattern},
                ),
            })
            return MetricResult(metric_id="consistency", score=None, results={}, issues=issues)

        valid_count = 0
        invalid_count = 0
        invalid_examples = []

        for value in df[column].dropna():
            str_value = str(value)
            if regex.match(str_value):
                valid_count += 1
            else:
                invalid_count += 1
                if len(invalid_examples) < 5:
                    invalid_examples.append(str_value)

        total = valid_count + invalid_count
        score = valid_count / total if total > 0 else 1.0

        results = {f"consistency_pattern_{column}": score}

        if score < threshold:
            issues.append({
                "evaluation_id": evaluation_id,
                "metric_id": metrics_map.get("consistency"),
                "severity": "high" if score < 0.8 else "medium",
                "description": (
                    f"Column '{column}' has {invalid_count} values "
                    f"that don't match pattern '{pattern}'"
                ),
                "affected_columns": [{"column": column, "invalid_count": invalid_count}],
                "details": {
                    "valid_count": valid_count,
                    "invalid_count": invalid_count,
                    "examples": (
                        ["***" for _ in invalid_examples]
                        if column in (dataset.sensitive_columns or [])
                        else invalid_examples
                    ),
                },
                "issue_type": "consistency",
                "fingerprint": generate_pattern_issue_fingerprint(
                    column_name=column, pattern=pattern
                ),
            })

        logger.info(f"[{self.log_prefix}] column='{column}' score={score:.4f}")
        return MetricResult(
            metric_id="consistency",
            score=score * weight,
            results=results,
            issues=issues,
        )
