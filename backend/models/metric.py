from datetime import datetime
import numpy as np
from extensions import db

class Metric(db.Model):
    """Metric model for defining data quality metrics"""
    __tablename__ = 'metrics'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(100), nullable=False)
    parameters = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<Metric {self.name}>'
    
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
            
    def to_dict(self):
        """Convert metric to dictionary with serializable types"""
        try:
            return {
                'id': self.id,
                'name': self.name,
                'description': self.description,
                'category': self.category,
                'parameters': self._ensure_serializable(self.parameters),
                'created_at': self.created_at.isoformat(),
                'updated_at': self.updated_at.isoformat()
            }
        except Exception as e:
            # Si hay un error, devolver un diccionario mínimo
            return {
                'id': self.id,
                'name': self.name,
                'error': f"Error al serializar: {str(e)}"
            }

class MetricTemplate(db.Model):
    """Metric template model for grouping metrics"""
    __tablename__ = 'metric_templates'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    metrics = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<MetricTemplate {self.name}>'
    
    def to_dict(self):
        """Convert metric template to dictionary with serializable types"""
        try:
            # Usar el método de la clase Metric para asegurar serialización
            return {
                'id': self.id,
                'name': self.name,
                'description': self.description,
                'metrics': Metric._ensure_serializable(self, self.metrics),
                'created_at': self.created_at.isoformat(),
                'updated_at': self.updated_at.isoformat()
            }
        except Exception as e:
            # Si hay un error, devolver un diccionario mínimo
            return {
                'id': self.id,
                'name': self.name,
                'error': f"Error al serializar: {str(e)}"
            }
