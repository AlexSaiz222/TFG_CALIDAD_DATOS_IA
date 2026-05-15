"""
DM-03 — Quality Score formula tests.

Verifies EvaluationService._calculate_quality_score against canonical input
vectors. The formula:

    quality_score = max(0, 1 - min(0.97, raw_penalty / column_scale))
    raw_penalty   = sum(count[s] * weight[s])
    column_scale  = sqrt(max(REFERENCE_COLUMNS, num_columns) / REFERENCE_COLUMNS)

Weights: critical=0.12, high=0.05, medium=0.01, low=0.003.
Reference columns: 10. Max issue penalty (cap): 0.97.
"""
import sys
import os
import math

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from services.evaluation_service import EvaluationService


calc = EvaluationService._calculate_quality_score
WEIGHTS = EvaluationService.PENALTY_PER_ISSUE
REF_COLS = EvaluationService.REFERENCE_COLUMNS
MAX_PEN = EvaluationService.MAX_ISSUE_PENALTY


def _issues(**counts):
    """Build an issue list with the given severity counts.

    >>> _issues(critical=1, high=2) ⇒ 3 issue dicts
    """
    out = []
    for severity, n in counts.items():
        out.extend([{"severity": severity}] * n)
    return out


# ---------------------------------------------------------------------------
# Canonical: clean dataset → perfect score
# ---------------------------------------------------------------------------

class TestPerfectScore:

    def test_no_issues_yields_one(self):
        score, _ = calc([], num_columns=10)
        assert score == 1.0

    def test_no_issues_regardless_of_column_count(self):
        for cols in (1, 5, 10, 50, 100):
            score, _ = calc([], num_columns=cols)
            assert score == 1.0, f"failed at cols={cols}"


# ---------------------------------------------------------------------------
# Canonical: single-severity vectors at reference width (10 columns)
# ---------------------------------------------------------------------------

class TestSingleSeverityAtReference:
    """At num_columns == REFERENCE_COLUMNS, column_scale == 1, so
    score == 1 - weight[severity]."""

    @pytest.mark.parametrize("severity,expected", [
        ("critical", 1.0 - 0.12),
        ("high",     1.0 - 0.05),
        ("medium",   1.0 - 0.01),
        ("low",      1.0 - 0.003),
    ])
    def test_one_issue_subtracts_its_weight(self, severity, expected):
        score, _ = calc(_issues(**{severity: 1}), num_columns=REF_COLS)
        assert score == pytest.approx(expected, abs=1e-9)

    def test_multiple_critical_issues_compound_linearly(self):
        """3 criticals at 10 cols: raw = 0.36, score = 0.64."""
        score, _ = calc(_issues(critical=3), num_columns=REF_COLS)
        assert score == pytest.approx(0.64, abs=1e-9)


# ---------------------------------------------------------------------------
# Canonical: mixed severities
# ---------------------------------------------------------------------------

class TestMixedSeverities:

    def test_one_of_each_severity(self):
        """raw = 0.12 + 0.05 + 0.01 + 0.003 = 0.183 → score = 0.817."""
        score, breakdown = calc(
            _issues(critical=1, high=1, medium=1, low=1),
            num_columns=REF_COLS,
        )
        assert score == pytest.approx(0.817, abs=1e-9)
        assert breakdown["issue_counts"] == {
            "critical": 1, "high": 1, "medium": 1, "low": 1,
        }

    def test_raw_penalty_is_dot_product(self):
        counts = {"critical": 2, "high": 3, "medium": 5, "low": 10}
        expected_raw = (
            2 * WEIGHTS["critical"] + 3 * WEIGHTS["high"]
            + 5 * WEIGHTS["medium"] + 10 * WEIGHTS["low"]
        )
        _, breakdown = calc(_issues(**counts), num_columns=REF_COLS)
        assert breakdown["raw_penalty"] == pytest.approx(round(expected_raw, 4), abs=1e-9)


# ---------------------------------------------------------------------------
# Cap: penalty never exceeds 0.97 → score floor is 0.03
# ---------------------------------------------------------------------------

class TestPenaltyCap:

    def test_extreme_issue_count_clamped_to_cap(self):
        """100 criticals at 10 cols would yield raw=12.0, but the cap is 0.97."""
        score, breakdown = calc(_issues(critical=100), num_columns=REF_COLS)
        assert breakdown["issue_penalty"] == pytest.approx(MAX_PEN, abs=1e-9)
        assert score == pytest.approx(1.0 - MAX_PEN, abs=1e-9)
        assert score >= 0.03 - 1e-9  # floor

    def test_score_never_negative(self):
        score, _ = calc(_issues(critical=10_000), num_columns=REF_COLS)
        assert score >= 0.0


# ---------------------------------------------------------------------------
# Dimensionality correction: wider datasets get a softer penalty
# ---------------------------------------------------------------------------

class TestDimensionalityCorrection:

    def test_same_issues_more_columns_yields_higher_score(self):
        """Same 5 critical issues should grade better on a 40-column dataset
        than on a 10-column dataset (sqrt(4) = 2 ⇒ half the penalty)."""
        score_10, _ = calc(_issues(critical=5), num_columns=10)
        score_40, _ = calc(_issues(critical=5), num_columns=40)
        assert score_40 > score_10

    def test_column_scale_uses_sqrt_with_reference_floor(self):
        _, breakdown = calc([], num_columns=40)
        assert breakdown["column_scale"] == pytest.approx(math.sqrt(4), abs=1e-9)

    def test_narrow_dataset_treated_as_reference(self):
        """Datasets with fewer than REFERENCE_COLUMNS columns are not punished
        further: scale stays at 1.0."""
        for cols in (0, 1, 5, 9, 10):
            _, breakdown = calc([], num_columns=cols)
            assert breakdown["column_scale"] == pytest.approx(1.0, abs=1e-9), \
                f"unexpected scale at cols={cols}"

    def test_zero_columns_does_not_divide_by_zero(self):
        """Edge case: empty dataset still produces a valid score."""
        score, breakdown = calc(_issues(critical=1), num_columns=0)
        assert 0.0 <= score <= 1.0
        assert breakdown["column_scale"] > 0


# ---------------------------------------------------------------------------
# Severity filtering: unknown / missing severities are silently ignored
# ---------------------------------------------------------------------------

class TestSeverityFiltering:

    def test_unknown_severity_does_not_penalize(self):
        issues = [{"severity": "trivial"}, {"severity": "info"}, {"severity": "blocker"}]
        score, breakdown = calc(issues, num_columns=REF_COLS)
        assert score == 1.0
        assert breakdown["raw_penalty"] == 0.0

    def test_issue_without_severity_is_ignored(self):
        issues = [{"description": "no severity field"}]
        score, _ = calc(issues, num_columns=REF_COLS)
        assert score == 1.0

    def test_severity_case_must_match_lowercase(self):
        """The formula only matches exact lowercase severity strings; uppercase
        is rejected. This documents the current contract."""
        score, _ = calc([{"severity": "CRITICAL"}], num_columns=REF_COLS)
        assert score == 1.0


# ---------------------------------------------------------------------------
# Bounds and determinism
# ---------------------------------------------------------------------------

class TestBoundsAndDeterminism:

    @pytest.mark.parametrize("counts", [
        {"critical": 0},
        {"critical": 1},
        {"high": 7},
        {"medium": 50},
        {"low": 200},
        {"critical": 3, "high": 5, "medium": 10, "low": 20},
    ])
    def test_score_always_in_unit_interval(self, counts):
        for cols in (1, 10, 100):
            score, _ = calc(_issues(**counts), num_columns=cols)
            assert 0.0 <= score <= 1.0

    def test_same_inputs_yield_same_score(self):
        issues = _issues(critical=2, high=3, medium=1)
        score_a, _ = calc(issues, num_columns=15)
        score_b, _ = calc(issues, num_columns=15)
        assert score_a == score_b

    def test_order_of_issues_does_not_matter(self):
        a = [{"severity": "critical"}, {"severity": "low"}, {"severity": "high"}]
        b = [{"severity": "high"}, {"severity": "critical"}, {"severity": "low"}]
        assert calc(a, num_columns=10)[0] == calc(b, num_columns=10)[0]


# ---------------------------------------------------------------------------
# Breakdown contract
# ---------------------------------------------------------------------------

class TestBreakdownContract:
    """The breakdown dict is consumed by the UI; its shape is part of the
    public contract of _calculate_quality_score."""

    EXPECTED_KEYS = {
        "raw_penalty",
        "column_scale",
        "num_columns",
        "issue_penalty",
        "penalty_weights",
        "final_score",
        "formula",
        "issue_counts",
    }

    def test_breakdown_keys_present(self):
        _, breakdown = calc([], num_columns=10)
        assert set(breakdown.keys()) == self.EXPECTED_KEYS

    def test_breakdown_final_score_matches_returned_score(self):
        score, breakdown = calc(_issues(critical=2, high=1), num_columns=10)
        assert breakdown["final_score"] == pytest.approx(score, abs=1e-4)

    def test_breakdown_issue_counts_match_input(self):
        _, breakdown = calc(
            _issues(critical=4, high=2, medium=7, low=3),
            num_columns=10,
        )
        assert breakdown["issue_counts"] == {
            "critical": 4, "high": 2, "medium": 7, "low": 3,
        }

    def test_breakdown_formula_label_is_stable(self):
        _, breakdown = calc([], num_columns=10)
        assert breakdown["formula"] == "issue_penalty_with_dimensionality"
