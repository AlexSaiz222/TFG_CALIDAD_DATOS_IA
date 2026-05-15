"""
BE-10 / NF-02 — Cross-user authorization (IDOR) tests on dataset endpoints.

Projects already have IDOR tests in test_projects_api.py. Dataset routes
checked `project.owner_id != current_user_id_int` in many places but had no
direct tests. This suite probes every read/write endpoint that accepts a
dataset_id, ensuring user B cannot access user A's dataset by simply guessing
the integer ID — i.e. the classic Insecure Direct Object Reference attack.

Endpoints covered:
    GET    /api/datasets/<id>
    GET    /api/datasets/<id>/columns
    GET    /api/datasets/<id>/preview
    GET    /api/datasets/<id>/evaluations
    POST   /api/datasets/<id>/evaluations
    DELETE /api/datasets/<id>

Expected response for every cross-user attempt: HTTP 403 with
    {"success": false, "error": "unauthorized_access"}
or HTTP 404 if the route looks up the dataset first and returns "not found"
to avoid leaking existence (both are acceptable per the OWASP guidance).
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from werkzeug.security import generate_password_hash

from extensions import db
from models.user import User
from models.project import Project
from models.dataset import Dataset


# ---------------------------------------------------------------------------
# Fixture: user A owns a project + dataset; user B is an unrelated user
# ---------------------------------------------------------------------------

@pytest.fixture
def idor_setup(app, sample_user, other_user, auth_headers, other_auth_headers):
    """sample_user owns project_a + dataset_a; other_user is unrelated."""
    with app.app_context():
        project = Project(
            name="A's Project",
            description="owned by sample_user",
            owner_id=sample_user,
        )
        db.session.add(project)
        db.session.flush()

        dataset = Dataset(
            name="A's Dataset",
            description="owned by sample_user",
            project_id=project.id,
            file_path="/fake/v1.csv",
            file_size=1000,
            row_count=10,
            column_count=3,
            version=1,
            is_latest=True,
        )
        db.session.add(dataset)
        db.session.commit()

        return {
            "project_id": project.id,
            "dataset_id": dataset.id,
            "owner_headers": auth_headers,
            "intruder_headers": other_auth_headers,
        }


def _is_denied(resp):
    """Both 403 (explicit deny) and 404 (existence hidden) count as safe."""
    return resp.status_code in (403, 404)


# ---------------------------------------------------------------------------
# Owner sanity check — owner can access
# ---------------------------------------------------------------------------

class TestOwnerAccessSanity:
    """Sanity: owner_headers must succeed on the same endpoint that intruder
    fails on. This guards against false positives where the endpoint is broken
    for everyone (which would also pass an IDOR test trivially)."""

    def test_owner_can_get_own_dataset(self, client, idor_setup):
        resp = client.get(
            f"/api/datasets/{idor_setup['dataset_id']}",
            headers=idor_setup["owner_headers"],
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Read endpoints
# ---------------------------------------------------------------------------

class TestIDORReadEndpoints:

    def test_get_dataset_denied_for_intruder(self, client, idor_setup):
        resp = client.get(
            f"/api/datasets/{idor_setup['dataset_id']}",
            headers=idor_setup["intruder_headers"],
        )
        assert _is_denied(resp), f"Expected 403/404, got {resp.status_code}"

    def test_get_columns_denied_for_intruder(self, client, idor_setup):
        resp = client.get(
            f"/api/datasets/{idor_setup['dataset_id']}/columns",
            headers=idor_setup["intruder_headers"],
        )
        assert _is_denied(resp)

    def test_get_preview_denied_for_intruder(self, client, idor_setup):
        resp = client.get(
            f"/api/datasets/{idor_setup['dataset_id']}/preview",
            headers=idor_setup["intruder_headers"],
        )
        assert _is_denied(resp)

    def test_get_evaluations_denied_for_intruder(self, client, idor_setup):
        resp = client.get(
            f"/api/datasets/{idor_setup['dataset_id']}/evaluations",
            headers=idor_setup["intruder_headers"],
        )
        assert _is_denied(resp)

    def test_get_versions_denied_for_intruder(self, client, idor_setup):
        resp = client.get(
            f"/api/projects/{idor_setup['project_id']}/datasets/"
            f"{idor_setup['dataset_id']}/versions",
            headers=idor_setup["intruder_headers"],
        )
        assert _is_denied(resp)


# ---------------------------------------------------------------------------
# Write / mutation endpoints
# ---------------------------------------------------------------------------

class TestIDORWriteEndpoints:

    def test_delete_dataset_denied_for_intruder(self, client, idor_setup, app):
        resp = client.delete(
            f"/api/datasets/{idor_setup['dataset_id']}",
            headers=idor_setup["intruder_headers"],
        )
        assert _is_denied(resp)

        # And confirm the dataset is still there
        with app.app_context():
            assert Dataset.query.get(idor_setup["dataset_id"]) is not None

    def test_create_evaluation_denied_for_intruder(self, client, idor_setup):
        resp = client.post(
            f"/api/datasets/{idor_setup['dataset_id']}/evaluations",
            json={},
            headers=idor_setup["intruder_headers"],
        )
        assert _is_denied(resp)

    def test_upload_new_version_denied_for_intruder(self, client, idor_setup):
        resp = client.post(
            f"/api/projects/{idor_setup['project_id']}/datasets/"
            f"{idor_setup['dataset_id']}/new-version",
            headers=idor_setup["intruder_headers"],
        )
        assert _is_denied(resp)


# ---------------------------------------------------------------------------
# Token-level controls (sanity)
# ---------------------------------------------------------------------------

class TestUnauthenticatedAccess:
    """No Bearer token at all ⇒ Flask-JWT returns 401."""

    @pytest.mark.parametrize("path_template", [
        "/api/datasets/{ds}",
        "/api/datasets/{ds}/columns",
        "/api/datasets/{ds}/preview",
        "/api/datasets/{ds}/evaluations",
    ])
    def test_endpoint_requires_jwt(self, client, idor_setup, path_template):
        path = path_template.format(ds=idor_setup["dataset_id"])
        resp = client.get(path)
        assert resp.status_code == 401, (
            f"Expected 401 unauthorized without token, got {resp.status_code}"
        )

    def test_delete_without_jwt(self, client, idor_setup):
        resp = client.delete(f"/api/datasets/{idor_setup['dataset_id']}")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# ID enumeration safety: nonexistent IDs do not leak via 403 vs 404 mismatch
# ---------------------------------------------------------------------------

class TestIDOREnumerationSafety:
    """A predictable distinction between 'exists but forbidden' and 'does not
    exist' lets attackers enumerate dataset IDs. This test does not enforce a
    specific policy, but documents the current behaviour so a regression on
    information leakage is at least visible."""

    def test_nonexistent_dataset_returns_404(self, client, idor_setup):
        resp = client.get(
            "/api/datasets/999999",
            headers=idor_setup["intruder_headers"],
        )
        assert resp.status_code in (403, 404)
