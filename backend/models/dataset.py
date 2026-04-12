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
    sensitive_columns = db.Column(db.JSON, default=list)  # List of column names to mask/blur
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Versioning fields
    parent_dataset_id = db.Column(db.Integer, db.ForeignKey('datasets.id'), nullable=True)
    version = db.Column(db.Integer, default=1)
    version_tag = db.Column(db.String(50), nullable=True)
    is_latest = db.Column(db.Boolean, default=True)
    
    # Relationships
    evaluations = db.relationship('Evaluation', backref='dataset', lazy=True, cascade='all, delete-orphan')
    analysis_runs = db.relationship('AnalysisRun', backref='dataset', lazy='dynamic', cascade='all, delete-orphan')
    
    # Self-referential relationship for versioning
    parent = db.relationship(
        'Dataset',
        remote_side=[id],
        backref=db.backref('versions', lazy='dynamic'),
        foreign_keys=[parent_dataset_id]
    )
    
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
                # Redact sensitive columns stats from schema
                if schema and isinstance(schema, list) and self.sensitive_columns:
                    for col_info in schema:
                        if isinstance(col_info, dict) and col_info.get("name") in self.sensitive_columns:
                            # Keep metadata, remove stats
                            for key in ["mean", "median", "std", "min", "max", "q1", "q3", 
                                        "iqr", "skewness", "kurtosis", "histogram", "boxplot",
                                        "mode", "bar_chart"]:
                                col_info.pop(key, None)
                            col_info["redacted"] = True
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
                'sensitive_columns': self._ensure_serializable(self.sensitive_columns) if self.sensitive_columns else [],
                'created_at': created_at,
                'updated_at': updated_at,
                'evaluation_count': evaluation_count,
                # Versioning fields
                'parent_dataset_id': self.parent_dataset_id,
                'version': self.version or 1,
                'version_tag': self.version_tag,
                'is_latest': self.is_latest if self.is_latest is not None else True,
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
    
    # ==================== Versioning Methods ====================
    
    def get_root_dataset(self):
        """Get the root dataset (first version) in the version chain"""
        current = self
        visited = set()
        while current.parent:
            if current.id in visited:
                logger.warning(f"Circular parent reference detected at dataset {current.id}")
                break
            visited.add(current.id)
            current = current.parent
        return current
    
    def get_version_history(self):
        """Get all versions of this dataset (including ancestors and descendants)"""
        root = self.get_root_dataset()
        
        # Get all datasets in this version chain
        all_versions = [root]
        
        def collect_versions(dataset):
            for version in dataset.versions:
                all_versions.append(version)
                collect_versions(version)
        
        collect_versions(root)
        
        # Sort by version number
        return sorted(all_versions, key=lambda d: d.version or 1)
    
    def get_latest_version(self):
        """Get the latest version in this dataset's version chain"""
        versions = self.get_version_history()
        for v in reversed(versions):
            if v.is_latest:
                return v
        # Fallback to last version if none marked as latest
        return versions[-1] if versions else self
    
    def get_version_count(self):
        """Get the total number of versions in this dataset's chain"""
        return len(self.get_version_history())
    
    def is_root_version(self):
        """Check if this is the root (first) version"""
        return self.parent_dataset_id is None
    
    def get_previous_version(self):
        """Get the previous version of this dataset"""
        return self.parent
    
    def get_next_versions(self):
        """Get all direct child versions of this dataset"""
        return list(self.versions)
