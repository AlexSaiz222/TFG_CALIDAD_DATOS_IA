"""
BE-06 — Metrics engine unit tests.

Tests the metric classes (CompletenessMetric, UniquenessMetric) directly
with crafted DataFrames, bypassing Flask / DB. Focus on:
- Edge cases: empty dataset, single column, all-null column, all-unique
- Threshold sensitivity and issue emission
- Score boundaries (0..1)
- Null-pattern expansion in completeness
"""
import sys
import os
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
import pytest

from services.metrics.completeness import CompletenessMetric
from services.metrics.uniqueness import UniquenessMetric


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def dataset_stub():
    """Minimal Dataset-like object exposing only sensitive_columns."""
    return SimpleNamespace(sensitive_columns=[])


@pytest.fixture
def metrics_map():
    return {"completeness": 1, "uniqueness": 2}


# ---------------------------------------------------------------------------
# Completeness
# ---------------------------------------------------------------------------

class TestCompleteness:

    def test_fully_complete_dataset_scores_one(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})
        result = CompletenessMetric().evaluate(df, {}, dataset_stub, 1, metrics_map)
        assert result.score == 1.0
        assert result.issues == []

    def test_half_nulls_scores_half(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"a": [1, None, 2, None]})
        result = CompletenessMetric().evaluate(df, {}, dataset_stub, 1, metrics_map)
        assert result.score == pytest.approx(0.5, abs=1e-6)

    def test_below_threshold_emits_issue(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"a": [1, None, None, None]})  # 25% complete
        result = CompletenessMetric().evaluate(
            df, {"threshold": 0.95}, dataset_stub, 1, metrics_map,
        )
        assert result.score < 0.95
        assert len(result.issues) >= 1
        # All issues are completeness issues
        assert all(i["issue_type"] == "completeness" for i in result.issues)
        # All issues carry a fingerprint
        assert all(i.get("fingerprint") for i in result.issues)

    def test_above_threshold_no_issues(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"a": list(range(100))})  # 100% complete
        result = CompletenessMetric().evaluate(
            df, {"threshold": 0.95}, dataset_stub, 1, metrics_map,
        )
        assert result.issues == []

    def test_column_selection_only_evaluates_listed_columns(self, dataset_stub, metrics_map):
        df = pd.DataFrame({
            "important": [1, 2, 3],            # 100% complete
            "ignore_me": [None, None, None],   # 0% complete
        })
        result = CompletenessMetric().evaluate(
            df, {"columns": ["important"], "threshold": 0.95},
            dataset_stub, 1, metrics_map,
        )
        assert result.score == 1.0
        # No issues on 'ignore_me' since it wasn't selected
        for issue in result.issues:
            cols = [c["column"] for c in issue.get("affected_columns", []) if isinstance(c, dict)]
            assert "ignore_me" not in cols

    def test_null_patterns_treats_text_tokens_as_null(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"a": ["1", "N/A", "null", "2", "-"]})
        result = CompletenessMetric().evaluate(
            df,
            {"null_patterns": {"presets": ["na", "null_word", "dash"]}, "threshold": 0.99},
            dataset_stub, 1, metrics_map,
        )
        # 2 valid values out of 5 → completeness 0.4
        assert result.score == pytest.approx(0.4, abs=1e-6)

    def test_score_bounded_in_0_1(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"a": [1, 2, 3], "b": [None, None, None]})
        result = CompletenessMetric().evaluate(df, {}, dataset_stub, 1, metrics_map)
        assert 0.0 <= result.score <= 1.0


# ---------------------------------------------------------------------------
# Uniqueness
# ---------------------------------------------------------------------------

class TestUniqueness:

    def test_all_unique_rows_score_one(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"a": list(range(50)), "b": list("abcdefghij" * 5)})
        result = UniquenessMetric().evaluate(df, {}, dataset_stub, 1, metrics_map)
        # row_uniqueness = 1.0 (no duplicate rows)
        assert result.results["row_uniqueness"] == 1.0

    def test_full_duplicates_drop_score(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"a": [1] * 20, "b": ["x"] * 20})
        result = UniquenessMetric().evaluate(df, {}, dataset_stub, 1, metrics_map)
        # Only 1 unique row out of 20
        assert result.results["row_uniqueness"] == pytest.approx(1 / 20, abs=1e-6)
        assert any(i["issue_type"] == "duplicate_rows" for i in result.issues)

    def test_expected_unique_column_emits_issue_on_duplicates(self, dataset_stub, metrics_map):
        df = pd.DataFrame({
            "user_id": [1, 2, 2, 3, 3, 3],
            "name": list("abcdef"),
        })
        result = UniquenessMetric().evaluate(
            df, {"columns": ["user_id"], "threshold": 1.0},
            dataset_stub, 1, metrics_map,
        )
        non_unique = [i for i in result.issues if i["issue_type"] == "non_unique_identifier"]
        assert len(non_unique) == 1
        assert non_unique[0]["affected_columns"][0]["column"] == "user_id"
        assert non_unique[0]["affected_columns"][0]["duplicate_count"] == 3

    def test_id_column_with_low_variability_flagged(self, dataset_stub, metrics_map):
        """A column named *_id with mostly repeated values should trigger a
        low_variability issue (≥ 11 rows for the >10 guard)."""
        df = pd.DataFrame({
            "customer_id": [1] * 14 + [2],     # 2 unique out of 15
            "value": list(range(15)),
        })
        result = UniquenessMetric().evaluate(df, {}, dataset_stub, 1, metrics_map)
        flagged = [
            i for i in result.issues
            if i["issue_type"] == "low_variability"
            and i["affected_columns"][0]["column"] == "customer_id"
        ]
        assert flagged, "Expected low_variability issue on customer_id"

    def test_score_bounded_in_0_1(self, dataset_stub, metrics_map):
        df = pd.DataFrame({"a": [1, 1, 2, 2, 3]})
        result = UniquenessMetric().evaluate(df, {}, dataset_stub, 1, metrics_map)
        assert 0.0 <= result.score <= 1.0


# ---------------------------------------------------------------------------
# Sensitive column masking (cross-cutting)
# ---------------------------------------------------------------------------

class TestSensitiveColumnMasking:

    def test_uniqueness_masks_sensitive_values_in_duplicate_samples(self, metrics_map):
        dataset = SimpleNamespace(sensitive_columns=["email"])
        df = pd.DataFrame({
            "email": ["a@x.com"] * 6,
            "name": ["bob"] * 6,
        })
        result = UniquenessMetric().evaluate(df, {}, dataset, 1, metrics_map)
        dup_issues = [i for i in result.issues if i["issue_type"] == "duplicate_rows"]
        assert dup_issues
        for sample in dup_issues[0]["affected_rows"]["sample"]:
            assert sample.get("email") == "***", "Sensitive column not masked"
            assert sample.get("name") != "***", "Non-sensitive column was masked"
