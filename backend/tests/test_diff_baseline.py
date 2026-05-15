"""
DM-02 — Sonar-Lite differential logic against baseline.

Verifies _compare_issues_with_baseline correctly classifies issues as:
- NEW: fingerprint not in baseline
- RECURRENT: fingerprint already existed
- FIXED: fingerprint in baseline missing from current run

Covers:
- No baseline (all issues new)
- Empty current run (everything fixed)
- Mixed: new + recurrent + fixed in the same run
- Issues without fingerprint default to NEW
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from werkzeug.security import generate_password_hash

from extensions import db
from models.user import User
from models.project import Project
from models.analysis import (
    AnalysisRun,
    AnalysisStatus,
    DataQualityIssue,
)
from services.evaluation_service import EvaluationService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_run(project_id, baseline_id=None, status=AnalysisStatus.COMPLETED):
    run = AnalysisRun(
        project_id=project_id,
        status=status,
        baseline_analysis_id=baseline_id,
    )
    db.session.add(run)
    db.session.flush()  # ensure run.id is available
    return run


def _add_issue(run, fingerprint, issue_type="completeness", severity="medium"):
    issue = DataQualityIssue(
        analysis_run_id=run.id,
        fingerprint=fingerprint,
        issue_type=issue_type,
        severity=severity,
        description=f"{issue_type} issue ({fingerprint})",
    )
    db.session.add(issue)
    return issue


@pytest.fixture
def project(app):
    """Create a project (user + project pair) inside the app context."""
    with app.app_context():
        user = User(
            username="diffuser",
            email="diff@example.com",
            password_hash=generate_password_hash("pwd"),
        )
        db.session.add(user)
        db.session.flush()

        proj = Project(name="Diff Project", owner_id=user.id)
        db.session.add(proj)
        db.session.commit()
        return proj.id


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestDiffNoBaseline:

    def test_no_baseline_all_issues_are_new(self, app, project):
        with app.app_context():
            run = _make_run(project)
            _add_issue(run, "fp-aaa")
            _add_issue(run, "fp-bbb")
            _add_issue(run, "fp-ccc")
            db.session.commit()

            result = EvaluationService()._compare_issues_with_baseline(run, None)

        assert result["new_issues_count"] == 3
        assert result["fixed_issues_count"] == 0
        assert result["recurrent_issues_count"] == 0


class TestDiffAllRecurrent:

    def test_identical_runs_yield_zero_new_zero_fixed(self, app, project):
        with app.app_context():
            baseline = _make_run(project)
            for fp in ("fp-1", "fp-2", "fp-3"):
                _add_issue(baseline, fp)
            db.session.commit()

            current = _make_run(project, baseline_id=baseline.id)
            for fp in ("fp-1", "fp-2", "fp-3"):
                _add_issue(current, fp)
            db.session.commit()

            result = EvaluationService()._compare_issues_with_baseline(current, baseline)

        assert result["new_issues_count"] == 0
        assert result["fixed_issues_count"] == 0


class TestDiffAllFixed:

    def test_empty_current_run_marks_baseline_as_fixed(self, app, project):
        with app.app_context():
            baseline = _make_run(project)
            for fp in ("fp-x", "fp-y"):
                _add_issue(baseline, fp)
            db.session.commit()

            current = _make_run(project, baseline_id=baseline.id)
            db.session.commit()

            result = EvaluationService()._compare_issues_with_baseline(current, baseline)

        assert result["new_issues_count"] == 0
        assert result["fixed_issues_count"] == 2


class TestDiffMixed:

    def test_new_recurrent_and_fixed_counted_correctly(self, app, project):
        """Baseline has {A, B, C}; current has {B, C, D, E}.
        Expected: NEW=2 (D, E), RECURRENT=2 (B, C), FIXED=1 (A)."""
        with app.app_context():
            baseline = _make_run(project)
            for fp in ("fp-A", "fp-B", "fp-C"):
                _add_issue(baseline, fp)
            db.session.commit()

            current = _make_run(project, baseline_id=baseline.id)
            for fp in ("fp-B", "fp-C", "fp-D", "fp-E"):
                _add_issue(current, fp)
            db.session.commit()

            result = EvaluationService()._compare_issues_with_baseline(current, baseline)

        assert result["new_issues_count"] == 2
        assert result["fixed_issues_count"] == 1
        assert result["recurrent_issues_count"] == 2

    def test_is_new_flag_persists_on_issues(self, app, project):
        with app.app_context():
            baseline = _make_run(project)
            _add_issue(baseline, "fp-old")
            db.session.commit()

            current = _make_run(project, baseline_id=baseline.id)
            recurrent_issue = _add_issue(current, "fp-old")
            new_issue = _add_issue(current, "fp-new")
            db.session.commit()

            EvaluationService()._compare_issues_with_baseline(current, baseline)
            db.session.commit()

            assert recurrent_issue.is_new is False
            assert new_issue.is_new is True


class TestDiffEdgeCases:

    def test_issue_without_fingerprint_is_considered_new(self, app, project):
        with app.app_context():
            baseline = _make_run(project)
            _add_issue(baseline, "fp-known")
            db.session.commit()

            current = _make_run(project, baseline_id=baseline.id)
            _add_issue(current, None)  # fingerprint missing
            _add_issue(current, "fp-known")
            db.session.commit()

            result = EvaluationService()._compare_issues_with_baseline(current, baseline)

        assert result["new_issues_count"] == 1
        assert result["recurrent_issues_count"] == 1

    def test_baseline_with_null_fingerprints_does_not_falsely_match(self, app, project):
        """Baseline issues with None fingerprint must not match current None
        fingerprints (i.e. None is never considered 'known')."""
        with app.app_context():
            baseline = _make_run(project)
            _add_issue(baseline, None)
            _add_issue(baseline, None)
            db.session.commit()

            current = _make_run(project, baseline_id=baseline.id)
            _add_issue(current, None)
            db.session.commit()

            result = EvaluationService()._compare_issues_with_baseline(current, baseline)

        # The current issue without fingerprint is NEW; the two baseline Nones
        # are NOT counted as fixed because they have no fingerprint to track.
        assert result["new_issues_count"] == 1
