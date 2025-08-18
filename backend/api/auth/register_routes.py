"""
Register all auth routes
"""
from .update_profile import register_update_profile_route

def register_all_routes(auth_bp):
    """
    Register all auth routes with the auth blueprint
    """
    # Register the update profile endpoint
    register_update_profile_route(auth_bp)
    
    return auth_bp
