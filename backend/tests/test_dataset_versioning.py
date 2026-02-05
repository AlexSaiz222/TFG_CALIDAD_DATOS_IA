"""
Tests for Dataset versioning functionality.

These tests verify the versioning methods added to the Dataset model:
- get_root_dataset()
- get_version_history()
- get_latest_version()
- get_version_count()
- is_root_version()
- get_previous_version()
- get_next_versions()
"""
import pytest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
from extensions import db
from models.dataset import Dataset
from models.project import Project
from models.user import User


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
def client(app):
    """Create a test client"""
    return app.test_client()


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
            description='A test project',
            owner_id=sample_user
        )
        db.session.add(project)
        db.session.commit()
        return project.id


@pytest.fixture
def dataset_chain(app, sample_project):
    """Create a chain of dataset versions for testing"""
    with app.app_context():
        # Create root dataset (v1)
        v1 = Dataset(
            name='test_dataset.csv',
            project_id=sample_project,
            file_path='/data/test_dataset_v1.csv',
            version=1,
            version_tag='original',
            is_latest=False
        )
        db.session.add(v1)
        db.session.commit()
        
        # Create v2 (child of v1)
        v2 = Dataset(
            name='test_dataset.csv',
            project_id=sample_project,
            file_path='/data/test_dataset_v2.csv',
            parent_dataset_id=v1.id,
            version=2,
            version_tag='corregido',
            is_latest=False
        )
        db.session.add(v2)
        db.session.commit()
        
        # Create v3 (child of v2) - latest
        v3 = Dataset(
            name='test_dataset.csv',
            project_id=sample_project,
            file_path='/data/test_dataset_v3.csv',
            parent_dataset_id=v2.id,
            version=3,
            version_tag='final',
            is_latest=True
        )
        db.session.add(v3)
        db.session.commit()
        
        return {'v1': v1.id, 'v2': v2.id, 'v3': v3.id}


class TestDatasetVersioning:
    """Test suite for Dataset versioning functionality"""
    
    def test_new_dataset_defaults(self, app, sample_project):
        """Test that new datasets have correct default versioning values"""
        with app.app_context():
            dataset = Dataset(
                name='new_dataset.csv',
                project_id=sample_project,
                file_path='/data/new_dataset.csv'
            )
            db.session.add(dataset)
            db.session.commit()
            
            # Reload from database
            dataset = Dataset.query.get(dataset.id)
            
            assert dataset.parent_dataset_id is None
            assert dataset.version == 1
            assert dataset.version_tag is None
            assert dataset.is_latest == True
    
    def test_get_root_dataset_from_root(self, app, dataset_chain):
        """Test get_root_dataset() when called on root dataset"""
        with app.app_context():
            v1 = Dataset.query.get(dataset_chain['v1'])
            root = v1.get_root_dataset()
            
            assert root.id == v1.id
            assert root.version == 1
    
    def test_get_root_dataset_from_child(self, app, dataset_chain):
        """Test get_root_dataset() when called on child dataset"""
        with app.app_context():
            v3 = Dataset.query.get(dataset_chain['v3'])
            root = v3.get_root_dataset()
            
            assert root.id == dataset_chain['v1']
            assert root.version == 1
    
    def test_get_version_history(self, app, dataset_chain):
        """Test get_version_history() returns all versions in order"""
        with app.app_context():
            v2 = Dataset.query.get(dataset_chain['v2'])
            history = v2.get_version_history()
            
            assert len(history) == 3
            assert history[0].version == 1
            assert history[1].version == 2
            assert history[2].version == 3
    
    def test_get_latest_version(self, app, dataset_chain):
        """Test get_latest_version() returns the version marked as latest"""
        with app.app_context():
            v1 = Dataset.query.get(dataset_chain['v1'])
            latest = v1.get_latest_version()
            
            assert latest.id == dataset_chain['v3']
            assert latest.is_latest == True
            assert latest.version_tag == 'final'
    
    def test_get_version_count(self, app, dataset_chain):
        """Test get_version_count() returns correct count"""
        with app.app_context():
            v2 = Dataset.query.get(dataset_chain['v2'])
            count = v2.get_version_count()
            
            assert count == 3
    
    def test_is_root_version(self, app, dataset_chain):
        """Test is_root_version() correctly identifies root"""
        with app.app_context():
            v1 = Dataset.query.get(dataset_chain['v1'])
            v3 = Dataset.query.get(dataset_chain['v3'])
            
            assert v1.is_root_version() == True
            assert v3.is_root_version() == False
    
    def test_get_previous_version(self, app, dataset_chain):
        """Test get_previous_version() returns parent"""
        with app.app_context():
            v3 = Dataset.query.get(dataset_chain['v3'])
            previous = v3.get_previous_version()
            
            assert previous.id == dataset_chain['v2']
            assert previous.version == 2
    
    def test_get_previous_version_on_root(self, app, dataset_chain):
        """Test get_previous_version() returns None for root"""
        with app.app_context():
            v1 = Dataset.query.get(dataset_chain['v1'])
            previous = v1.get_previous_version()
            
            assert previous is None
    
    def test_get_next_versions(self, app, dataset_chain):
        """Test get_next_versions() returns child versions"""
        with app.app_context():
            v1 = Dataset.query.get(dataset_chain['v1'])
            next_versions = v1.get_next_versions()
            
            assert len(next_versions) == 1
            assert next_versions[0].id == dataset_chain['v2']
    
    def test_to_dict_includes_versioning_fields(self, app, dataset_chain):
        """Test to_dict() includes versioning fields"""
        with app.app_context():
            v2 = Dataset.query.get(dataset_chain['v2'])
            data = v2.to_dict()
            
            assert 'parent_dataset_id' in data
            assert 'version' in data
            assert 'version_tag' in data
            assert 'is_latest' in data
            
            assert data['parent_dataset_id'] == dataset_chain['v1']
            assert data['version'] == 2
            assert data['version_tag'] == 'corregido'
            assert data['is_latest'] == False


class TestDatasetVersioningEdgeCases:
    """Test edge cases for Dataset versioning"""
    
    def test_single_dataset_version_history(self, app, sample_project):
        """Test version history with single dataset (no versions)"""
        with app.app_context():
            dataset = Dataset(
                name='single_dataset.csv',
                project_id=sample_project,
                file_path='/data/single.csv',
                version=1,
                is_latest=True
            )
            db.session.add(dataset)
            db.session.commit()
            
            history = dataset.get_version_history()
            
            assert len(history) == 1
            assert history[0].id == dataset.id
    
    def test_branching_versions(self, app, sample_project):
        """Test handling of branching versions (multiple children)"""
        with app.app_context():
            # Create root
            root = Dataset(
                name='branching.csv',
                project_id=sample_project,
                file_path='/data/branching_v1.csv',
                version=1,
                is_latest=False
            )
            db.session.add(root)
            db.session.commit()
            
            # Create two branches from root
            branch_a = Dataset(
                name='branching.csv',
                project_id=sample_project,
                file_path='/data/branching_v2a.csv',
                parent_dataset_id=root.id,
                version=2,
                version_tag='branch-a',
                is_latest=False
            )
            branch_b = Dataset(
                name='branching.csv',
                project_id=sample_project,
                file_path='/data/branching_v2b.csv',
                parent_dataset_id=root.id,
                version=2,
                version_tag='branch-b',
                is_latest=True
            )
            db.session.add(branch_a)
            db.session.add(branch_b)
            db.session.commit()
            
            # Get next versions from root
            next_versions = root.get_next_versions()
            
            assert len(next_versions) == 2
            
            # Version history should include all
            history = root.get_version_history()
            assert len(history) == 3


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
