"""
Clase base y tipos compartidos para todas las métricas de calidad de datos.
"""
from __future__ import annotations

import logging
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class MetricResult:
    """Resultado de la evaluación de una métrica.

    Attributes:
        metric_id: Identificador string de la métrica (ej. 'completeness').
        score: Puntuación 0.0-1.0 que contribuye al quality score global.
               None si la métrica no pudo calcularse.
        results: Datos detallados para almacenar en AnalysisRun.results.
        issues: Lista de dicts de issues en el formato esperado por evaluation_service.
    """
    metric_id: str
    score: Optional[float]
    results: dict[str, Any] = field(default_factory=dict)
    issues: list[dict[str, Any]] = field(default_factory=list)


class BaseMetric(ABC):
    """Interfaz común para todas las métricas de calidad de datos.

    Cada métrica concreta hereda de esta clase e implementa el método
    evaluate(). Las utilidades compartidas (severity, histogram, etc.)
    están disponibles como métodos estáticos.
    """

    # Subclases pueden sobreescribir para personalizar el nombre de log
    log_prefix: str = "METRIC"

    @abstractmethod
    def evaluate(
        self,
        df: pd.DataFrame,
        parameters: dict[str, Any],
        dataset: Any,          # models.dataset.Dataset
        evaluation_id: int,
        metrics_map: dict[str, int],
    ) -> MetricResult:
        """Evalúa la métrica sobre el DataFrame proporcionado.

        Args:
            df: DataFrame con los datos del dataset.
            parameters: Parámetros de configuración de la métrica.
            dataset: Objeto Dataset con metadatos (sensitive_columns, etc.).
            evaluation_id: ID de la evaluación legacy (para links de issues).
            metrics_map: Mapa {metric_name: metric_db_id} para asociar issues.

        Returns:
            MetricResult con score, results e issues.
        """

    # ─── Utilidades compartidas ────────────────────────────────────────────────

    @staticmethod
    def calculate_dynamic_severity(
        actual_value: float,
        threshold: float,
        metric_type: str = "completeness",
        higher_is_better: bool = True,
    ) -> str:
        """Calcula la severity de un issue según su distancia al umbral.

        Args:
            actual_value: Valor real de la métrica (0.0-1.0 para porcentajes).
            threshold: Umbral configurado.
            metric_type: 'completeness' | 'outliers' | 'class_balance' | 'timeliness_ratio'.
            higher_is_better: True si valores altos son mejores.

        Returns:
            'critical' | 'high' | 'medium' | 'low'
        """
        if metric_type == "outliers":
            if actual_value >= 0.20:
                return "critical"
            elif actual_value >= 0.10:
                return "high"
            elif actual_value >= 0.05:
                return "medium"
            else:
                return "low"

        if metric_type == "class_balance":
            # actual_value = proporción de la clase dominante (mayor es peor)
            if actual_value >= 0.99:
                return "critical"
            elif actual_value >= 0.95:
                return "high"
            elif actual_value >= 0.90:
                return "medium"
            else:
                return "low"

        if metric_type == "timeliness_ratio":
            # actual_value = age_days / threshold (mayor es peor)
            if actual_value >= 10:
                return "critical"
            elif actual_value >= 3:
                return "high"
            elif actual_value >= 1:
                return "medium"
            else:
                return "low"

        # Métricas donde higher_is_better (completeness, uniqueness, conformance…)
        if higher_is_better:
            distance = threshold - actual_value
            if distance <= 0:
                return "low"
            if actual_value < 0.50:
                return "critical"
            elif actual_value < 0.70:
                return "high"
            else:
                if distance > 0.15:
                    return "high"
                elif distance > 0.05:
                    return "medium"
                else:
                    return "low"

        return "medium"

    @staticmethod
    def generate_histogram(series: pd.Series, bins: int = 10) -> dict:
        """Genera datos de histograma para una serie numérica."""
        series = series.dropna()
        if len(series) == 0:
            return {"bins": [], "counts": []}
        counts, bin_edges = np.histogram(series, bins=bins)
        return {
            "bins": [float(x) for x in bin_edges[:-1]],
            "counts": [int(x) for x in counts],
        }

    @staticmethod
    def infer_column_type(series: pd.Series, column_name: str) -> str:
        """Infiere el tipo semántico de una columna."""
        id_patterns = [r"_id$", r"^id$", r"_uuid$", r"^uuid$", r"_guid$", r"_key$"]
        if any(re.search(p, column_name.lower()) for p in id_patterns):
            return "ID"
        if series.nunique() <= 20 and not pd.api.types.is_numeric_dtype(series):
            return "categorical"
        if pd.api.types.is_numeric_dtype(series):
            return "numeric"
        return "text"

    @staticmethod
    def mask_sensitive(value: Any, column: str, sensitive_columns: list) -> Any:
        """Enmascara un valor si la columna es sensible."""
        return "***" if column in (sensitive_columns or []) else value
