from flask import Blueprint

from api.auth.routes import auth_bp
from api.projects.routes import projects_bp
from api.datasets.routes import datasets_bp
from api.metrics.routes import metrics_bp
from api.evaluations.routes import evaluations_bp

def register_routes(app):
    """Register all API routes with the Flask application"""
    
    # Create API v1 blueprint
    api_v1 = Blueprint('api_v1', __name__, url_prefix='/api/v1')
    
    # Register individual module blueprints with API v1
    api_v1.register_blueprint(auth_bp)
    api_v1.register_blueprint(projects_bp)
    api_v1.register_blueprint(datasets_bp)
    api_v1.register_blueprint(metrics_bp)
    api_v1.register_blueprint(evaluations_bp)
    
    # Register API v1 blueprint with the app
    app.register_blueprint(api_v1)
