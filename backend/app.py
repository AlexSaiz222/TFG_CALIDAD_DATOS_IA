import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv

from config import Config
from extensions import db
from api.routes import register_routes

def create_app(config_class=Config):
    """Create and configure the Flask application"""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions
    CORS(app)
    db.init_app(app)
    JWTManager(app)

    # Register API routes
    register_routes(app)

    # Health check endpoint
    @app.route('/health')
    def health_check():
        return jsonify({"status": "healthy", "version": "0.1.0"})

    return app

# Load environment variables
load_dotenv()

# Create the Flask application
app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
