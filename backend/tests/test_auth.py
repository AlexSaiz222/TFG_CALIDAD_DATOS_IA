"""
Tests for authentication endpoints.

Covers:
- POST /auth/register  — validation, duplicate detection, success
- POST /auth/login     — credential validation, JWT issuance
- POST /auth/refresh   — token renewal
- GET  /auth/me        — profile retrieval with valid/invalid tokens
"""
import pytest
from flask_jwt_extended import create_access_token, create_refresh_token


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

class TestRegister:
    ENDPOINT = "/api/auth/register"

    def test_register_success(self, client):
        """Valid payload creates a user and returns tokens."""
        resp = client.post(self.ENDPOINT, json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "securepass",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["success"] is True
        assert "token" in data
        assert "refresh_token" in data
        assert data["user"]["username"] == "newuser"
        assert data["user"]["email"] == "newuser@example.com"

    def test_register_with_optional_fields(self, client):
        """Optional fields (first_name, last_name, organization) are accepted."""
        resp = client.post(self.ENDPOINT, json={
            "username": "fulluser",
            "email": "full@example.com",
            "password": "securepass",
            "first_name": "Full",
            "last_name": "User",
            "organization": "UCLM",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["success"] is True

    def test_register_missing_username(self, client):
        """Missing username returns 400."""
        resp = client.post(self.ENDPOINT, json={
            "email": "noname@example.com",
            "password": "securepass",
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["success"] is False
        assert "username" in data["message"]

    def test_register_missing_email(self, client):
        """Missing email returns 400."""
        resp = client.post(self.ENDPOINT, json={
            "username": "noemail",
            "password": "securepass",
        })
        assert resp.status_code == 400

    def test_register_missing_password(self, client):
        """Missing password returns 400."""
        resp = client.post(self.ENDPOINT, json={
            "username": "nopass",
            "email": "nopass@example.com",
        })
        assert resp.status_code == 400

    def test_register_invalid_email_format(self, client):
        """Email without '@' is rejected."""
        resp = client.post(self.ENDPOINT, json={
            "username": "bademail",
            "email": "notanemail",
            "password": "securepass",
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["error"] == "invalid_email_format"

    def test_register_short_password(self, client):
        """Password shorter than 6 characters is rejected."""
        resp = client.post(self.ENDPOINT, json={
            "username": "shortpass",
            "email": "shortpass@example.com",
            "password": "abc",
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["error"] == "password_too_short"

    def test_register_duplicate_username(self, client, sample_user):
        """Registering with an existing username returns 409."""
        resp = client.post(self.ENDPOINT, json={
            "username": "testuser",   # same as sample_user fixture
            "email": "unique@example.com",
            "password": "securepass",
        })
        assert resp.status_code == 409
        data = resp.get_json()
        assert data["error"] == "username_exists"

    def test_register_duplicate_email(self, client, sample_user):
        """Registering with an existing email returns 409."""
        resp = client.post(self.ENDPOINT, json={
            "username": "uniqueuser",
            "email": "test@example.com",   # same as sample_user fixture
            "password": "securepass",
        })
        assert resp.status_code == 409
        data = resp.get_json()
        assert data["error"] == "email_exists"

    def test_register_no_json_body(self, client):
        """Request without JSON body returns 400."""
        resp = client.post(self.ENDPOINT, data="not json",
                           content_type="text/plain")
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

class TestLogin:
    ENDPOINT = "/api/auth/login"

    def test_login_success(self, client, sample_user):
        """Correct credentials return tokens and user data."""
        resp = client.post(self.ENDPOINT, json={
            "username": "testuser",
            "password": "password123",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert "token" in data
        assert "refresh_token" in data
        assert data["user"]["username"] == "testuser"

    def test_login_wrong_password(self, client, sample_user):
        """Wrong password returns 401."""
        resp = client.post(self.ENDPOINT, json={
            "username": "testuser",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401
        data = resp.get_json()
        assert data["error"] == "invalid_credentials"

    def test_login_nonexistent_user(self, client):
        """Login with unknown username returns 401."""
        resp = client.post(self.ENDPOINT, json={
            "username": "nobody",
            "password": "doesnotmatter",
        })
        assert resp.status_code == 401
        data = resp.get_json()
        assert data["error"] == "invalid_credentials"

    def test_login_missing_username(self, client):
        """Missing username field returns 400."""
        resp = client.post(self.ENDPOINT, json={"password": "pass"})
        assert resp.status_code == 400

    def test_login_missing_password(self, client):
        """Missing password field returns 400."""
        resp = client.post(self.ENDPOINT, json={"username": "testuser"})
        assert resp.status_code == 400

    def test_login_no_json_body(self, client):
        """Request without JSON body returns 400."""
        resp = client.post(self.ENDPOINT, data="",
                           content_type="text/plain")
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------

class TestRefresh:
    ENDPOINT = "/api/auth/refresh"

    def test_refresh_success(self, client, app, sample_user):
        """Valid refresh token returns a new access token."""
        with app.app_context():
            refresh_token = create_refresh_token(identity=str(sample_user))

        resp = client.post(self.ENDPOINT, headers={
            "Authorization": f"Bearer {refresh_token}",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert "access_token" in data

    def test_refresh_with_access_token_rejected(self, client, app, sample_user):
        """Using an access token on the refresh endpoint is rejected."""
        with app.app_context():
            access_token = create_access_token(identity=str(sample_user))

        resp = client.post(self.ENDPOINT, headers={
            "Authorization": f"Bearer {access_token}",
        })
        # Flask-JWT-Extended returns 422 for wrong token type
        assert resp.status_code in (401, 422)

    def test_refresh_without_token(self, client):
        """Missing Authorization header returns 401."""
        resp = client.post(self.ENDPOINT)
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Profile (GET /auth/me)
# ---------------------------------------------------------------------------

class TestGetProfile:
    ENDPOINT = "/api/auth/me"

    def test_get_profile_success(self, client, auth_headers):
        """Authenticated user can retrieve their profile."""
        resp = client.get(self.ENDPOINT, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert data["data"]["user"]["username"] == "testuser"
        assert data["data"]["user"]["email"] == "test@example.com"

    def test_get_profile_no_token(self, client):
        """Request without a token is rejected."""
        resp = client.get(self.ENDPOINT)
        assert resp.status_code == 401

    def test_get_profile_invalid_token(self, client):
        """Request with a malformed token is rejected (401 or 422)."""
        resp = client.get(self.ENDPOINT, headers={
            "Authorization": "Bearer this.is.not.a.valid.jwt",
        })
        assert resp.status_code in (401, 422)
