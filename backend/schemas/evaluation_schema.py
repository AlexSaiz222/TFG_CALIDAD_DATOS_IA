"""
Esquemas de validación para evaluaciones.

Este módulo proporciona esquemas Marshmallow para validar y serializar
datos relacionados con evaluaciones de calidad de datos.
"""

from marshmallow import Schema, fields, validate, validates, ValidationError

class MetricSchema(Schema):
    """Esquema para validar una métrica individual"""
    id = fields.String(required=True)
    name = fields.String()
    parameters = fields.Dict(keys=fields.String(), values=fields.Raw())
    weight = fields.Float(validate=validate.Range(min=0, max=1), default=1.0)
    
    @validates('id')
    def validate_metric_id(self, value):
        """Valida que el ID de la métrica sea válido"""
        valid_metrics = [
            'completeness', 'uniqueness',
            'timeliness', 'validity', 'integrity', 'conformity',
            'outliers', 'correlation',
            'syntactic_accuracy', 'logical_consistency', 'class_balance',
        ]
        if value not in valid_metrics:
            raise ValidationError(f"Métrica no válida. Opciones disponibles: {', '.join(valid_metrics)}")

class EvaluationOptionsSchema(Schema):
    """Esquema para validar opciones de evaluación"""
    sample_size = fields.Float(validate=validate.Range(min=0.1, max=1.0), default=1.0)
    timeout = fields.Integer(validate=validate.Range(min=10, max=3600), default=300)
    include_profiling = fields.Boolean(default=True)
    notification_email = fields.Email(allow_none=True)
    save_results = fields.Boolean(default=True)

class CreateEvaluationSchema(Schema):
    """Esquema para validar la creación de una evaluación"""
    metrics = fields.List(
        fields.Nested(MetricSchema), 
        required=True,
        validate=validate.Length(min=1, error="Debe especificar al menos una métrica")
    )
    options = fields.Nested(EvaluationOptionsSchema, default={})
    
    @validates('metrics')
    def validate_metrics(self, metrics):
        """Valida que no haya métricas duplicadas"""
        metric_ids = [m.get('id') for m in metrics if m.get('id')]
        if len(metric_ids) != len(set(metric_ids)):
            raise ValidationError("No se permiten métricas duplicadas")

class EvaluationFilterSchema(Schema):
    """Esquema para validar filtros de búsqueda de evaluaciones"""
    status = fields.String(validate=validate.OneOf(['pending', 'processing', 'completed', 'failed']))
    dataset_id = fields.Integer(strict=True)
    page = fields.Integer(strict=True, validate=validate.Range(min=1), default=1)
    per_page = fields.Integer(strict=True, validate=validate.Range(min=1, max=100), default=20)

class CompareEvaluationsSchema(Schema):
    """Esquema para validar parámetros de comparación de evaluaciones"""
    evaluation_id_1 = fields.Integer(strict=True, required=True, validate=validate.Range(min=1))
    evaluation_id_2 = fields.Integer(strict=True, required=True, validate=validate.Range(min=1))
    
    @validates('evaluation_id_2')
    def validate_different_ids(self, value, **kwargs):
        """Valida que los IDs de evaluación sean diferentes"""
        evaluation_id_1 = kwargs.get('data', {}).get('evaluation_id_1')
        if evaluation_id_1 and value == evaluation_id_1:
            raise ValidationError("Los IDs de evaluación deben ser diferentes")

# Instancias de esquemas para uso directo
create_evaluation_schema = CreateEvaluationSchema()
evaluation_filter_schema = EvaluationFilterSchema()
compare_evaluations_schema = CompareEvaluationsSchema()
