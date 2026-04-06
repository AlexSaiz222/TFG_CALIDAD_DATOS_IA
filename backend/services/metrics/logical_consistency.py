"""Métrica de consistencia lógica: validación de reglas cruzadas entre columnas."""
import json
import logging
import re

import pandas as pd

from utils.fingerprint_utils import generate_logical_consistency_fingerprint
from .base import BaseMetric, MetricResult

logger = logging.getLogger(__name__)

FORBIDDEN_TOKENS = [
    "import", "__", "exec", "eval", "compile",
    "globals", "locals", "getattr", "setattr", "delattr",
    "open", "os.", "sys.", "subprocess", "shutil",
    "lambda", "def ", "class ",
]


class LogicalConsistencyMetric(BaseMetric):
    log_prefix = "CONSISTENCY"

    def evaluate(self, df, parameters, dataset, evaluation_id, metrics_map):
        rules = parameters.get("rules", [])

        if not rules:
            logger.info(f"[{self.log_prefix}] No rules configured, skipping")
            return MetricResult(metric_id="logical_consistency", score=None, results={}, issues=[])

        issues = []
        consistency_results = []
        compliance_scores = []

        for rule_idx, rule in enumerate(rules):
            rule_name = rule.get("name", f"Regla {rule_idx + 1}")
            expression = rule.get("expression", "")
            rule_type = rule.get("type", "violation")

            # if_then rules store logic in condition + assertion fields, not expression
            if not expression and rule_type != "if_then":
                continue
            if not expression and rule_type == "if_then":
                if not rule.get("condition") or not rule.get("assertion"):
                    logger.warning(f"[{self.log_prefix}] Skipping if_then rule '{rule_name}': missing condition or assertion")
                    continue

            # Security check: scan expression, and for if_then rules also condition + assertion
            strings_to_check = [expression, rule.get("condition", ""), rule.get("assertion", "")]
            blocked_token = next(
                (tok for s in strings_to_check for tok in FORBIDDEN_TOKENS if tok in s.lower()),
                None,
            )
            if blocked_token:
                logger.warning(
                    f"[{self.log_prefix}] Blocked rule '{rule_name}': "
                    f"contains forbidden token '{blocked_token}'"
                )
                issues.append({
                    "evaluation_id": evaluation_id,
                    "metric_id": metrics_map.get("logical_consistency"),
                    "severity": "high",
                    "description": (
                        f"La regla '{rule_name}' contiene tokens prohibidos y fue bloqueada por seguridad"
                    ),
                    "affected_columns": [],
                    "issue_type": "logical_consistency",
                    "fingerprint": generate_logical_consistency_fingerprint(
                        rule_expression=expression, rule_name=rule_name
                    ),
                })
                continue

            try:
                total_rows = len(df)
                violation_count, sample_violations, compliance_rate = self._evaluate_rule(
                    df, rule, rule_type, expression, total_rows, dataset
                )
                compliance_scores.append(compliance_rate)

                affected_cols = [
                    c for c in df.columns
                    if c in expression
                    or c in rule.get("condition", "")
                    or c in rule.get("assertion", "")
                ]

                consistency_results.append({
                    "name": rule_name,
                    "expression": expression,
                    "condition": rule.get("condition", ""),
                    "assertion": rule.get("assertion", ""),
                    "type": rule_type,
                    "violation_count": violation_count,
                    "total_rows": total_rows,
                    "compliance_rate": float(compliance_rate),
                    "affected_columns": affected_cols,
                    "sample_violations": sample_violations,
                })

                if violation_count > 0:
                    violation_pct = violation_count / total_rows if total_rows > 0 else 0
                    severity = self.calculate_dynamic_severity(
                        compliance_rate, 1.0, higher_is_better=True
                    )
                    issues.append({
                        "evaluation_id": evaluation_id,
                        "metric_id": metrics_map.get("logical_consistency"),
                        "severity": severity,
                        "description": (
                            f"La regla '{rule_name}' se violó en {violation_count} filas "
                            f"({violation_pct:.2%} del dataset)"
                        ),
                        "affected_columns": [{"column": c} for c in affected_cols],
                        "affected_rows": {
                            "count": violation_count,
                            "sample": sample_violations[:5],
                        },
                        "issue_type": "logical_consistency",
                        "fingerprint": generate_logical_consistency_fingerprint(
                            rule_expression=expression, rule_name=rule_name
                        ),
                    })

            except Exception as rule_error:
                logger.error(
                    f"[{self.log_prefix}] Error evaluating rule '{rule_name}': {rule_error}"
                )
                consistency_results.append({
                    "name": rule_name,
                    "expression": expression,
                    "type": rule_type,
                    "error": str(rule_error),
                    "violation_count": 0,
                    "total_rows": len(df),
                    "compliance_rate": None,
                    "affected_columns": [],
                    "sample_violations": [],
                })

        overall = (
            sum(compliance_scores) / len(compliance_scores) if compliance_scores else 1.0
        )

        logger.info(
            f"[{self.log_prefix}] evaluated={len(consistency_results)} rules, "
            f"overall={overall:.2%}"
        )
        return MetricResult(
            metric_id="logical_consistency",
            score=float(overall),
            results={"logical_consistency": {
                "overall_compliance": float(overall),
                "rules_evaluated": len(consistency_results),
                "rules_with_violations": sum(
                    1 for r in consistency_results if r.get("violation_count", 0) > 0
                ),
                "rules": consistency_results,
            }},
            issues=issues,
        )

    def _evaluate_rule(self, df, rule, rule_type, expression, total_rows, dataset):
        """Evalúa una regla individual y devuelve (violation_count, sample_violations, compliance_rate)."""
        sensitive = dataset.sensitive_columns or []

        def mask_sample(rows):
            sample = json.loads(rows.head(5).to_json(orient="records"))
            for row in sample:
                for sc in sensitive:
                    if sc in row:
                        row[sc] = "***"
            return sample

        if rule_type == "if_then":
            condition = rule.get("condition", "")
            assertion = rule.get("assertion", "")

            # Parse from expression text if condition/assertion not given separately
            if not condition or not assertion:
                m = re.match(
                    r"(?:IF|Si|WHEN|Cuando)\s+(.+?)\s+(?:THEN|Entonces)\s+(.+)",
                    expression, re.IGNORECASE,
                )
                if m:
                    condition, assertion = m.group(1).strip(), m.group(2).strip()
                else:
                    raise ValueError(f"Cannot parse IF-THEN rule: {expression}")

            cond_rows = df.query(condition)
            if len(cond_rows) == 0:
                return 0, [], 1.0

            try:
                passing = cond_rows.query(assertion)
                violation_count = len(cond_rows) - len(passing)
                violating = df.loc[cond_rows.index.difference(passing.index)]
            except Exception:
                try:
                    violating = cond_rows.query(f"not ({assertion})")
                    violation_count = len(violating)
                except Exception:
                    violating = pd.DataFrame()
                    violation_count = 0

            # IF-THEN compliance is normalized by the rows that entered the condition,
            # not the whole dataset: a selective rule with 100% violations inside its
            # scope should surface as a severe problem, not a rounding error.
            scope_rows = len(cond_rows)
            compliance_rate = 1 - (violation_count / scope_rows) if scope_rows > 0 else 1.0
            sample = mask_sample(violating) if violation_count > 0 else []
            return violation_count, sample, compliance_rate

        # Default: expression selects violating rows directly
        violation_df = df.query(expression)
        violation_count = len(violation_df)
        compliance_rate = 1 - (violation_count / total_rows) if total_rows > 0 else 1.0
        sample = mask_sample(violation_df) if violation_count > 0 else []
        return violation_count, sample, compliance_rate
