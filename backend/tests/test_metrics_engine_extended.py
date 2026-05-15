"""
BE-06 (extended) — Remaining metric classes.

Covers the six metrics not exercised in test_metrics_engine.py:
    CurrentnessMetric          (freshness of date columns)
    SyntacticAccuracyMetric    (regex / type conformance)
    ClassBalanceMetric         (categorical balance, opt-in scoring)
    DiversityMetric            (expected value/range coverage)
    OutliersMetric             (profiling, score=None)
    LogicalConsistencyMetric   (cross-column rules)

All metrics share the BaseMetric.evaluate signature:
    evaluate(df, parameters, dataset, evaluation_id, metrics_map)
"""
import sys
import os
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
import pytest

from services.metrics.currentness import CurrentnessMetric
from services.metrics.syntactic_accuracy import SyntacticAccuracyMetric
from services.metrics.class_balance import ClassBalanceMetric
from services.metrics.diversity import DiversityMetric
from services.metrics.outliers import OutliersMetric
from services.metrics.logical_consistency import LogicalConsistencyMetric


@pytest.fixture
def dataset_stub():
    """Minimal dataset with no sensitive columns and no `.project` (SyntacticAccuracy
    handles the missing attribute gracefully)."""
    return SimpleNamespace(sensitive_columns=[])


@pytest.fixture
def metrics_map():
    return {
        "currentness": 1,
        "syntactic_accuracy": 2,
        "class_balance": 3,
        "diversity": 4,
        "outliers": 5,
        "logical_consistency": 6,
    }


# ---------------------------------------------------------------------------
# Currentness
# ---------------------------------------------------------------------------

class TestCurrentness:

    def test_fresh_dates_score_one(self, dataset_stub, metrics_map):
        today = pd.Timestamp.now().normalize()
        df = pd.DataFrame({"created_at": [today, today - pd.Timedelta(days=1)]})
        result = CurrentnessMetric().evaluate(
            df, {"staleness_threshold_days": 30}, dataset_stub, 1, metrics_map,
        )
        assert result.score == 1.0
        assert result.issues == []

    def test_stale_dates_emit_issue_and_lower_score(self, dataset_stub, metrics_map):
        old = pd.Timestamp.now().normalize() - pd.Timedelta(days=120)
        df = pd.DataFrame({"created_at": [old, old - pd.Timedelta(days=10)]})
        result = CurrentnessMetric().evaluate(
            df, {"staleness_threshold_days": 30}, dataset_stub, 1, metrics_map,
        )
        assert result.score < 1.0
        currentness_issues = [i for i in result.issues if i["issue_type"] == "currentness"]
        assert currentness_issues, "Expected at least one currentness issue"

    def test_extreme_staleness_marks_critical(self, dataset_stub, metrics_map):
        very_old = pd.Timestamp.now().normalize() - pd.Timedelta(days=365 * 5)
        df = pd.DataFrame({"event_date": [very_old] * 10})
        result = CurrentnessMetric().evaluate(
            df, {"staleness_threshold_days": 30}, dataset_stub, 1, metrics_map,
        )
        severities = {i["severity"] for i in result.issues}
        assert "critical" in severities

    def test_no_date_columns_yields_default_score(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"name": ["a", "b"], "age": [10, 20]})
        result = CurrentnessMetric().evaluate(
            df, {}, dataset_stub, 1, metrics_map,
        )
        assert result.score == 1.0  # No date columns ⇒ overall_freshness defaults to 1.0
        assert result.issues == []

    def test_sensitive_date_column_masks_max_date(self, metrics_map):
        old = pd.Timestamp.now().normalize() - pd.Timedelta(days=200)
        df = pd.DataFrame({"birth_date": [old] * 5})
        dataset = SimpleNamespace(sensitive_columns=["birth_date"])
        result = CurrentnessMetric().evaluate(
            df, {"staleness_threshold_days": 30}, dataset, 1, metrics_map,
        )
        issue = next(i for i in result.issues if i["issue_type"] == "currentness")
        assert issue["affected_columns"][0]["max_date"] == "***"


# ---------------------------------------------------------------------------
# SyntacticAccuracy
# ---------------------------------------------------------------------------

class TestSyntacticAccuracy:

    def test_valid_emails_yield_perfect_score(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"email": ["a@x.com", "b@y.org", "c@z.io"]})
        params = {
            "auto_detect_types": False,
            "columns": [{"column": "email", "expected_type": "email"}],
        }
        result = SyntacticAccuracyMetric().evaluate(
            df, params, dataset_stub, 1, metrics_map,
        )
        assert result.score == 1.0
        assert result.issues == []

    def test_invalid_emails_emit_issue(self, dataset_stub, metrics_map):
        df = pd.DataFrame({
            "email": ["a@x.com", "not-an-email", "also bad", "good@host.io"],
        })
        params = {
            "auto_detect_types": False,
            "columns": [{"column": "email", "expected_type": "email"}],
            "threshold": 0.95,
        }
        result = SyntacticAccuracyMetric().evaluate(
            df, params, dataset_stub, 1, metrics_map,
        )
        assert result.score < 1.0
        assert any(i["issue_type"] == "syntactic_accuracy" for i in result.issues)

    def test_custom_regex_pattern_used(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"code": ["AB-1234", "XY-5678", "bad"]})
        params = {
            "auto_detect_types": False,
            "columns": [{
                "column": "code",
                "expected_type": "code_xx_nnnn",
                "pattern": r"^[A-Z]{2}-\d{4}$",
            }],
            "threshold": 0.95,
        }
        result = SyntacticAccuracyMetric().evaluate(
            df, params, dataset_stub, 1, metrics_map,
        )
        # 2 of 3 valid → conformance 0.667 < threshold → issue emitted
        assert result.score == pytest.approx(2 / 3, abs=1e-9)
        assert len(result.issues) == 1

    def test_integer_phone_with_trailing_dot_zero_handled(self, dataset_stub, metrics_map):
        """Pandas reads integer phones with NaN as float (e.g. 658892118.0).
        The metric must strip the .0 before regex matching."""
        df = pd.DataFrame({"phone": [658892118.0, 612345678.0, np.nan, 699111222.0]})
        params = {
            "auto_detect_types": False,
            "columns": [{"column": "phone", "expected_type": "phone_es"}],
            "threshold": 0.95,
        }
        result = SyntacticAccuracyMetric().evaluate(
            df, params, dataset_stub, 1, metrics_map,
        )
        assert result.score == 1.0


# ---------------------------------------------------------------------------
# ClassBalance
# ---------------------------------------------------------------------------

class TestClassBalance:

    def test_explicit_balanced_column_high_score(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"label": ["a"] * 50 + ["b"] * 50})
        result = ClassBalanceMetric().evaluate(
            df, {"auto_detect": False, "columns": ["label"]},
            dataset_stub, 1, metrics_map,
        )
        # Perfectly balanced 50/50 ⇒ balance_index = 100
        assert result.score == pytest.approx(1.0, abs=1e-6)
        assert result.issues == []

    def test_explicit_imbalanced_column_emits_issue(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"label": ["a"] * 95 + ["b"] * 5})
        result = ClassBalanceMetric().evaluate(
            df, {"auto_detect": False, "columns": ["label"]},
            dataset_stub, 1, metrics_map,
        )
        assert result.score < 1.0
        # Both a dominant-class issue and a minority-class issue at 95/5
        issue_descs = [i["description"] for i in result.issues]
        assert any("dominante" in d for d in issue_descs)

    def test_auto_detect_only_yields_score_none(self, dataset_stub, metrics_map):
        """When the user doesn't pick columns, class_balance is opt-out of QS."""
        df = pd.DataFrame({"label": ["a"] * 95 + ["b"] * 5})
        result = ClassBalanceMetric().evaluate(
            df, {"auto_detect": True, "columns": []},
            dataset_stub, 1, metrics_map,
        )
        assert result.score is None
        # But the column is still analysed for the UI
        assert "class_balance" in result.results

    def test_expected_distribution_in_range_no_issue(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"tier": ["A"] * 80 + ["B"] * 20})
        params = {
            "auto_detect": False,
            "columns": ["tier"],
            "expected_distribution": {
                "tier": {"A": [70, 85], "B": [15, 25]},
            },
        }
        result = ClassBalanceMetric().evaluate(
            df, params, dataset_stub, 1, metrics_map,
        )
        # All classes in range → no distribution_deviation issues
        deviation_issues = [
            i for i in result.issues
            if "rango esperado" in i.get("description", "")
        ]
        assert deviation_issues == []


# ---------------------------------------------------------------------------
# Diversity
# ---------------------------------------------------------------------------

class TestDiversity:

    def test_no_expectations_yields_score_none(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"country": ["ES", "FR", "DE"] * 10})
        result = DiversityMetric().evaluate(
            df, {}, dataset_stub, 1, metrics_map,
        )
        assert result.score is None

    def test_all_expected_values_present(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"country": ["ES", "FR", "DE"] * 10})
        params = {
            "columns": {
                "country": {
                    "type": "categorical",
                    "expected_values": ["ES", "FR", "DE"],
                    "min_representation": 0.10,
                },
            },
        }
        result = DiversityMetric().evaluate(
            df, params, dataset_stub, 1, metrics_map,
        )
        assert result.score == 1.0
        assert all(i["issue_type"] != "diversity" or "missing" not in i["description"]
                   for i in result.issues)

    def test_missing_expected_value_emits_issue(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"country": ["ES", "FR"] * 10})  # DE missing
        params = {
            "columns": {
                "country": {
                    "type": "categorical",
                    "expected_values": ["ES", "FR", "DE"],
                    "min_representation": 0.01,
                },
            },
        }
        result = DiversityMetric().evaluate(
            df, params, dataset_stub, 1, metrics_map,
        )
        assert result.score < 1.0
        missing_issues = [
            i for i in result.issues
            if "no está presente" in i.get("description", "")
        ]
        assert len(missing_issues) == 1

    def test_numeric_range_low_coverage_emits_issue(self, dataset_stub, metrics_map):
        # All values clustered in the bottom of the expected range
        df = pd.DataFrame({"age": np.linspace(0, 9, 100)})  # strictly inside bin 0
        params = {
            "columns": {
                "age": {
                    "type": "numeric",
                    "expected_range": [0, 100],
                    "num_bins": 10,
                },
            },
            "threshold": 0.60,
        }
        result = DiversityMetric().evaluate(
            df, params, dataset_stub, 1, metrics_map,
        )
        # Only the first bin (0–10) is covered ⇒ score = 0.10 < threshold
        assert result.score == pytest.approx(0.1, abs=1e-6)
        coverage_issues = [
            i for i in result.issues
            if "rango esperado" in i.get("description", "")
        ]
        assert len(coverage_issues) == 1


# ---------------------------------------------------------------------------
# Outliers
# ---------------------------------------------------------------------------

class TestOutliers:

    def test_score_is_always_none(self, dataset_stub, metrics_map):
        """Outliers is profiling-only per ISO/IEC 5259."""
        df = pd.DataFrame({"value": list(range(100)) + [10_000]})
        result = OutliersMetric().evaluate(
            df, {"columns": ["value"], "method": "iqr", "factor": 1.5},
            dataset_stub, 1, metrics_map,
        )
        assert result.score is None

    def test_iqr_detects_extreme_value(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"value": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1000]})
        result = OutliersMetric().evaluate(
            df, {"columns": ["value"], "method": "iqr", "factor": 1.5},
            dataset_stub, 1, metrics_map,
        )
        outlier_issues = [i for i in result.issues if i["issue_type"] == "outliers"]
        assert outlier_issues
        assert outlier_issues[0]["affected_columns"][0]["outlier_count"] >= 1

    def test_zscore_method_supported(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"value": list(range(100)) + [10_000]})
        result = OutliersMetric().evaluate(
            df, {"columns": ["value"], "method": "zscore", "factor": 3.0},
            dataset_stub, 1, metrics_map,
        )
        outlier_issues = [i for i in result.issues if i["issue_type"] == "outliers"]
        assert outlier_issues

    def test_non_numeric_columns_skipped(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"category": ["a", "b", "c"] * 10})
        result = OutliersMetric().evaluate(
            df, {}, dataset_stub, 1, metrics_map,
        )
        assert result.issues == []

    def test_sensitive_column_strips_statistics(self, metrics_map):
        df = pd.DataFrame({"salary": list(range(100)) + [10_000]})
        dataset = SimpleNamespace(sensitive_columns=["salary"])
        result = OutliersMetric().evaluate(
            df, {"columns": ["salary"], "method": "iqr", "factor": 1.5},
            dataset, 1, metrics_map,
        )
        col_result = result.results["outliers"]["salary"]
        # Stats like q1/q3/median must be stripped on sensitive columns
        for key in ["q1", "q3", "median", "lower_bound", "upper_bound"]:
            assert key not in col_result


# ---------------------------------------------------------------------------
# LogicalConsistency
# ---------------------------------------------------------------------------

class TestLogicalConsistency:

    def test_no_rules_yields_score_none(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
        result = LogicalConsistencyMetric().evaluate(
            df, {"rules": []}, dataset_stub, 1, metrics_map,
        )
        assert result.score is None
        assert result.issues == []

    def test_rule_with_no_violations_compliance_full(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"price": [10, 20, 30], "discount": [1, 2, 3]})
        params = {
            "rules": [{
                "name": "discount under price",
                "expression": "discount >= price",  # violation: discount >= price
            }],
        }
        result = LogicalConsistencyMetric().evaluate(
            df, params, dataset_stub, 1, metrics_map,
        )
        assert result.score == 1.0
        assert result.issues == []

    def test_rule_with_violations_emits_issue(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"price": [10, 20, 30], "discount": [5, 25, 100]})
        params = {
            "rules": [{
                "name": "discount under price",
                "expression": "discount >= price",
            }],
        }
        result = LogicalConsistencyMetric().evaluate(
            df, params, dataset_stub, 1, metrics_map,
        )
        # 2 of 3 rows violate (25>=20, 100>=30) → compliance = 1/3
        assert result.score == pytest.approx(1 / 3, abs=1e-6)
        assert len(result.issues) == 1
        assert result.issues[0]["issue_type"] == "logical_consistency"

    def test_if_then_rule_scoped_to_condition(self, dataset_stub, metrics_map):
        df = pd.DataFrame({
            "country": ["ES", "FR", "DE", "ES", "ES"],
            "postal_code": ["28001", "75000", "10115", "BAD", "BAD"],
        })
        params = {
            "rules": [{
                "name": "ES postal code is 5 digits",
                "type": "if_then",
                "condition": "country == 'ES'",
                "assertion": "postal_code.str.match(r'^\\d{5}$')",
            }],
        }
        result = LogicalConsistencyMetric().evaluate(
            df, params, dataset_stub, 1, metrics_map,
        )
        # 3 ES rows, 2 violations ⇒ scoped compliance = 1/3
        assert result.score == pytest.approx(1 / 3, abs=1e-6)
        assert len(result.issues) == 1

    def test_forbidden_token_blocks_rule(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"x": [1, 2, 3]})
        params = {
            "rules": [{
                "name": "evil rule",
                "expression": "__import__('os').system('rm -rf /')",
            }],
        }
        result = LogicalConsistencyMetric().evaluate(
            df, params, dataset_stub, 1, metrics_map,
        )
        # Blocked rule emits a high-severity issue, NOT executed
        blocked = [
            i for i in result.issues
            if "bloqueada por seguridad" in i.get("description", "")
        ]
        assert len(blocked) == 1
        assert blocked[0]["severity"] == "high"

    def test_sensitive_columns_masked_in_violation_sample(self, metrics_map):
        df = pd.DataFrame({
            "salary": [1000, 2000, 3000],
            "bonus":  [5000, 100, 100],  # row 0 violates
        })
        dataset = SimpleNamespace(sensitive_columns=["salary"])
        params = {
            "rules": [{
                "name": "bonus < salary",
                "expression": "bonus > salary",
            }],
        }
        result = LogicalConsistencyMetric().evaluate(
            df, params, dataset, 1, metrics_map,
        )
        issue = next(i for i in result.issues if i["issue_type"] == "logical_consistency")
        for row in issue["affected_rows"]["sample"]:
            assert row.get("salary") == "***"
            assert row.get("bonus") != "***"
