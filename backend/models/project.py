from datetime import datetime
import numpy as np
from extensions import db
import json

class Project(db.Model):
    """Project model for organizing datasets and evaluations"""
    __tablename__ = 'projects'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    metrics_config = db.Column(db.JSON, default=list)  # List of metric configurations
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    datasets = db.relationship('Dataset', backref='project', lazy=True, cascade='all, delete-orphan')
    analysis_runs = db.relationship('AnalysisRun', backref='project', lazy='dynamic', cascade='all, delete-orphan')
    quality_gate = db.relationship('QualityGate', backref='project', uselist=False, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Project {self.name}>'
    
    @staticmethod
    def _ensure_serializable(obj):
        """Recursively convert non-serializable types to serializable ones"""
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return Project._ensure_serializable(obj.tolist())
        elif isinstance(obj, dict):
            return {key: Project._ensure_serializable(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [Project._ensure_serializable(item) for item in obj]
        elif isinstance(obj, (datetime, np.datetime64)):
            return obj.isoformat() if hasattr(obj, 'isoformat') else str(obj)
        else:
            return obj
            
    def to_dict(self):
        """Convert project to dictionary with serializable types"""
        try:
            # Manejar posibles errores al acceder a self.datasets
            try:
                dataset_count = len(self.datasets)
            except Exception as e:
                dataset_count = 0
                
            result = {
                'id': self.id,
                'name': self.name,
                'description': self.description,
                'owner_id': self.owner_id,
                'metrics_config': Project._ensure_serializable(self.metrics_config) if self.metrics_config else [],
                'created_at': self.created_at.isoformat(),
                'updated_at': self.updated_at.isoformat(),
                'dataset_count': dataset_count
            }
            
            # Obtener el último análisis completado (Computed Property pattern)
            # Esto evita duplicar datos y mantiene la "Single Source of Truth"
            # Usamos importación local para evitar dependencias circulares
            from models.analysis import AnalysisRun
            
            latest_run = getattr(self, 'analysis_runs', None)
            if latest_run:
                # Buscar el último run completado usando literal para evitar importar el Enum
                # AnalysisStatus.COMPLETED.value == 'COMPLETED'
                last_completed = (latest_run.filter(AnalysisRun.status == 'COMPLETED')
                                 .order_by(AnalysisRun.completed_at.desc())
                                 .first())
                
                if last_completed:
                    result.update({
                        'latest_analysis': {
                            'id': last_completed.id,
                            'status': last_completed.status.value if hasattr(last_completed.status, 'value') else last_completed.status,
                            'quality_score': last_completed.quality_score,
                            'quality_gate_status': last_completed.quality_gate_status.value if last_completed.quality_gate_status else None,
                            'completed_at': last_completed.completed_at.isoformat() if last_completed.completed_at else None,
                            'new_issues': last_completed.new_issues_count or 0
                        }
                    })
            
            return result
        except Exception as e:
            # Si hay un error, devolver un diccionario mínimo
            return {
                'id': self.id,
                'name': self.name,
                'error': f"Error al serializar: {str(e)}"
            }
