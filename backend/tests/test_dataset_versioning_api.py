"""
Tests de integración para los endpoints de versionado de datasets.
"""
import pytest
import io
from flask_jwt_extended import create_access_token
from werkzeug.security import generate_password_hash
from models.dataset import Dataset
from models.project import Project
from models.user import User
from extensions import db


class TestDatasetVersioningAPI:
    """Tests para los endpoints de versionado de datasets."""

    @pytest.fixture(autouse=True)
    def setup(self, app, client):
        """Setup para cada test."""
        self.app = app
        self.client = client
        
        with app.app_context():
            # Crear usuario de prueba
            self.user = User(
                username='testuser_versioning',
                email='testversioning@example.com',
                password_hash=generate_password_hash('testpassword123')
            )
            db.session.add(self.user)
            db.session.commit()
            
            self.user_id = self.user.id
            
            # Crear proyecto de prueba
            self.project = Project(
                name='Test Project Versioning',
                description='Project for versioning tests',
                owner_id=self.user_id
            )
            db.session.add(self.project)
            db.session.commit()
            
            self.project_id = self.project.id
            
            # Crear dataset inicial (v1)
            self.dataset_v1 = Dataset(
                name='Test Dataset',
                description='Initial version',
                project_id=self.project_id,
                file_path='/fake/path/v1.csv',
                file_size=1000,
                row_count=100,
                column_count=5,
                version=1,
                is_latest=True
            )
            db.session.add(self.dataset_v1)
            db.session.commit()
            
            self.dataset_v1_id = self.dataset_v1.id
            
            # Crear token JWT
            self.access_token = create_access_token(identity=str(self.user_id))
            self.headers = {
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/json'
            }

    def test_get_versions_single_version(self):
        """Test obtener versiones cuando solo hay una versión."""
        response = self.client.get(
            f'/api/projects/{self.project_id}/datasets/{self.dataset_v1_id}/versions',
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['total_versions'] == 1
        assert len(data['data']['versions']) == 1
        assert data['data']['versions'][0]['version'] == 1

    def test_get_versions_multiple_versions(self):
        """Test obtener versiones cuando hay múltiples versiones."""
        with self.app.app_context():
            # Crear v2
            dataset_v2 = Dataset(
                name='Test Dataset',
                description='Second version',
                project_id=self.project_id,
                file_path='/fake/path/v2.csv',
                file_size=1200,
                row_count=120,
                column_count=5,
                version=2,
                version_tag='corregido',
                parent_dataset_id=self.dataset_v1_id,
                is_latest=True
            )
            db.session.add(dataset_v2)
            
            # Actualizar v1 para que no sea latest
            v1 = Dataset.query.get(self.dataset_v1_id)
            v1.is_latest = False
            db.session.commit()
            
            dataset_v2_id = dataset_v2.id
        
        response = self.client.get(
            f'/api/projects/{self.project_id}/datasets/{dataset_v2_id}/versions',
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['data']['total_versions'] == 2
        
        versions = data['data']['versions']
        assert len(versions) == 2
        # get_version_history() devuelve versiones en orden ascendente (v1 → v2)
        assert versions[0]['version'] <= versions[1]['version']

    def test_get_versions_unauthorized(self):
        """Test que usuarios no autorizados no pueden ver versiones."""
        with self.app.app_context():
            # Crear otro usuario
            other_user = User(
                username='otheruser_versioning',
                email='otherversioning@example.com',
                password_hash=generate_password_hash('otherpassword123')
            )
            db.session.add(other_user)
            db.session.commit()
            
            other_token = create_access_token(identity=str(other_user.id))
        
        response = self.client.get(
            f'/api/projects/{self.project_id}/datasets/{self.dataset_v1_id}/versions',
            headers={'Authorization': f'Bearer {other_token}'}
        )
        
        assert response.status_code == 403

    def test_get_versions_not_found(self):
        """Test obtener versiones de dataset inexistente."""
        response = self.client.get(
            f'/api/projects/{self.project_id}/datasets/99999/versions',
            headers=self.headers
        )
        
        assert response.status_code == 404

    def test_compare_versions_same_chain(self):
        """Test comparar versiones de la misma cadena."""
        with self.app.app_context():
            # Crear v2
            dataset_v2 = Dataset(
                name='Test Dataset',
                description='Second version',
                project_id=self.project_id,
                file_path='/fake/path/v2.csv',
                file_size=1200,
                row_count=120,
                column_count=6,
                version=2,
                parent_dataset_id=self.dataset_v1_id,
                is_latest=True
            )
            db.session.add(dataset_v2)
            
            v1 = Dataset.query.get(self.dataset_v1_id)
            v1.is_latest = False
            db.session.commit()
            
            dataset_v2_id = dataset_v2.id
        
        response = self.client.get(
            f'/api/projects/{self.project_id}/datasets/{self.dataset_v1_id}/compare/{dataset_v2_id}',
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert 'dataset_a' in data['data']
        assert 'dataset_b' in data['data']
        assert 'comparison' in data['data']
        
        comparison = data['data']['comparison']
        assert comparison['rows_diff'] == 20  # 120 - 100
        assert comparison['columns_diff'] == 1  # 6 - 5

    def test_compare_versions_different_chains(self):
        """Test que no se pueden comparar versiones de diferentes cadenas."""
        with self.app.app_context():
            # Crear otro dataset independiente
            other_dataset = Dataset(
                name='Other Dataset',
                description='Different dataset',
                project_id=self.project_id,
                file_path='/fake/path/other.csv',
                file_size=500,
                row_count=50,
                column_count=3,
                version=1,
                is_latest=True
            )
            db.session.add(other_dataset)
            db.session.commit()
            
            other_dataset_id = other_dataset.id
        
        response = self.client.get(
            f'/api/projects/{self.project_id}/datasets/{self.dataset_v1_id}/compare/{other_dataset_id}',
            headers=self.headers
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'mismo dataset' in data['message'].lower()

    def test_compare_versions_not_found(self):
        """Test comparar con dataset inexistente."""
        response = self.client.get(
            f'/api/projects/{self.project_id}/datasets/{self.dataset_v1_id}/compare/99999',
            headers=self.headers
        )
        
        assert response.status_code == 404

    @pytest.mark.skip(reason="Requiere MinIO en ejecución (solo docker-compose)")
    def test_upload_new_version(self):
        """Test subir nueva versión de un dataset."""
        csv_content = b'col1,col2,col3\n1,2,3\n4,5,6\n'
        
        data = {
            'file': (io.BytesIO(csv_content), 'test_v2.csv'),
            'name': 'Test Dataset v2',
            'description': 'Updated version',
            'version_tag': 'v2-fixed'
        }
        
        response = self.client.post(
            f'/api/projects/{self.project_id}/datasets/{self.dataset_v1_id}/new-version',
            headers={'Authorization': f'Bearer {self.access_token}'},
            data=data,
            content_type='multipart/form-data'
        )
        
        assert response.status_code == 201
        result = response.get_json()
        assert result['success'] is True
        
        new_dataset = result['data']
        assert new_dataset['version'] == 2
        assert new_dataset['version_tag'] == 'v2-fixed'
        assert new_dataset['parent_dataset_id'] == self.dataset_v1_id
        assert new_dataset['is_latest'] is True
        
        # Verificar que v1 ya no es latest
        with self.app.app_context():
            v1 = Dataset.query.get(self.dataset_v1_id)
            assert v1.is_latest is False

    def test_upload_new_version_no_file(self):
        """Test que falla si no se proporciona archivo."""
        data = {
            'name': 'Test Dataset v2',
            'description': 'Updated version'
        }
        
        response = self.client.post(
            f'/api/projects/{self.project_id}/datasets/{self.dataset_v1_id}/new-version',
            headers={'Authorization': f'Bearer {self.access_token}'},
            data=data,
            content_type='multipart/form-data'
        )
        
        assert response.status_code == 400

    def test_upload_new_version_unauthorized(self):
        """Test que usuarios no autorizados no pueden subir versiones."""
        with self.app.app_context():
            other_user = User(
                username='unauthorized_versioning',
                email='unauth_versioning@example.com',
                password_hash=generate_password_hash('password123')
            )
            db.session.add(other_user)
            db.session.commit()
            
            other_token = create_access_token(identity=str(other_user.id))
        
        csv_content = b'col1,col2\n1,2\n'
        data = {
            'file': (io.BytesIO(csv_content), 'test.csv'),
            'name': 'Unauthorized Upload'
        }
        
        response = self.client.post(
            f'/api/projects/{self.project_id}/datasets/{self.dataset_v1_id}/new-version',
            headers={'Authorization': f'Bearer {other_token}'},
            data=data,
            content_type='multipart/form-data'
        )
        
        assert response.status_code == 403


class TestDatasetVersioningModel:
    """Tests para los métodos del modelo Dataset relacionados con versionado."""

    @pytest.fixture(autouse=True)
    def setup(self, app):
        """Setup para cada test."""
        self.app = app
        
        with app.app_context():
            # Crear usuario y proyecto
            self.user = User(
                username='model_test_user',
                email='modeltest@example.com',
                password_hash=generate_password_hash('testpassword')
            )
            db.session.add(self.user)
            db.session.commit()
            
            self.project = Project(
                name='Model Test Project',
                owner_id=self.user.id
            )
            db.session.add(self.project)
            db.session.commit()
            
            self.project_id = self.project.id

    def test_get_root_dataset_single(self):
        """Test get_root_dataset cuando solo hay una versión."""
        with self.app.app_context():
            dataset = Dataset(
                name='Single Dataset',
                project_id=self.project_id,
                file_path='/fake/path.csv',
                version=1,
                is_latest=True
            )
            db.session.add(dataset)
            db.session.commit()
            
            root = dataset.get_root_dataset()
            assert root.id == dataset.id

    def test_get_root_dataset_chain(self):
        """Test get_root_dataset con cadena de versiones."""
        with self.app.app_context():
            v1 = Dataset(
                name='Chain Dataset',
                project_id=self.project_id,
                file_path='/fake/v1.csv',
                version=1,
                is_latest=False
            )
            db.session.add(v1)
            db.session.commit()
            
            v2 = Dataset(
                name='Chain Dataset',
                project_id=self.project_id,
                file_path='/fake/v2.csv',
                version=2,
                parent_dataset_id=v1.id,
                is_latest=False
            )
            db.session.add(v2)
            db.session.commit()
            
            v3 = Dataset(
                name='Chain Dataset',
                project_id=self.project_id,
                file_path='/fake/v3.csv',
                version=3,
                parent_dataset_id=v2.id,
                is_latest=True
            )
            db.session.add(v3)
            db.session.commit()
            
            # Desde cualquier versión, el root debe ser v1
            assert v1.get_root_dataset().id == v1.id
            assert v2.get_root_dataset().id == v1.id
            assert v3.get_root_dataset().id == v1.id

    def test_get_version_history(self):
        """Test get_version_history retorna todas las versiones ordenadas."""
        with self.app.app_context():
            v1 = Dataset(
                name='History Dataset',
                project_id=self.project_id,
                file_path='/fake/v1.csv',
                version=1,
                is_latest=False
            )
            db.session.add(v1)
            db.session.commit()
            
            v2 = Dataset(
                name='History Dataset',
                project_id=self.project_id,
                file_path='/fake/v2.csv',
                version=2,
                parent_dataset_id=v1.id,
                is_latest=True
            )
            db.session.add(v2)
            db.session.commit()
            
            history = v2.get_version_history()
            
            assert len(history) == 2
            # get_version_history() devuelve versiones en orden ascendente (v1 → v2)
            assert history[0].version <= history[1].version

    def test_to_dict_includes_versioning_fields(self):
        """Test que to_dict incluye campos de versionado."""
        with self.app.app_context():
            dataset = Dataset(
                name='Dict Test Dataset',
                project_id=self.project_id,
                file_path='/fake/path.csv',
                version=2,
                version_tag='v2-test',
                parent_dataset_id=1,
                is_latest=True
            )
            db.session.add(dataset)
            db.session.commit()
            
            d = dataset.to_dict()
            
            assert 'version' in d
            assert 'version_tag' in d
            assert 'parent_dataset_id' in d
            assert 'is_latest' in d
            
            assert d['version'] == 2
            assert d['version_tag'] == 'v2-test'
            assert d['parent_dataset_id'] == 1
            assert d['is_latest'] is True
