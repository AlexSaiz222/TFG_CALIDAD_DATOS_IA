"""Registro central de métricas: mapea metric_id → clase de métrica."""
from .completeness import CompletenessMetric
from .uniqueness import UniquenessMetric
from .outliers import OutliersMetric
from .syntactic_accuracy import SyntacticAccuracyMetric
from .logical_consistency import LogicalConsistencyMetric
from .class_balance import ClassBalanceMetric
from .timeliness import TimelinessMetric

METRIC_REGISTRY: dict = {
    "completeness": CompletenessMetric,
    "uniqueness": UniquenessMetric,
    "outliers": OutliersMetric,
    "syntactic_accuracy": SyntacticAccuracyMetric,
    "logical_consistency": LogicalConsistencyMetric,
    "class_balance": ClassBalanceMetric,
    "timeliness": TimelinessMetric,
}


def get_metric(metric_id: str):
    """Devuelve una instancia de la clase de métrica para el metric_id dado.

    Raises KeyError si el metric_id no está registrado.
    """
    cls = METRIC_REGISTRY[metric_id]
    return cls()
