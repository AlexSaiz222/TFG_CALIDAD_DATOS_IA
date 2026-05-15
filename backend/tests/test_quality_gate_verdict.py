"""
DM-04 — Quality Gate verdict combinations.

Extends test_quality_gate.py with a parametrised table of (thresholds × issues
× score × new_issues) ⇒ veredicto. Verifies the precedence order documented
in EvaluationService._evaluate_quality_gate:

  1. critical issues > max_critical_issues       → FAILED (highest priority)
  2. quality_score < min_score                   → FAILED
  3. quality_score < min_score + warning_margin  → WARNING
  4. new_issues_count > max_new_issues           → WARNING
  5. otherwise                                   → PASSED
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
    QualityGate,
    QualityGateStatus,
)
from services.evaluation_service import EvaluationService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def project_with_gate(app):
    """Project + custom QualityGate with explicit thresholds."""
    with app.app_context():
        user = User(
            username="gateuser",
            email="gate@example.com",
            password_hash=generate_password_hash("pwd"),
        )
        db.session.add(user)
        db.session.flush()

        proj = Project(name="Gate Project", owner_id=user.id)
        db.session.add(proj)
        db.session.flush()

        gate = QualityGate(
            project_id=proj.id,
            name="Gate",
            thresholds={
                "min_score": 70,        # 0.70
                "max_critical_issues": 0,
                "max_new_issues": 5,
                "warning_margin": 10,   # PASS only if score ≥ 0.80
            },
            is_active=True,
        )
        db.session.add(gate)
        db.session.commit()
        return proj.id


def _make_run(project_id, new_issues_count=0):
    run = AnalysisRun(
        project_id=project_id,
        status=AnalysisStatus.COMPLETED,
        new_issues_count=new_issues_count,
    )
    db.session.add(run)
    db.session.flush()
    return run


# ---------------------------------------------------------------------------
# PASSED scenarios
# ---------------------------------------------------------------------------

class TestGatePassed:

    def test_high_score_no_issues_passes(self, app, project_with_gate):
        with app.app_context():
            run = _make_run(project_with_gate)
            verdict = EvaluationService()._evaluate_quality_gate(
                run, quality_score=0.95, issues=[], results={},
            )
        assert verdict == QualityGateStatus.PASSED

    def test_score_above_warning_margin_passes(self, app, project_with_gate):
        with app.app_context():
            run = _make_run(project_with_gate)
            verdict = EvaluationService()._evaluate_quality_gate(
                run, quality_score=0.85, issues=[], results={},
            )
        assert verdict == QualityGateStatus.PASSED

    def test_new_issues_within_limit_passes(self, app, project_with_gate):
        with app.app_context():
            run = _make_run(project_with_gate, new_issues_count=5)
            verdict = EvaluationService()._evaluate_quality_gate(
                run, quality_score=0.90, issues=[], results={},
            )
        assert verdict == QualityGateStatus.PASSED


# ---------------------------------------------------------------------------
# WARNING scenarios
# ---------------------------------------------------------------------------

class TestGateWarning:

    def test_score_inside_warning_margin_yields_warning(self, app, project_with_gate):
        """min_score=0.70, margin=0.10 → PASS only if ≥ 0.80; score=0.75 is WARNING."""
        with app.app_context():
            run = _make_run(project_with_gate)
            verdict = EvaluationService()._evaluate_quality_gate(
                run, quality_score=0.75, issues=[], results={},
            )
        assert verdict == QualityGateStatus.WARNING

    def test_too_many_new_issues_yields_warning(self, app, project_with_gate):
        with app.app_context():
            run = _make_run(project_with_gate, new_issues_count=10)
            verdict = EvaluationService()._evaluate_quality_gate(
                run, quality_score=0.95, issues=[], results={},
            )
        assert verdict == QualityGateStatus.WARNING


# ---------------------------------------------------------------------------
# FAILED scenarios
# ---------------------------------------------------------------------------

class TestGateFailed:

    def test_critical_issue_fails_regardless_of_score(self, app, project_with_gate):
        """Even a perfect score does not redeem a single critical issue."""
        with app.app_context():
            run = _make_run(project_with_gate)
            verdict = EvaluationService()._evaluate_quality_gate(
                run,
                quality_score=1.0,
                issues=[{"severity": "critical", "description": "x"}],
                results={},
            )
        assert verdict == QualityGateStatus.FAILED

    def test_blocker_severity_treated_as_critical(self, app, project_with_gate):
        with app.app_context():
            run = _make_run(project_with_gate)
            verdict = EvaluationService()._evaluate_quality_gate(
                run,
                quality_score=0.95,
                issues=[{"severity": "blocker", "description": "x"}],
                results={},
            )
        assert verdict == QualityGateStatus.FAILED

    def test_score_below_min_fails(self, app, project_with_gate):
        with app.app_context():
            run = _make_run(project_with_gate)
            verdict = EvaluationService()._evaluate_quality_gate(
                run, quality_score=0.50, issues=[], results={},
            )
        assert verdict == QualityGateStatus.FAILED


# ---------------------------------------------------------------------------
# Precedence: critical > score > warning_margin > new_issues
# ---------------------------------------------------------------------------

class TestGatePrecedence:

    def test_critical_takes_precedence_over_warning(self, app, project_with_gate):
        """If a critical issue is present, the verdict is FAILED even when
        score is in warning range (no demotion to WARNING)."""
        with app.app_context():
            run = _make_run(project_with_gate, new_issues_count=20)
            verdict = EvaluationService()._evaluate_quality_gate(
                run,
                quality_score=0.75,  # would be WARNING
                issues=[{"severity": "critical", "description": "x"}],
                results={},
            )
        assert verdict == QualityGateStatus.FAILED

    def test_score_below_min_takes_precedence_over_new_issues(self, app, project_with_gate):
        with app.app_context():
            run = _make_run(project_with_gate, new_issues_count=100)
            verdict = EvaluationService()._evaluate_quality_gate(
                run, quality_score=0.30, issues=[], results={},
            )
        assert verdict == QualityGateStatus.FAILED


# ---------------------------------------------------------------------------
# Fallback to defaults when no QualityGate configured
# ---------------------------------------------------------------------------

class TestGateDefaults:

    def test_no_gate_uses_default_thresholds(self, app):
        """A project without a QualityGate row falls back to the defaults
        returned by QualityGate.get_default_thresholds() — min_score=70."""
        with app.app_context():
            user = User(
                username="nogateuser",
                email="nogate@example.com",
                password_hash=generate_password_hash("pwd"),
            )
            db.session.add(user)
            db.session.flush()

            proj = Project(name="No-Gate Project", owner_id=user.id)
            db.session.add(proj)
            db.session.commit()

            run = _make_run(proj.id)
            verdict = EvaluationService()._evaluate_quality_gate(
                run, quality_score=0.90, issues=[], results={},
            )

        assert verdict == QualityGateStatus.PASSED

    def test_inactive_gate_uses_default_thresholds(self, app):
        """An is_active=False gate must NOT be applied; defaults kick in."""
        with app.app_context():
            user = User(
                username="inactivegateuser",
                email="inactive@example.com",
                password_hash=generate_password_hash("pwd"),
            )
            db.session.add(user)
            db.session.flush()

            proj = Project(name="Inactive Gate", owner_id=user.id)
            db.session.add(proj)
            db.session.flush()

            db.session.add(QualityGate(
                project_id=proj.id,
                name="Disabled",
                thresholds={"min_score": 99, "max_critical_issues": 0, "max_new_issues": 0},
                is_active=False,
            ))
            db.session.commit()

            run = _make_run(proj.id)
            # Defaults: min_score=70, margin=10 → PASS at 0.85
            verdict = EvaluationService()._evaluate_quality_gate(
                run, quality_score=0.85, issues=[], results={},
            )

        assert verdict == QualityGateStatus.PASSED
