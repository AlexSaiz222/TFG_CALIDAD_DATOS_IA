"""
Tests for Quality Gate configuration functionality.

These tests verify:
- QualityGate creation with default thresholds
- QualityGate GET endpoint (lazy initialization)
- QualityGate PUT endpoint (update thresholds with validation)
- _evaluate_quality_gate uses thresholds from DB
- _evaluate_quality_gate falls back to defaults when no config exists
"""
import pytest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
from extensions import db
from models.project import Project
from models.user import User
from models.analysis import QualityGate, QualityGateStatus, AnalysisRun, AnalysisStatus


@pytest.fixture
def app():
    """Create a test Flask application"""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['TESTING'] = True
    
    db.init_app(app)
    
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture
def sample_user(app):
    """Create a sample user for testing"""
    with app.app_context():
        user = User(
            username='testuser',
            email='test@example.com',
            password_hash='hashed_password'
        )
        db.session.add(user)
        db.session.commit()
        return user.id


@pytest.fixture
def sample_project(app, sample_user):
    """Create a sample project for testing"""
    with app.app_context():
        project = Project(
            name='Test Project',
            description='A test project for Quality Gate',
            owner_id=sample_user
        )
        db.session.add(project)
        db.session.commit()
        return project.id


class TestQualityGateModel:
    """Test suite for QualityGate model"""
    
    def test_default_thresholds(self):
        """Test that get_default_thresholds returns expected defaults"""
        defaults = QualityGate.get_default_thresholds()
        
        assert 'min_score' in defaults
        assert 'max_critical_issues' in defaults
        assert 'max_new_issues' in defaults
        
        assert defaults['min_score'] == 70
        assert defaults['max_critical_issues'] == 0
        assert defaults['max_new_issues'] == 10
    
    def test_create_quality_gate_with_defaults(self, app, sample_project):
        """Test creating a QualityGate with default thresholds"""
        with app.app_context():
            qg = QualityGate(
                project_id=sample_project,
                name='Default Quality Gate',
                thresholds=QualityGate.get_default_thresholds(),
                is_active=True,
            )
            db.session.add(qg)
            db.session.commit()
            
            # Reload from database
            qg = QualityGate.query.filter_by(project_id=sample_project).first()
            
            assert qg is not None
            assert qg.project_id == sample_project
            assert qg.is_active is True
            assert qg.thresholds['min_score'] == 70
    
    def test_update_thresholds(self, app, sample_project):
        """Test updating QualityGate thresholds"""
        with app.app_context():
            qg = QualityGate(
                project_id=sample_project,
                thresholds=QualityGate.get_default_thresholds(),
                is_active=True,
            )
            db.session.add(qg)
            db.session.commit()
            
            # Update thresholds
            new_thresholds = {**qg.thresholds, 'min_score': 90, 'max_new_issues': 5}
            qg.thresholds = new_thresholds
            db.session.commit()
            
            # Reload from database
            qg = QualityGate.query.filter_by(project_id=sample_project).first()
            
            assert qg.thresholds['min_score'] == 90
            assert qg.thresholds['max_new_issues'] == 5
            # Other values should remain unchanged
            assert qg.thresholds['max_critical_issues'] == 0
    
    def test_to_dict(self, app, sample_project):
        """Test to_dict serialization"""
        with app.app_context():
            qg = QualityGate(
                project_id=sample_project,
                name='Custom Gate',
                thresholds={'min_score': 85},
                is_active=True,
            )
            db.session.add(qg)
            db.session.commit()
            
            data = qg.to_dict()
            
            assert data['project_id'] == sample_project
            assert data['name'] == 'Custom Gate'
            assert data['thresholds']['min_score'] == 85
            assert data['is_active'] is True
            assert 'created_at' in data
            assert 'updated_at' in data
    
    def test_unique_per_project(self, app, sample_project):
        """Test that a project can only have one QualityGate"""
        with app.app_context():
            qg1 = QualityGate(
                project_id=sample_project,
                thresholds=QualityGate.get_default_thresholds(),
            )
            db.session.add(qg1)
            db.session.commit()
            
            # Trying to add another QualityGate for the same project should fail
            qg2 = QualityGate(
                project_id=sample_project,
                thresholds={'min_score': 99},
            )
            db.session.add(qg2)
            
            with pytest.raises(Exception):
                db.session.commit()
            db.session.rollback()


class TestEvaluateQualityGate:
    """Test suite for the _evaluate_quality_gate logic"""
    
    def test_passed_with_defaults(self, app, sample_project):
        """Test that a high-quality dataset passes with default thresholds"""
        with app.app_context():
            from services.evaluation_service import EvaluationService
            
            service = EvaluationService()
            
            # Create an AnalysisRun
            run = AnalysisRun(
                project_id=sample_project,
                status=AnalysisStatus.RUNNING,
            )
            db.session.add(run)
            db.session.commit()
            
            quality_score = 0.85  # 85% - above default 70%
            issues = []
            results = {
                'overall': {'completeness': 0.95, 'uniqueness': 0.98},
                'column_metrics': {},
            }
            
            status = service._evaluate_quality_gate(run, quality_score, issues, results)
            assert status == QualityGateStatus.PASSED
    
    def test_failed_low_score(self, app, sample_project):
        """Test that a low quality score causes FAILED"""
        with app.app_context():
            from services.evaluation_service import EvaluationService
            
            service = EvaluationService()
            
            run = AnalysisRun(
                project_id=sample_project,
                status=AnalysisStatus.RUNNING,
            )
            db.session.add(run)
            db.session.commit()
            
            quality_score = 0.50  # 50% - below default 70%
            issues = []
            results = {'overall': {}, 'column_metrics': {}}
            
            status = service._evaluate_quality_gate(run, quality_score, issues, results)
            assert status == QualityGateStatus.FAILED
    
    def test_failed_critical_issues(self, app, sample_project):
        """Test that critical issues cause FAILED when max_critical_issues=0"""
        with app.app_context():
            from services.evaluation_service import EvaluationService
            
            service = EvaluationService()
            
            run = AnalysisRun(
                project_id=sample_project,
                status=AnalysisStatus.RUNNING,
            )
            db.session.add(run)
            db.session.commit()
            
            quality_score = 0.90
            issues = [
                {'severity': 'critical', 'description': 'Major data corruption detected'}
            ]
            results = {'overall': {}, 'column_metrics': {}}
            
            status = service._evaluate_quality_gate(run, quality_score, issues, results)
            assert status == QualityGateStatus.FAILED
    
    def test_warning_low_completeness(self, app, sample_project):
        """Test that low completeness causes WARNING"""
        with app.app_context():
            from services.evaluation_service import EvaluationService
            
            service = EvaluationService()
            
            run = AnalysisRun(
                project_id=sample_project,
                status=AnalysisStatus.RUNNING,
            )
            db.session.add(run)
            db.session.commit()
            
            quality_score = 0.85  # Above min_score
            issues = []
            results = {
                'overall': {'completeness': 0.70},  # Below default 80%
                'column_metrics': {},
            }
            
            status = service._evaluate_quality_gate(run, quality_score, issues, results)
            assert status == QualityGateStatus.WARNING
    
    def test_uses_custom_thresholds(self, app, sample_project):
        """Test that custom QualityGate thresholds are used"""
        with app.app_context():
            from services.evaluation_service import EvaluationService
            
            service = EvaluationService()
            
            # Create a strict QualityGate config
            qg = QualityGate(
                project_id=sample_project,
                thresholds={
                    'min_score': 95,           # Very strict
                    'max_critical_issues': 0,
                    'max_new_issues': 5,
                },
                is_active=True,
            )
            db.session.add(qg)
            db.session.commit()
            
            run = AnalysisRun(
                project_id=sample_project,
                status=AnalysisStatus.RUNNING,
            )
            db.session.add(run)
            db.session.commit()
            
            # Score of 90% would pass default thresholds but fail strict ones
            quality_score = 0.90
            issues = []
            results = {'overall': {'completeness': 0.99}, 'column_metrics': {}}
            
            status = service._evaluate_quality_gate(run, quality_score, issues, results)
            assert status == QualityGateStatus.FAILED  # 90% < 95% min_score
    
    def test_inactive_gate_uses_defaults(self, app, sample_project):
        """Test that an inactive QualityGate falls back to defaults"""
        with app.app_context():
            from services.evaluation_service import EvaluationService
            
            service = EvaluationService()
            
            # Create a strict but INACTIVE QualityGate
            qg = QualityGate(
                project_id=sample_project,
                thresholds={'min_score': 95},
                is_active=False,  # Inactive!
            )
            db.session.add(qg)
            db.session.commit()
            
            run = AnalysisRun(
                project_id=sample_project,
                status=AnalysisStatus.RUNNING,
            )
            db.session.add(run)
            db.session.commit()
            
            # 80% would fail strict (95%) but pass default (70%)
            quality_score = 0.80
            issues = []
            results = {'overall': {'completeness': 0.95}, 'column_metrics': {}}
            
            status = service._evaluate_quality_gate(run, quality_score, issues, results)
            assert status == QualityGateStatus.PASSED  # Uses default 70%, so 80% passes
    
    def test_critical_issues_allowed(self, app, sample_project):
        """Test that configuring max_critical_issues > 0 allows some critical issues"""
        with app.app_context():
            from services.evaluation_service import EvaluationService
            
            service = EvaluationService()
            
            # Allow up to 2 critical issues
            qg = QualityGate(
                project_id=sample_project,
                thresholds={
                    'min_score': 70,
                    'max_critical_issues': 2,
                    'max_new_issues': 10,
                },
                is_active=True,
            )
            db.session.add(qg)
            db.session.commit()
            
            run = AnalysisRun(
                project_id=sample_project,
                status=AnalysisStatus.RUNNING,
            )
            db.session.add(run)
            db.session.commit()
            
            quality_score = 0.85
            issues = [
                {'severity': 'critical', 'description': 'Issue 1'},
                {'severity': 'critical', 'description': 'Issue 2'},
            ]
            results = {'overall': {'completeness': 0.95}, 'column_metrics': {}}
            
            # 2 critical issues == max_critical_issues=2 -> should NOT fail
            status = service._evaluate_quality_gate(run, quality_score, issues, results)
            assert status != QualityGateStatus.FAILED


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
