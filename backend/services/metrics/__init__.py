"""
Paquete de métricas de calidad de datos.

Cada métrica se define como una clase que hereda de BaseMetric e implementa
el método evaluate(). El registro central (registry.py) mapea los IDs de
métricas a sus clases correspondientes.
"""
from .base import BaseMetric, MetricResult
from .registry import get_metric, METRIC_REGISTRY

__all__ = ['BaseMetric', 'MetricResult', 'get_metric', 'METRIC_REGISTRY']
