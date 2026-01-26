from datetime import datetime
import numpy as np
import logging
from extensions import db

# Configurar logger
logger = logging.getLogger(__name__)

class Dataset(db.Model):
    """Dataset model for storing dataset metadata"""
    __tablename__ = 'datasets'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.BigInteger)
    row_count = db.Column(db.Integer)
    column_count = db.Column(db.Integer)
    schema = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    evaluations = db.relationship('Evaluation', backref='dataset', lazy=True, cascade='all, delete-orphan')
    analysis_runs = db.relationship('AnalysisRun', backref='dataset', lazy='dynamic')
    
    def __repr__(self):
        return f'<Dataset {self.name}>'
    
    def to_dict(self):
        """Convert dataset to dictionary with JSON-serializable types"""
        try:
            # Manejar posibles errores al acceder a self.evaluations
            try:
                evaluation_count = len(self.evaluations)
            except Exception as e:
                logger.warning(f"Error al acceder a evaluaciones del dataset {self.id}: {str(e)}")
                evaluation_count = 0
                
            # Manejar posibles errores en campos individuales
            try:
                file_size = int(self.file_size) if self.file_size is not None else None
            except Exception as e:
                logger.warning(f"Error al convertir file_size del dataset {self.id}: {str(e)}")
                file_size = None
                
            try:
                row_count = int(self.row_count) if self.row_count is not None else None
            except Exception as e:
                logger.warning(f"Error al convertir row_count del dataset {self.id}: {str(e)}")
                row_count = None
                
            try:
                column_count = int(self.column_count) if self.column_count is not None else None
            except Exception as e:
                logger.warning(f"Error al convertir column_count del dataset {self.id}: {str(e)}")
                column_count = None
                
            try:
                schema = self._ensure_serializable(self.schema)
            except Exception as e:
                logger.warning(f"Error al serializar schema del dataset {self.id}: {str(e)}")
                schema = None
                
            try:
                created_at = self.created_at.isoformat() if self.created_at else None
            except Exception as e:
                logger.warning(f"Error al formatear created_at del dataset {self.id}: {str(e)}")
                created_at = str(self.created_at) if self.created_at else None
                
            try:
                updated_at = self.updated_at.isoformat() if self.updated_at else None
            except Exception as e:
                logger.warning(f"Error al formatear updated_at del dataset {self.id}: {str(e)}")
                updated_at = str(self.updated_at) if self.updated_at else None
            
            return {
                'id': self.id,
                'name': self.name,
                'description': self.description,
                'project_id': self.project_id,
                'file_path': self.file_path,
                'file_size': file_size,
                'row_count': row_count,
                'column_count': column_count,
                'schema': schema,
                'created_at': created_at,
                'updated_at': updated_at,
                'evaluation_count': evaluation_count
            }
        except Exception as e:
            logger.error(f"Error general al serializar dataset {self.id}: {str(e)}")
            # Si hay un error, devolver un diccionario mínimo
            return {
                'id': self.id,
                'name': self.name,
                'error': f"Error al serializar: {str(e)}"
            }
        
    def _ensure_serializable(self, obj):
        """Recursively convert any non-serializable types to serializable ones"""
        if obj is None:
            return None
        elif isinstance(obj, (str, bool, int, float)):
            return obj
        elif isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return self._ensure_serializable(obj.tolist())
        elif isinstance(obj, dict):
            return {k: self._ensure_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [self._ensure_serializable(item) for item in obj]
        elif isinstance(obj, (datetime, np.datetime64)):
            return obj.isoformat() if hasattr(obj, 'isoformat') else str(obj)
        else:
            # Try to convert to string if it's some other type
            try:
                return str(obj)
            except Exception as e:
                logger.warning(f"No se pudo convertir objeto a string: {str(e)}")
                return None
