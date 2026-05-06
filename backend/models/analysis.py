"""
Modelos para la arquitectura Sonar-Lite.
Nuevos modelos: AnalysisRun y QualityGate.
"""
from datetime import datetime
from enum import Enum as PyEnum
import numpy as np
from extensions import db


class AnalysisStatus(PyEnum):
    """Estados de ejecución técnica del análisis
    
    IMPORTANTE: Los valores deben coincidir EXACTAMENTE con los definidos
    en la migración add_sonar_lite_tables.py (MAYÚSCULAS)
    """
    PENDING = 'PENDING'
    RUNNING = 'RUNNING'  # Estado durante ejecución (nombre de la migración)
    COMPLETED = 'COMPLETED'
    FAILED = 'FAILED'
    
    # Alias para compatibilidad con código que use PROCESSING
    @classmethod
    def PROCESSING(cls):
        return cls.RUNNING


class QualityGateStatus(PyEnum):
    """Estados del Quality Gate (veredicto de calidad)
    
    IMPORTANTE: Los valores deben coincidir EXACTAMENTE con los definidos
    en la migración add_sonar_lite_tables.py (MAYÚSCULAS)
    """
    PASSED = 'PASSED'
    FAILED = 'FAILED'
    WARNING = 'WARNING'


class AnalysisRun(db.Model):
    """
    Modelo central de la arquitectura Sonar-Lite.
    Representa una ejecución de análisis de calidad sobre un dataset.
    Cada AnalysisRun es un snapshot inmutable que puede compararse con su baseline.
    """
    __tablename__ = 'analysis_runs'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Relación con proyecto (un proyecto tiene múltiples análisis)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    
    # Relación con dataset (opcional, para saber qué dataset se analizó)
    dataset_id = db.Column(db.Integer, db.ForeignKey('datasets.id'), nullable=True)
    
    # Estado de la ejecución técnica
    status = db.Column(
        db.Enum(AnalysisStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=AnalysisStatus.PENDING
    )
    
    # El "Veredicto" de Calidad (Sonar Experience)
    quality_gate_status = db.Column(
        db.Enum(QualityGateStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=True
    )
    
    # Métricas clave para listados rápidos
    quality_score = db.Column(db.Float, nullable=True)  # 0-100
    critical_issues_count = db.Column(db.Integer, default=0)
    total_issues_count = db.Column(db.Integer, default=0)
    
    # Comparación (Diff) - Referencia al run anterior para comparar
    baseline_analysis_id = db.Column(
        db.Integer, 
        db.ForeignKey('analysis_runs.id'), 
        nullable=True
    )
    new_issues_count = db.Column(db.Integer, default=0)  # Issues que no existían en el baseline
    fixed_issues_count = db.Column(db.Integer, default=0)  # Issues que se arreglaron desde el baseline
    
    # Configuración de métricas usada en este análisis
    metrics_config = db.Column(db.JSON, nullable=True)
    
    # Resultados detallados del análisis (métricas calculadas)
    results = db.Column(db.JSON, nullable=True)
    
    # Campos para procesamiento asíncrono (compatibilidad con Celery)
    task_id = db.Column(db.String(100), nullable=True)
    progress = db.Column(db.Integer, default=0)  # 0-100
    current_step = db.Column(db.String(255), nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    issues = db.relationship(
        'DataQualityIssue', 
        backref='analysis_run', 
        lazy='dynamic',
        cascade='all, delete-orphan'
    )
    
    # Self-referential relationship para baseline
    baseline = db.relationship(
        'AnalysisRun',
        remote_side=[id],
        backref=db.backref('subsequent_runs', lazy='dynamic'),
        foreign_keys=[baseline_analysis_id]
    )
    
    def __repr__(self):
        return f'<AnalysisRun {self.id} - Project {self.project_id} - {self.status.value if self.status else "N/A"}>'
    
    def _ensure_serializable(self, obj):
        """Recursively convert non-serializable types to serializable ones"""
        if obj is None:
            return None
        elif isinstance(obj, (str, bool, int, float)):
            return obj
        elif isinstance(obj, PyEnum):
            return obj.value
        elif isinstance(obj, np.integer):
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
            return str(obj)
    
    def to_dict(self, include_issues=False):
        """Convert AnalysisRun to dictionary with serializable types"""
        try:
            # Calculate recurrent issues (total - new)
            total = self.total_issues_count or 0
            new = self.new_issues_count or 0
            recurrent = max(0, total - new)
            
            result = {
                'id': self.id,
                'project_id': self.project_id,
                'dataset_id': self.dataset_id,
                'status': self.status.value if self.status else None,
                'quality_gate_status': self.quality_gate_status.value if self.quality_gate_status else None,
                'quality_score': float(self.quality_score) if self.quality_score is not None else None,
                'critical_issues_count': self.critical_issues_count or 0,
                'total_issues_count': total,
                'baseline_analysis_id': self.baseline_analysis_id,
                'new_issues_count': new,
                'fixed_issues_count': self.fixed_issues_count or 0,
                'recurrent_issues_count': recurrent,
                'metrics_config': self._ensure_serializable(self.metrics_config),
                'results': self._ensure_serializable(self.results),
                'task_id': self.task_id,
                'progress': self.progress or 0,
                'current_step': self.current_step,
                'error_message': self.error_message,
                'error': self.error_message,  # Alias para compatibilidad con Evaluation
                'created_at': self.created_at.isoformat() if self.created_at else None,
                'updated_at': self.updated_at.isoformat() if self.updated_at else None,
                'started_at': self.started_at.isoformat() if self.started_at else None,
                'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            }
            
            if include_issues:
                result['issues'] = [issue.to_dict() for issue in self.issues.all()]
            else:
                result['issue_count'] = self.issues.count() if self.issues else 0
                
            return result
        except Exception as e:
            return {
                'id': self.id,
                'project_id': self.project_id,
                'status': self.status.value if self.status else None,
                'error': f"Error al serializar: {str(e)}"
            }
    
    def to_summary_dict(self):
        """Versión ligera para listados"""
        total = self.total_issues_count or 0
        new = self.new_issues_count or 0
        
        # Severity breakdown — use the dynamic `issues` relationship to avoid
        # any forward-reference / import-order issues with DataQualityIssue
        severity_counts = {'critical': 0, 'major': 0, 'minor': 0, 'info': 0}
        try:
            from sqlalchemy import text
            rows = db.session.execute(
                text(
                    "SELECT severity, COUNT(*) FROM data_quality_issues "
                    "WHERE analysis_run_id = :run_id GROUP BY severity"
                ),
                {"run_id": self.id}
            ).fetchall()
            for sev, cnt in rows:
                if sev in severity_counts:
                    severity_counts[sev] = int(cnt)
        except Exception:
            pass
        
        return {
            'id': self.id,
            'project_id': self.project_id,
            'dataset_id': self.dataset_id,
            'status': self.status.value if self.status else None,
            'quality_gate_status': self.quality_gate_status.value if self.quality_gate_status else None,
            'quality_score': float(self.quality_score) if self.quality_score is not None else None,
            'new_issues_count': new,
            'fixed_issues_count': self.fixed_issues_count or 0,
            'recurrent_issues_count': max(0, total - new),
            'total_issues_count': total,
            'critical_issues_count': self.critical_issues_count or 0,
            'severity_counts': severity_counts,
            'baseline_analysis_id': self.baseline_analysis_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }


class QualityGate(db.Model):
    """
    Configuración del Quality Gate para un proyecto.
    Define los umbrales que determinan si un análisis pasa o falla.
    """
    __tablename__ = 'quality_gates'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Relación con proyecto (un proyecto tiene una configuración de gate)
    project_id = db.Column(
        db.Integer, 
        db.ForeignKey('projects.id'), 
        nullable=False,
        unique=True  # Un proyecto solo puede tener un QualityGate
    )
    
    # Nombre descriptivo del gate
    name = db.Column(db.String(255), default='Default Quality Gate')
    
    # Configuración JSON con los umbrales
    # Ejemplo: {
    #   "min_score": 80,
    #   "max_critical_issues": 0,
    #   "max_new_issues": 10,
    #   "min_completeness": 90,
    #   "min_uniqueness": 95
    # }
    thresholds = db.Column(db.JSON, nullable=False, default=dict)
    
    # Si está activo o no
    is_active = db.Column(db.Boolean, default=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<QualityGate {self.id} - Project {self.project_id}>'
    
    def to_dict(self):
        """Convert QualityGate to dictionary"""
        return {
            'id': self.id,
            'project_id': self.project_id,
            'name': self.name,
            'thresholds': self.thresholds or {},
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
    
    @staticmethod
    def get_default_thresholds():
        """Retorna los umbrales por defecto para un nuevo QualityGate"""
        return {
            'min_score': 70,              # Score mínimo para pasar
            'max_critical_issues': 0,     # Máximo de issues críticos permitidos
            'max_new_issues': 10,         # Máximo de nuevos issues permitidos
            'warning_margin': 10,         # Puntos sobre min_score que producen WARNING en lugar de PASSED
        }


class DataQualityIssue(db.Model):
    """
    Modelo para issues de calidad de datos.
    Cada issue tiene un fingerprint para rastrear su evolución entre análisis.
    """
    __tablename__ = 'data_quality_issues'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Relación con AnalysisRun
    analysis_run_id = db.Column(
        db.Integer, 
        db.ForeignKey('analysis_runs.id'), 
        nullable=False,
        index=True
    )
    
    # Relación opcional con métrica (para saber qué regla lo detectó)
    metric_id = db.Column(db.Integer, db.ForeignKey('metrics.id'), nullable=True)
    
    # Fingerprint: hash único para identificar el issue entre runs
    # hash(rule_key + column_name + row_identifier + issue_type)
    fingerprint = db.Column(db.String(64), nullable=True, index=True)
    
    # Tipo de issue (completeness, uniqueness, validity, etc.)
    issue_type = db.Column(db.String(100), nullable=False)
    
    # Severidad: critical, major, minor, info
    severity = db.Column(db.String(50), nullable=False, default='minor')
    
    # Descripción del problema
    description = db.Column(db.Text, nullable=False)
    
    # Columnas afectadas (JSON array)
    affected_columns = db.Column(db.JSON, nullable=True)
    
    # Filas afectadas (JSON array con índices o identificadores)
    affected_rows = db.Column(db.JSON, nullable=True)
    
    # Número de filas afectadas (para no tener que contar el array)
    affected_row_count = db.Column(db.Integer, default=0)

    # Porcentaje de filas afectadas (0.0-1.0) — contexto informativo
    affected_rows_pct = db.Column(db.Float, nullable=True)
    
    # Estado del issue en este run
    is_new = db.Column(db.Boolean, default=True)  # True si no existía en el baseline
    
    # Regla que generó el issue (ej: "completeness_check", "uniqueness_check")
    rule_key = db.Column(db.String(100), nullable=True)
    
    # Valor actual vs esperado (para contexto)
    actual_value = db.Column(db.String(255), nullable=True)
    expected_value = db.Column(db.String(255), nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<DataQualityIssue {self.id} - {self.issue_type} - {self.severity}>'
    
    def to_dict(self):
        """Convert DataQualityIssue to dictionary"""
        try:
            return {
                'id': self.id,
                'analysis_run_id': self.analysis_run_id,
                'metric_id': self.metric_id,
                'fingerprint': self.fingerprint,
                'issue_type': self.issue_type,
                'severity': self.severity,
                'description': self.description,
                'affected_columns': self.affected_columns or [],
                'affected_rows': self.affected_rows,
                'affected_row_count': self.affected_row_count or 0,
                'affected_rows_pct': self.affected_rows_pct,
                'is_new': self.is_new,
                'rule_key': self.rule_key,
                'actual_value': self.actual_value,
                'expected_value': self.expected_value,
                'created_at': self.created_at.isoformat() if self.created_at else None,
            }
        except Exception as e:
            return {
                'id': self.id,
                'analysis_run_id': self.analysis_run_id,
                'severity': self.severity,
                'description': self.description,
                'error': f"Error al serializar: {str(e)}"
            }
    
    def to_summary_dict(self):
        """Versión ligera para listados"""
        return {
            'id': self.id,
            'fingerprint': self.fingerprint,
            'issue_type': self.issue_type,
            'severity': self.severity,
            'description': self.description[:200] if self.description else None,
            'affected_columns': self.affected_columns or [],
            'affected_row_count': self.affected_row_count or 0,
            'affected_rows_pct': self.affected_rows_pct,
            'is_new': self.is_new,
        }
