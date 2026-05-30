"""
BE-07 — AnalysisRun lifecycle and model tests.

Verifies:
- Creation and default values of AnalysisRun.
- The _ensure_serializable helper for NumPy, Enum, and DateTime types.
- to_dict and to_summary_dict serialization.
- Baseline self-referential relationship.
"""
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
import numpy as np
from enum import Enum
from extensions import db
from models.analysis import AnalysisRun, AnalysisStatus, QualityGateStatus


def test_analysis_run_creation(app, sample_project):
    """Test that AnalysisRun can be created with defaults and persisted."""
    with app.app_context():
        run = AnalysisRun(
            project_id=sample_project,
            status=AnalysisStatus.PENDING,
            metrics_config={"completeness": {}},
            results={"completeness": 0.95}
        )
        db.session.add(run)
        db.session.commit()

        # Check fields and defaults
        assert run.id is not None
        assert run.project_id == sample_project
        assert run.status == AnalysisStatus.PENDING
        assert run.progress == 0
        assert run.quality_gate_status is None
        assert run.metrics_config == {"completeness": {}}
        assert run.results == {"completeness": 0.95}
        assert isinstance(run.created_at, datetime)
        assert isinstance(run.updated_at, datetime)


def test_ensure_serializable(app, sample_project):
    """Test that _ensure_serializable recursively handles NumPy, Enum, and DateTime types."""
    with app.app_context():
        run = AnalysisRun(project_id=sample_project)

        class MockEnum(Enum):
            ALPHA = "alpha_value"

        test_data = {
            "int_val": 42,
            "float_val": 1.23,
            "np_int": np.int32(100),
            "np_float": np.float64(5.67),
            "np_arr": np.array([4, 5, 6]),
            "enum_val": MockEnum.ALPHA,
            "datetime_val": datetime(2026, 5, 28, 18, 0, 0),
            "nested_dict": {
                "numpy_int_64": np.int64(999)
            },
            "none_val": None
        }

        serialized = run._ensure_serializable(test_data)

        assert serialized["int_val"] == 42
        assert serialized["float_val"] == 1.23
        assert serialized["np_int"] == 100
        assert serialized["np_float"] == 5.67
        assert serialized["np_arr"] == [4, 5, 6]
        assert serialized["enum_val"] == "alpha_value"
        assert isinstance(serialized["datetime_val"], str)
        assert serialized["nested_dict"]["numpy_int_64"] == 999
        assert serialized["none_val"] is None


def test_to_dict_and_summary_dict(app, sample_project):
    """Test serialization functions to_dict and to_summary_dict."""
    with app.app_context():
        run = AnalysisRun(
            project_id=sample_project,
            status=AnalysisStatus.COMPLETED,
            quality_gate_status=QualityGateStatus.PASSED,
            quality_score=92.5,
            total_issues_count=8,
            new_issues_count=3,
            fixed_issues_count=2,
            progress=100,
            error_message="No error"
        )
        db.session.add(run)
        db.session.commit()

        # Test to_dict
        d = run.to_dict()
        assert d["id"] == run.id
        assert d["status"] == "COMPLETED"
        assert d["quality_gate_status"] == "PASSED"
        assert d["quality_score"] == 92.5
        assert d["total_issues_count"] == 8
        assert d["new_issues_count"] == 3
        assert d["recurrent_issues_count"] == 5  # 8 - 3
        assert d["fixed_issues_count"] == 2
        assert d["progress"] == 100
        assert d["error_message"] == "No error"

        # Test to_summary_dict
        summary = run.to_summary_dict()
        assert summary["id"] == run.id
        assert summary["status"] == "COMPLETED"
        assert summary["quality_gate_status"] == "PASSED"
        assert summary["quality_score"] == 92.5
        assert summary["total_issues_count"] == 8
        assert summary["new_issues_count"] == 3
        assert summary["recurrent_issues_count"] == 5
        assert summary["fixed_issues_count"] == 2


def test_baseline_relationship(app, sample_project):
    """Test self-referential baseline relationship of AnalysisRun."""
    with app.app_context():
        # Create baseline run
        baseline = AnalysisRun(
            project_id=sample_project,
            status=AnalysisStatus.COMPLETED,
            quality_score=80.0
        )
        db.session.add(baseline)
        db.session.commit()

        # Create subsequent run
        subsequent = AnalysisRun(
            project_id=sample_project,
            status=AnalysisStatus.COMPLETED,
            baseline_analysis_id=baseline.id,
            quality_score=85.0
        )
        db.session.add(subsequent)
        db.session.commit()

        # Assert relationship both ways
        assert subsequent.baseline == baseline
        assert baseline.subsequent_runs.count() == 1
        assert baseline.subsequent_runs.first() == subsequent
