"""
Shared fixtures for all backend tests.

Builds a minimal Flask app directly (bypassing app.py's module-level
`app = create_app()`) so that SQLite in-memory works without the
PostgreSQL pool options that are incompatible with SQLite.
"""
import sys
import os
import pytest

# Ensure the backend package is importable when running from any directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import timedelta
from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token
from flask_cors import CORS
from werkzeug.security import generate_password_hash

from extensions import db as _db
from models.user import User
from models.project import Project


# ---------------------------------------------------------------------------
# App / DB fixtures
# ---------------------------------------------------------------------------

def _build_test_app():
    """
    Create a minimal Flask app with SQLite and all API blueprints.

    Mirrors the relevant parts of create_app() but:
    - Uses sqlite:///:memory: (no pool_size / pool_recycle)
    - Skips Celery, Redis, MinIO, rate limiting, logging setup
    """
    test_app = Flask(__name__)
    test_app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        # SQLite StaticPool — no pool_size / pool_recycle
        SQLALCHEMY_ENGINE_OPTIONS={"connect_args": {"check_same_thread": False}},
        SECRET_KEY="test-secret-key",
        JWT_SECRET_KEY="test-jwt-secret-key",
        JWT_TOKEN_LOCATION=["headers"],
        JWT_HEADER_NAME="Authorization",
        JWT_HEADER_TYPE="Bearer",
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(hours=1),
        CORS_ORIGINS=["*"],
        MAX_CONTENT_LENGTH=16 * 1024 * 1024,
        ALLOWED_EXTENSIONS={"csv", "xlsx", "xls", "json", "parquet"},
        # Disable strict slashes to match production behaviour
        WTF_CSRF_ENABLED=False,
    )
    test_app.url_map.strict_slashes = False

    CORS(test_app)
    _db.init_app(test_app)
    JWTManager(test_app)

    # Register all API blueprints
    from api.routes import register_routes
    register_routes(test_app)

    return test_app


@pytest.fixture(scope="function")
def app():
    """Fresh Flask app + SQLite DB for each test function."""
    test_app = _build_test_app()
    with test_app.app_context():
        _db.create_all()
        yield test_app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope="function")
def client(app):
    """HTTP test client."""
    return app.test_client()


# ---------------------------------------------------------------------------
# Common data fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_user(app):
    """Persist a sample user and return its id."""
    with app.app_context():
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash=generate_password_hash("password123"),
            first_name="Test",
            last_name="User",
            role="user",
        )
        _db.session.add(user)
        _db.session.commit()
        return user.id


@pytest.fixture
def other_user(app):
    """A second user (used for authorization tests)."""
    with app.app_context():
        user = User(
            username="otheruser",
            email="other@example.com",
            password_hash=generate_password_hash("password123"),
            role="user",
        )
        _db.session.add(user)
        _db.session.commit()
        return user.id


@pytest.fixture
def auth_headers(app, sample_user):
    """Authorization headers for sample_user."""
    with app.app_context():
        token = create_access_token(identity=str(sample_user))
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture
def other_auth_headers(app, other_user):
    """Authorization headers for other_user."""
    with app.app_context():
        token = create_access_token(identity=str(other_user))
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture
def sample_project(app, sample_user):
    """Persist a sample project owned by sample_user and return its id."""
    with app.app_context():
        project = Project(
            name="Test Project",
            description="A project for testing",
            owner_id=sample_user,
            metrics_config=[{"id": "completeness", "parameters": {}}],
        )
        _db.session.add(project)
        _db.session.commit()
        return project.id
