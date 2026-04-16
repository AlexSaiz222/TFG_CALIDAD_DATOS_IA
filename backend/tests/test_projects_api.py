"""
Tests for project management endpoints.

Covers:
- GET  /api/projects/             — list projects (own vs other users)
- POST /api/projects/             — create project
- GET  /api/projects/<id>         — get single project
- PUT  /api/projects/<id>         — update project
- DELETE /api/projects/<id>       — delete project
- GET  /api/projects/<id>/quality-gate  — lazy init + retrieval
- PUT  /api/projects/<id>/quality-gate  — update thresholds with validation
"""
import pytest
from extensions import db
from models.project import Project
from models.analysis import QualityGate

BASE = "/api/projects"


# ---------------------------------------------------------------------------
# GET /api/projects/
# ---------------------------------------------------------------------------

class TestListProjects:
    def test_list_projects_empty(self, client, auth_headers):
        """A new user has no projects."""
        resp = client.get(f"{BASE}/", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert data["projects"] == []

    def test_list_projects_returns_only_own(self, client, app,
                                            auth_headers, other_user):
        """Projects owned by other users are not returned."""
        with app.app_context():
            other_proj = Project(name="Other Project", owner_id=other_user,
                                 metrics_config=[])
            db.session.add(other_proj)
            db.session.commit()

        resp = client.get(f"{BASE}/", headers=auth_headers)
        data = resp.get_json()
        assert data["projects"] == []

    def test_list_projects_shows_own(self, client, auth_headers, sample_project):
        """Own projects are returned."""
        resp = client.get(f"{BASE}/", headers=auth_headers)
        data = resp.get_json()
        assert len(data["projects"]) == 1
        assert data["projects"][0]["name"] == "Test Project"

    def test_list_projects_requires_auth(self, client):
        """Unauthenticated request returns 401."""
        resp = client.get(f"{BASE}/")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /api/projects/
# ---------------------------------------------------------------------------

class TestCreateProject:
    def test_create_project_success(self, client, auth_headers):
        """Valid payload creates a project and returns 201."""
        resp = client.post(f"{BASE}/", json={
            "name": "New Project",
            "description": "My new project",
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["success"] is True
        assert data["data"]["name"] == "New Project"
        assert "id" in data["data"]

    def test_create_project_minimal(self, client, auth_headers):
        """Only name is required; description is optional."""
        resp = client.post(f"{BASE}/", json={"name": "Minimal"},
                           headers=auth_headers)
        assert resp.status_code == 201

    def test_create_project_missing_name(self, client, auth_headers):
        """Missing name returns 400."""
        resp = client.post(f"{BASE}/", json={"description": "No name"},
                           headers=auth_headers)
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["success"] is False

    def test_create_project_requires_auth(self, client):
        """Unauthenticated request returns 401."""
        resp = client.post(f"{BASE}/", json={"name": "X"})
        assert resp.status_code == 401

    def test_create_project_with_metrics_config(self, client, auth_headers):
        """Custom metrics_config is stored."""
        custom_metrics = [{"id": "uniqueness", "parameters": {}}]
        resp = client.post(f"{BASE}/", json={
            "name": "Custom Metrics Project",
            "metrics_config": custom_metrics,
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["data"]["metrics_config"] == custom_metrics


# ---------------------------------------------------------------------------
# GET /api/projects/<id>
# ---------------------------------------------------------------------------

class TestGetProject:
    def test_get_own_project(self, client, auth_headers, sample_project):
        """Owner can retrieve their project."""
        resp = client.get(f"{BASE}/{sample_project}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert data["data"]["id"] == sample_project

    def test_get_project_not_found(self, client, auth_headers):
        """Non-existent project returns 404."""
        resp = client.get(f"{BASE}/99999", headers=auth_headers)
        assert resp.status_code == 404

    def test_get_other_users_project(self, client, other_auth_headers, sample_project):
        """Accessing another user's project returns 403."""
        resp = client.get(f"{BASE}/{sample_project}", headers=other_auth_headers)
        assert resp.status_code == 403

    def test_get_project_requires_auth(self, client, sample_project):
        """Unauthenticated request returns 401."""
        resp = client.get(f"{BASE}/{sample_project}")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# PUT /api/projects/<id>
# ---------------------------------------------------------------------------

class TestUpdateProject:
    def test_update_name(self, client, auth_headers, sample_project):
        """Owner can rename a project."""
        resp = client.put(f"{BASE}/{sample_project}",
                          json={"name": "Renamed"}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["data"]["name"] == "Renamed"

    def test_update_description(self, client, auth_headers, sample_project):
        """Owner can update project description."""
        resp = client.put(f"{BASE}/{sample_project}",
                          json={"description": "Updated description"},
                          headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["data"]["description"] == "Updated description"

    def test_update_metrics_config(self, client, auth_headers, sample_project):
        """Owner can update metrics_config."""
        new_config = [{"id": "uniqueness", "parameters": {}}]
        resp = client.put(f"{BASE}/{sample_project}",
                          json={"metrics_config": new_config},
                          headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["data"]["metrics_config"] == new_config

    def test_update_not_found(self, client, auth_headers):
        """Updating a non-existent project returns 404."""
        resp = client.put(f"{BASE}/99999", json={"name": "X"},
                          headers=auth_headers)
        assert resp.status_code == 404

    def test_update_other_users_project(self, client, other_auth_headers,
                                        sample_project):
        """Updating another user's project returns 403."""
        resp = client.put(f"{BASE}/{sample_project}",
                          json={"name": "Hack"}, headers=other_auth_headers)
        assert resp.status_code == 403

    def test_update_requires_auth(self, client, sample_project):
        resp = client.put(f"{BASE}/{sample_project}", json={"name": "X"})
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# DELETE /api/projects/<id>
# ---------------------------------------------------------------------------

class TestDeleteProject:
    def test_delete_own_project(self, client, auth_headers, sample_project):
        """Owner can delete their project."""
        resp = client.delete(f"{BASE}/{sample_project}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True

        # Verify it's gone
        resp2 = client.get(f"{BASE}/{sample_project}", headers=auth_headers)
        assert resp2.status_code == 404

    def test_delete_not_found(self, client, auth_headers):
        """Deleting a non-existent project returns 404."""
        resp = client.delete(f"{BASE}/99999", headers=auth_headers)
        assert resp.status_code == 404

    def test_delete_other_users_project(self, client, other_auth_headers,
                                        sample_project):
        """Deleting another user's project returns 403."""
        resp = client.delete(f"{BASE}/{sample_project}",
                             headers=other_auth_headers)
        assert resp.status_code == 403

    def test_delete_requires_auth(self, client, sample_project):
        resp = client.delete(f"{BASE}/{sample_project}")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/projects/<id>/quality-gate  (lazy initialization)
# ---------------------------------------------------------------------------

class TestGetQualityGate:
    def _url(self, project_id):
        return f"{BASE}/{project_id}/quality-gate"

    def test_get_creates_default_gate(self, client, auth_headers, sample_project):
        """First GET creates a QualityGate with default thresholds."""
        resp = client.get(self._url(sample_project), headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        qg = data["data"]
        assert qg["thresholds"]["min_score"] == 70
        assert qg["thresholds"]["max_critical_issues"] == 0
        assert qg["thresholds"]["max_new_issues"] == 10
        assert qg["is_active"] is True

    def test_get_returns_existing_gate(self, client, app, auth_headers,
                                       sample_project):
        """Subsequent GET does not create a duplicate."""
        client.get(self._url(sample_project), headers=auth_headers)
        client.get(self._url(sample_project), headers=auth_headers)

        with app.app_context():
            count = QualityGate.query.filter_by(project_id=sample_project).count()
        assert count == 1

    def test_get_not_found(self, client, auth_headers):
        resp = client.get(f"{BASE}/99999/quality-gate", headers=auth_headers)
        assert resp.status_code == 404

    def test_get_other_users_gate(self, client, other_auth_headers, sample_project):
        resp = client.get(self._url(sample_project), headers=other_auth_headers)
        assert resp.status_code == 403

    def test_get_requires_auth(self, client, sample_project):
        resp = client.get(self._url(sample_project))
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# PUT /api/projects/<id>/quality-gate
# ---------------------------------------------------------------------------

class TestUpdateQualityGate:
    def _url(self, project_id):
        return f"{BASE}/{project_id}/quality-gate"

    def test_update_min_score(self, client, auth_headers, sample_project):
        """Owner can update min_score threshold."""
        resp = client.put(self._url(sample_project),
                          json={"thresholds": {"min_score": 90}},
                          headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["data"]["thresholds"]["min_score"] == 90

    def test_update_merges_existing_thresholds(self, client, auth_headers,
                                                sample_project):
        """PUT merges new values with existing ones; untouched keys stay."""
        # Create gate first via GET
        client.get(self._url(sample_project), headers=auth_headers)

        resp = client.put(self._url(sample_project),
                          json={"thresholds": {"min_score": 80}},
                          headers=auth_headers)
        data = resp.get_json()
        # max_critical_issues should remain at its default (0)
        assert data["data"]["thresholds"]["max_critical_issues"] == 0

    def test_update_invalid_min_score_above_100(self, client, auth_headers,
                                                 sample_project):
        """min_score > 100 is rejected."""
        resp = client.put(self._url(sample_project),
                          json={"thresholds": {"min_score": 150}},
                          headers=auth_headers)
        assert resp.status_code == 400
        assert resp.get_json()["error"] == "validation_error"

    def test_update_invalid_min_score_negative(self, client, auth_headers,
                                                sample_project):
        """Negative min_score is rejected."""
        resp = client.put(self._url(sample_project),
                          json={"thresholds": {"min_score": -5}},
                          headers=auth_headers)
        assert resp.status_code == 400

    def test_update_invalid_max_negative(self, client, auth_headers,
                                          sample_project):
        """Negative max_critical_issues is rejected."""
        resp = client.put(self._url(sample_project),
                          json={"thresholds": {"max_critical_issues": -1}},
                          headers=auth_headers)
        assert resp.status_code == 400

    def test_update_unknown_key_rejected(self, client, auth_headers,
                                          sample_project):
        """Unknown threshold key is rejected."""
        resp = client.put(self._url(sample_project),
                          json={"thresholds": {"unknown_key": 42}},
                          headers=auth_headers)
        assert resp.status_code == 400

    def test_update_missing_thresholds_field(self, client, auth_headers,
                                              sample_project):
        """Body without 'thresholds' key returns 400."""
        resp = client.put(self._url(sample_project),
                          json={"name": "New Name"},
                          headers=auth_headers)
        assert resp.status_code == 400

    def test_update_not_found(self, client, auth_headers):
        resp = client.put(f"{BASE}/99999/quality-gate",
                          json={"thresholds": {"min_score": 70}},
                          headers=auth_headers)
        assert resp.status_code == 404

    def test_update_other_users_gate(self, client, other_auth_headers,
                                      sample_project):
        resp = client.put(self._url(sample_project),
                          json={"thresholds": {"min_score": 50}},
                          headers=other_auth_headers)
        assert resp.status_code == 403

    def test_update_requires_auth(self, client, sample_project):
        resp = client.put(self._url(sample_project),
                          json={"thresholds": {"min_score": 70}})
        assert resp.status_code == 401
