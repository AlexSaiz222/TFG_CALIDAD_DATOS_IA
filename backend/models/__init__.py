"""
Models package for the Data Quality Platform.
Exports all SQLAlchemy models.
"""

from models.user import User
from models.project import Project
from models.dataset import Dataset
from models.metric import Metric, MetricTemplate
from models.evaluation import Evaluation, Issue

# Nuevos modelos Sonar-Lite
from models.analysis import (
    AnalysisRun,
    AnalysisStatus,
    QualityGate,
    QualityGateStatus,
    DataQualityIssue,
)

__all__ = [
    # Modelos existentes
    'User',
    'Project',
    'Dataset',
    'Metric',
    'MetricTemplate',
    'Evaluation',
    'Issue',
    # Nuevos modelos Sonar-Lite
    'AnalysisRun',
    'AnalysisStatus',
    'QualityGate',
    'QualityGateStatus',
    'DataQualityIssue',
]
