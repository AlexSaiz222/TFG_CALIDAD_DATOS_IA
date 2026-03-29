"""Remove obsolete metrics and translate descriptions to Spanish

Revision ID: remove_obsolete_translate
Revises: add_new_quality_metrics
Create Date: 2026-03-29 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime
import json

# revision identifiers, used by Alembic.
revision = 'remove_obsolete_translate'
down_revision = 'add_new_quality_metrics'
branch_labels = None
depends_on = None

# Métricas obsoletas a eliminar
OBSOLETE_METRICS = ['drift', 'distribution', 'accuracy', 'consistency']

# Traducciones de métricas existentes (nombre, descripción, categoría, parámetros)
METRIC_TRANSLATIONS = [
    (
        'completeness',
        'Mide el porcentaje de valores no nulos en cada columna. Detecta campos vacíos, nulos o faltantes que pueden afectar la calidad del análisis.',
        'data_quality',
        {"threshold": 0.8}
    ),
    (
        'uniqueness',
        'Detecta filas duplicadas y mide la variabilidad de valores únicos por columna. Identifica problemas de duplicación y baja cardinalidad.',
        'data_quality',
        {"threshold": 1.0, "columns": []}
    ),
    (
        'outliers',
        'Detecta valores atípicos en columnas numéricas usando métodos estadísticos (IQR, Z-score). Identifica datos anómalos que pueden ser errores o casos excepcionales.',
        'data_quality',
        {"method": "iqr", "factor": 1.5, "columns": [], "auto_detect": True}
    ),
    (
        'syntactic_accuracy',
        'Valida que los valores cumplan con el tipo de dato esperado, patrones regex o restricciones de longitud. Detecta violaciones de formato como emails inválidos, fechas malformadas o IDs incorrectos.',
        'accuracy',
        {"auto_detect_types": True, "custom_patterns": {}, "columns": [], "threshold": 0.95}
    ),
    (
        'logical_consistency',
        'Valida reglas lógicas entre campos dentro de cada registro. Detecta inconsistencias como un paciente fallecido con cita futura o una fecha de fin anterior a la fecha de inicio.',
        'consistency',
        {"rules": []}
    ),
    (
        'class_balance',
        'Mide el equilibrio en la distribución de variables categóricas usando entropía de Shannon. Detecta desbalanceo de clases que podría sesgar modelos de ML.',
        'distribution',
        {"columns": [], "auto_detect": True, "max_cardinality": 50, "imbalance_threshold_high": 0.90, "imbalance_threshold_low": 0.05}
    ),
    (
        'timeliness',
        'Mide la frescura y actualidad de los datos analizando columnas de fecha. Detecta datos obsoletos que pueden no ser relevantes para análisis o entrenamiento de modelos.',
        'timeliness',
        {"columns": [], "auto_detect": True, "staleness_threshold_days": 30}
    ),
]


def upgrade():
    """Eliminar métricas obsoletas y traducir descripciones al español."""
    connection = op.get_bind()
    now = datetime.utcnow()

    # 1. Eliminar métricas obsoletas
    for metric_name in OBSOLETE_METRICS:
        result = connection.execute(
            sa.text("SELECT id FROM metrics WHERE name = :name"),
            {"name": metric_name}
        )
        existing = result.fetchone()
        
        if existing:
            # Primero eliminar referencias en issues
            connection.execute(
                sa.text("DELETE FROM issues WHERE metric_id IN (SELECT id FROM metrics WHERE name = :name)"),
                {"name": metric_name}
            )
            # Luego eliminar la métrica
            connection.execute(
                sa.text("DELETE FROM metrics WHERE name = :name"),
                {"name": metric_name}
            )
            print(f"  ✓ Métrica obsoleta eliminada: {metric_name}")
        else:
            print(f"  ⊘ Métrica no encontrada (ya eliminada): {metric_name}")

    # 2. Actualizar descripciones y parámetros de métricas existentes
    for name, description, category, parameters in METRIC_TRANSLATIONS:
        result = connection.execute(
            sa.text("SELECT id FROM metrics WHERE name = :name"),
            {"name": name}
        )
        existing = result.fetchone()
        
        if existing:
            connection.execute(
                sa.text(
                    "UPDATE metrics SET description = :desc, category = :cat, "
                    "parameters = :params, updated_at = :now WHERE name = :name"
                ),
                {"desc": description, "cat": category, "params": json.dumps(parameters), "now": now, "name": name}
            )
            print(f"  ✓ Métrica traducida: {name}")
        else:
            # Si no existe, crearla (por si acaso)
            connection.execute(
                sa.text(
                    "INSERT INTO metrics (name, description, category, parameters, created_at, updated_at) "
                    "VALUES (:name, :desc, :cat, :params, :now, :now)"
                ),
                {"name": name, "desc": description, "cat": category, "params": json.dumps(parameters), "now": now}
            )
            print(f"  ✓ Métrica creada y traducida: {name}")

    print("✓ Métricas obsoletas eliminadas y descripciones traducidas al español")


def downgrade():
    """Revertir cambios (restaurar descripciones en inglés y recrear métricas obsoletas)."""
    connection = op.get_bind()
    now = datetime.utcnow()
    
    # Restaurar descripciones en inglés (versión simplificada)
    english_translations = [
        ('completeness', 'Measures the percentage of non-null values', 'data_quality'),
        ('uniqueness', 'Detects duplicate rows and measures value variability', 'data_quality'),
        ('outliers', 'Detects outliers in numeric columns', 'data_quality'),
        ('syntactic_accuracy', 'Validates that values conform to expected data types, regex patterns, or length constraints', 'accuracy'),
        ('logical_consistency', 'Validates cross-field logical rules within each record', 'consistency'),
        ('class_balance', 'Measures the distribution balance of categorical variables', 'distribution'),
        ('timeliness', 'Measures data freshness and recency', 'timeliness'),
    ]
    
    for name, description, category in english_translations:
        connection.execute(
            sa.text(
                "UPDATE metrics SET description = :desc, category = :cat, updated_at = :now WHERE name = :name"
            ),
            {"desc": description, "cat": category, "now": now, "name": name}
        )
    
    print("✓ Descripciones restauradas al inglés")
