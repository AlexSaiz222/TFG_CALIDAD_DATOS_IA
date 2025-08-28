from flask import Blueprint

from api.auth.routes import auth_bp
from api.projects.routes import projects_bp
from api.projects.metrics import project_metrics_bp
from api.datasets.routes import datasets_bp, project_datasets_bp
from api.metrics.routes import metrics_bp
from api.evaluations.routes import evaluations_bp
from api.admin.routes import admin_bp

def register_routes(app):
    """Register all API routes with the Flask application"""
    
    # Create API blueprint
    api = Blueprint('api', __name__, url_prefix='/api')
    
    # Register individual module blueprints with API
    api.register_blueprint(auth_bp)
    api.register_blueprint(projects_bp)
    api.register_blueprint(project_metrics_bp)
    api.register_blueprint(datasets_bp)
    api.register_blueprint(project_datasets_bp)
    api.register_blueprint(metrics_bp)
    api.register_blueprint(evaluations_bp)
    api.register_blueprint(admin_bp)
    
    # Register API blueprint with the app
    app.register_blueprint(api)
