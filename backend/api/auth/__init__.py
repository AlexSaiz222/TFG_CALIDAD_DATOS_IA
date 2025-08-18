from .routes import auth_bp
from .register_routes import register_all_routes

# Register all routes
auth_bp = register_all_routes(auth_bp)

# This file marks the directory as a Python package and exports the auth_bp
