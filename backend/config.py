import os
from datetime import timedelta

class Config:
    """Base configuration for the Flask application"""
    
    # Flask configuration
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = os.environ.get('FLASK_ENV') == 'development'
    
    # Database configuration
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@postgres:5432/dataquality')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # JWT configuration
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    
    # MinIO configuration
    MINIO_ENDPOINT = os.environ.get('MINIO_URL', 'minio:9000')
    MINIO_ACCESS_KEY = os.environ.get('MINIO_ACCESS_KEY', 'minioadmin')
    MINIO_SECRET_KEY = os.environ.get('MINIO_SECRET_KEY', 'minioadmin')
    MINIO_SECURE = False
    MINIO_BUCKET = 'datasets'
    
    # Redis configuration
    REDIS_URL = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
    
    # File upload configuration
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB max upload size
