from datetime import datetime
from extensions import db

class Evaluation(db.Model):
    """Evaluation model for storing dataset quality evaluation results"""
    __tablename__ = 'evaluation'
    
    id = db.Column(db.Integer, primary_key=True)
    dataset_id = db.Column(db.Integer, db.ForeignKey('datasets.id'), nullable=False)
    status = db.Column(db.String(50), nullable=False, default='pending')  # pending, processing, completed, failed
    metrics_config = db.Column(db.JSON, nullable=False)
    results = db.Column(db.JSON)
    quality_score = db.Column(db.Numeric)
    
    # Campos para procesamiento asíncrono
    task_id = db.Column(db.String(100))  # ID de la tarea en Celery
    progress = db.Column(db.Integer, default=0)  # Progreso de 0 a 100
    current_step = db.Column(db.String(255))  # Descripción del paso actual
    error = db.Column(db.Text)  # Mensaje de error si falla
    
    # Timestamps
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    issues = db.relationship('Issue', backref='evaluation', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Evaluation {self.id} for Dataset {self.dataset_id}>'
    
    def to_dict(self):
        """Convert evaluation to dictionary"""
        return {
            'id': self.id,
            'dataset_id': self.dataset_id,
            'status': self.status,
            'metrics_config': self.metrics_config,
            'results': self.results,
            'quality_score': float(self.quality_score) if self.quality_score else None,
            'progress': self.progress,
            'current_step': self.current_step,
            'task_id': self.task_id,
            'error': self.error,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'issue_count': len(self.issues)
        }

class Issue(db.Model):
    """Issue model for storing data quality issues"""
    __tablename__ = 'issues'
    
    id = db.Column(db.Integer, primary_key=True)
    evaluation_id = db.Column(db.Integer, db.ForeignKey('evaluation.id'), nullable=False)
    metric_id = db.Column(db.Integer, db.ForeignKey('metrics.id'))
    severity = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=False)
    affected_columns = db.Column(db.JSON)
    affected_rows = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Issue {self.id} for Evaluation {self.evaluation_id}>'
    
    def to_dict(self):
        """Convert issue to dictionary"""
        return {
            'id': self.id,
            'evaluation_id': self.evaluation_id,
            'metric_id': self.metric_id,
            'severity': self.severity,
            'description': self.description,
            'affected_columns': self.affected_columns,
            'affected_rows': self.affected_rows,
            'created_at': self.created_at.isoformat()
        }
