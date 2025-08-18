from datetime import datetime
import numpy as np
from extensions import db

class User(db.Model):
    """User model for authentication and user management"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(100))
    last_name = db.Column(db.String(100))
    organization = db.Column(db.String(255))
    role = db.Column(db.String(50), nullable=False, default='user')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    projects = db.relationship('Project', backref='owner', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<User {self.username}>'
        
    def _ensure_serializable(self, obj):
        """Recursively convert non-serializable types to serializable ones"""
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return self._ensure_serializable(obj.tolist())
        elif isinstance(obj, dict):
            return {key: self._ensure_serializable(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self._ensure_serializable(item) for item in obj]
        elif isinstance(obj, (datetime, np.datetime64)):
            return obj.isoformat() if hasattr(obj, 'isoformat') else str(obj)
        else:
            return obj
            
    def to_dict(self, include_sensitive=False):
        """Convert user to dictionary with serializable types"""
        try:
            # Manejar posibles errores al acceder a self.projects
            try:
                project_count = len(self.projects)
            except Exception as e:
                project_count = 0
                
            user_dict = {
                'id': self.id,
                'username': self.username,
                'email': self.email,
                'first_name': self.first_name,
                'last_name': self.last_name,
                'organization': self.organization,
                'role': self.role,
                'created_at': self.created_at.isoformat(),
                'updated_at': self.updated_at.isoformat(),
                'project_count': project_count
            }
            
            # Incluir información sensible solo si se solicita explícitamente
            if include_sensitive:
                user_dict['password_hash'] = self.password_hash
                
            return user_dict
        except Exception as e:
            # Si hay un error, devolver un diccionario mínimo
            return {
                'id': self.id,
                'username': self.username,
                'error': f"Error al serializar: {str(e)}"
            }
