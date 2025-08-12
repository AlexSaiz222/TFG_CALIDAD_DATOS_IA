from datetime import datetime
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
    
    def to_dict(self):
        """Convert metric to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'category': self.category,
            'parameters': self.parameters,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
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
        """Convert metric template to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'metrics': self.metrics,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
