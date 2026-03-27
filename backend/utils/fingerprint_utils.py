"""
Utilidades para generación de fingerprints de issues de calidad de datos.

Este módulo proporciona funciones para generar identificadores únicos (fingerprints)
que permiten rastrear issues entre diferentes ejecuciones de análisis.

El fingerprint es determinista: los mismos datos de entrada siempre generan
el mismo hash, permitiendo identificar si un issue es nuevo o recurrente.
"""
import hashlib
from typing import Optional, List, Any, Dict


def generate_issue_fingerprint(
    issue_type: str,
    column_name: Optional[str] = None,
    row_identifier: Optional[str] = None,
    rule_key: Optional[str] = None,
    extra_params: Optional[Dict[str, Any]] = None
) -> str:
    """Genera un fingerprint único y determinista para un issue de calidad.
    
    El fingerprint permite identificar el mismo issue entre diferentes
    ejecuciones de análisis, facilitando el tracking de issues nuevos vs recurrentes.
    
    Args:
        issue_type: Tipo de issue (completeness, uniqueness, consistency, outliers, etc.)
        column_name: Nombre de la columna afectada (opcional)
        row_identifier: Identificador de fila(s) afectada(s) (opcional)
                       Puede ser un índice, rango, o hash de valores
        rule_key: Clave de la regla que detectó el issue (opcional)
        extra_params: Parámetros adicionales para mayor especificidad (opcional)
                     Ej: {"pattern": "\\d{4}", "threshold": 0.95}
    
    Returns:
        str: Hash SHA256 truncado a 16 caracteres (64 bits de entropía)
        
    Examples:
        >>> generate_issue_fingerprint("completeness", "email")
        'a1b2c3d4e5f67890'
        
        >>> generate_issue_fingerprint(
        ...     issue_type="consistency",
        ...     column_name="phone",
        ...     rule_key="pattern_check",
        ...     extra_params={"pattern": r"\\d{3}-\\d{4}"}
        ... )
        'f0e1d2c3b4a59687'
    """
    # Normalizar valores para consistencia
    components = [
        _normalize_value(issue_type),
        _normalize_value(column_name),
        _normalize_value(row_identifier),
        _normalize_value(rule_key),
    ]
    
    # Añadir extra_params ordenados alfabéticamente para determinismo
    if extra_params:
        sorted_params = sorted(extra_params.items())
        for key, value in sorted_params:
            components.append(f"{_normalize_value(key)}={_normalize_value(value)}")
    
    # Concatenar con delimitador que no aparezca en los datos
    fingerprint_data = "|".join(components)
    
    # Generar hash SHA256 y truncar a 16 caracteres
    hash_object = hashlib.sha256(fingerprint_data.encode('utf-8'))
    return hash_object.hexdigest()[:16]


def _normalize_value(value: Any) -> str:
    """Normaliza un valor para uso consistente en el fingerprint.
    
    Args:
        value: Valor a normalizar (puede ser None, str, int, float, list, etc.)
        
    Returns:
        str: Valor normalizado como string en minúsculas, o cadena vacía si None
    """
    if value is None:
        return ""
    
    if isinstance(value, (list, tuple)):
        # Ordenar listas para determinismo y convertir a string
        try:
            sorted_values = sorted(str(v).lower().strip() for v in value)
            return ",".join(sorted_values)
        except TypeError:
            # Si no se puede ordenar, mantener orden original
            return ",".join(str(v).lower().strip() for v in value)
    
    if isinstance(value, dict):
        # Ordenar diccionarios por clave
        sorted_items = sorted(value.items())
        return ",".join(f"{k}:{v}" for k, v in sorted_items)
    
    if isinstance(value, (int, float)):
        return str(value)
    
    # String: normalizar a minúsculas y quitar espacios
    return str(value).lower().strip()


def generate_column_issue_fingerprint(
    issue_type: str,
    column_name: str,
    metric_value: Optional[float] = None,
    threshold: Optional[float] = None
) -> str:
    """Genera fingerprint para issues a nivel de columna.
    
    Especialización para issues que afectan a una columna completa
    (ej: completeness bajo, uniqueness bajo).
    
    Args:
        issue_type: Tipo de issue (completeness, uniqueness, etc.)
        column_name: Nombre de la columna afectada
        metric_value: Valor de la métrica (opcional, no se usa en hash por defecto)
        threshold: Umbral configurado (opcional)
        
    Returns:
        str: Fingerprint de 16 caracteres
    """
    extra = {}
    if threshold is not None:
        extra["threshold"] = round(threshold, 4)  # Redondear para evitar problemas de precisión
    
    return generate_issue_fingerprint(
        issue_type=issue_type,
        column_name=column_name,
        rule_key=f"{issue_type}_column_check",
        extra_params=extra if extra else None
    )


def generate_row_issue_fingerprint(
    issue_type: str,
    column_name: str,
    row_indices: List[int],
    max_rows_in_hash: int = 10
) -> str:
    """Genera fingerprint para issues a nivel de fila.
    
    Especialización para issues que afectan filas específicas
    (ej: valores duplicados, outliers).
    
    Args:
        issue_type: Tipo de issue
        column_name: Nombre de la columna afectada
        row_indices: Lista de índices de filas afectadas
        max_rows_in_hash: Máximo de filas a incluir en el hash (para evitar hashes muy largos)
        
    Returns:
        str: Fingerprint de 16 caracteres
    """
    # Ordenar y limitar filas para determinismo y eficiencia
    sorted_rows = sorted(row_indices)[:max_rows_in_hash]
    row_identifier = ",".join(str(r) for r in sorted_rows)
    
    # Añadir count total si hay más filas que el máximo
    extra = {}
    if len(row_indices) > max_rows_in_hash:
        extra["total_rows"] = len(row_indices)
    
    return generate_issue_fingerprint(
        issue_type=issue_type,
        column_name=column_name,
        row_identifier=row_identifier,
        rule_key=f"{issue_type}_row_check",
        extra_params=extra if extra else None
    )


def generate_pattern_issue_fingerprint(
    column_name: str,
    pattern: str,
    invalid_count: Optional[int] = None
) -> str:
    """Genera fingerprint para issues de consistencia de patrón.
    
    Args:
        column_name: Nombre de la columna afectada
        pattern: Patrón regex que se esperaba
        invalid_count: Número de valores inválidos (no se usa en hash)
        
    Returns:
        str: Fingerprint de 16 caracteres
    """
    return generate_issue_fingerprint(
        issue_type="consistency_pattern",
        column_name=column_name,
        rule_key="pattern_check",
        extra_params={"pattern": pattern}
    )


def generate_duplicate_issue_fingerprint(
    column_name: Optional[str] = None,
    is_row_level: bool = False,
    duplicate_count: Optional[int] = None
) -> str:
    """Genera fingerprint para issues de duplicados.
    
    Args:
        column_name: Nombre de la columna (None si es a nivel de fila completa)
        is_row_level: True si son duplicados de filas completas
        duplicate_count: Número de duplicados (no se usa en hash)
        
    Returns:
        str: Fingerprint de 16 caracteres
    """
    if is_row_level:
        return generate_issue_fingerprint(
            issue_type="uniqueness",
            rule_key="row_duplicate_check"
        )
    else:
        return generate_issue_fingerprint(
            issue_type="uniqueness",
            column_name=column_name,
            rule_key="column_duplicate_check"
        )


def generate_syntactic_accuracy_fingerprint(
    column_name: str,
    expected_type: str,
    pattern: Optional[str] = None
) -> str:
    """Genera fingerprint para issues de exactitud sintáctica.

    Args:
        column_name: Nombre de la columna afectada
        expected_type: Tipo esperado (email, url, phone_es, dni_es, etc.)
        pattern: Patrón regex usado para la validación (opcional)

    Returns:
        str: Fingerprint de 16 caracteres
    """
    extra = {"expected_type": expected_type}
    if pattern:
        extra["pattern"] = pattern

    return generate_issue_fingerprint(
        issue_type="syntactic_accuracy",
        column_name=column_name,
        rule_key="type_conformance_check",
        extra_params=extra
    )


def generate_logical_consistency_fingerprint(
    rule_expression: str,
    rule_name: Optional[str] = None
) -> str:
    """Genera fingerprint para issues de consistencia lógica.

    Args:
        rule_expression: Expresión de la regla que se violó
        rule_name: Nombre descriptivo de la regla (opcional)

    Returns:
        str: Fingerprint de 16 caracteres
    """
    return generate_issue_fingerprint(
        issue_type="logical_consistency",
        rule_key="cross_field_check",
        extra_params={"expression": rule_expression}
    )


def generate_class_balance_fingerprint(
    column_name: str,
    imbalance_type: str = "general"
) -> str:
    """Genera fingerprint para issues de equilibrio de clases.

    Args:
        column_name: Nombre de la columna afectada
        imbalance_type: Tipo de desbalance ('dominant_class' o 'minority_class')

    Returns:
        str: Fingerprint de 16 caracteres
    """
    return generate_issue_fingerprint(
        issue_type="class_balance",
        column_name=column_name,
        rule_key=f"balance_{imbalance_type}"
    )


def generate_timeliness_fingerprint(
    column_name: str,
    staleness_threshold_days: int = 30
) -> str:
    """Genera fingerprint para issues de actualidad/frescura de datos.

    Args:
        column_name: Nombre de la columna de fecha afectada
        staleness_threshold_days: Umbral de días configurado

    Returns:
        str: Fingerprint de 16 caracteres
    """
    return generate_issue_fingerprint(
        issue_type="timeliness",
        column_name=column_name,
        rule_key="staleness_check",
        extra_params={"threshold_days": staleness_threshold_days}
    )


def generate_outlier_issue_fingerprint(
    column_name: str,
    method: str = "iqr",
    factor: float = 1.5
) -> str:
    """Genera fingerprint para issues de outliers.
    
    Args:
        column_name: Nombre de la columna afectada
        method: Método de detección (iqr, zscore)
        factor: Factor usado en la detección
        
    Returns:
        str: Fingerprint de 16 caracteres
    """
    return generate_issue_fingerprint(
        issue_type="outliers",
        column_name=column_name,
        rule_key=f"outlier_{method}_check",
        extra_params={"method": method, "factor": round(factor, 2)}
    )
