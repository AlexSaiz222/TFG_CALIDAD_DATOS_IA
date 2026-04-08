"""Script para actualizar métricas a español en la base de datos existente"""
from app import create_app
from extensions import db
from models import Metric, Issue

app = create_app()

with app.app_context():
    print("🔄 Actualizando métricas a español...")
    
    # 1. Eliminar issues que referencian métricas obsoletas
    obsolete_metrics = ['drift', 'distribution', 'accuracy', 'consistency', 'feature_correlation']
    obsolete_metric_ids = [m.id for m in Metric.query.filter(Metric.name.in_(obsolete_metrics)).all()]
    
    if obsolete_metric_ids:
        # Eliminar de ambas tablas de issues
        deleted_issues_1 = Issue.query.filter(Issue.metric_id.in_(obsolete_metric_ids)).delete(synchronize_session=False)
        
        # Eliminar también de data_quality_issues si existe
        from sqlalchemy import text
        result = db.session.execute(
            text("DELETE FROM data_quality_issues WHERE metric_id IN :ids"),
            {"ids": tuple(obsolete_metric_ids)}
        )
        deleted_issues_2 = result.rowcount
        
        print(f"✅ Eliminados {deleted_issues_1} issues de tabla 'issues'")
        print(f"✅ Eliminados {deleted_issues_2} issues de tabla 'data_quality_issues'")
        db.session.commit()
    
    # 2. Eliminar métricas obsoletas
    deleted_metrics = Metric.query.filter(Metric.name.in_(obsolete_metrics)).delete(synchronize_session=False)
    print(f"✅ Eliminadas {deleted_metrics} métricas obsoletas: {', '.join(obsolete_metrics)}")
    
    # 3. Actualizar métricas existentes a español
    updates = [
        {
            'name': 'completeness',
            'description': 'Mide el porcentaje de valores no nulos en cada columna. Detecta campos vacíos, nulos o faltantes que pueden afectar la calidad del análisis.',
            'category': 'data_quality',
            'parameters': {"threshold": 0.95, "columns": []}
        },
        {
            'name': 'uniqueness',
            'description': 'Detecta filas duplicadas y mide la variabilidad de valores únicos por columna. Identifica problemas de duplicación y baja cardinalidad.',
            'category': 'data_quality',
            'parameters': {"threshold": 1.0, "columns": []}
        },
        {
            'name': 'outliers',
            'description': 'Detecta valores atípicos en columnas numéricas usando métodos estadísticos (IQR, Z-score). Identifica datos anómalos que pueden ser errores o casos excepcionales.',
            'category': 'data_quality',
            'parameters': {"method": "iqr", "factor": 1.5, "columns": []}
        },
        {
            'name': 'currentness',
            'description': 'Evalúa la frescura y antigüedad de fechas (Currentness, ISO 5259-2 Cur-ML-1). Detecta datos obsoletos o fuera del rango temporal esperado.',
            'category': 'data_quality',
            'parameters': {"columns": [], "staleness_threshold_days": 30, "auto_detect": True}
        },
        {
            'name': 'class_balance',
            'description': 'Mide el equilibrio en la distribución de variables categóricas. Detecta desbalances que pueden afectar modelos de clasificación.',
            'category': 'distribution',
            'parameters': {"columns": [], "auto_detect": True, "imbalance_threshold_high": 0.90, "imbalance_threshold_low": 0.05, "max_cardinality": 50}
        }
    ]
    
    for update in updates:
        metric = Metric.query.filter_by(name=update['name']).first()
        if metric:
            metric.description = update['description']
            metric.category = update['category']
            metric.parameters = update['parameters']
            print(f"✅ Actualizada métrica: {update['name']}")
    
    # 4. Insertar métricas nuevas si no existen
    new_metrics = [
        {
            'name': 'syntactic_accuracy',
            'description': 'Valida que los valores cumplan con el tipo de dato esperado, patrones regex o restricciones de longitud. Detecta errores de formato y valores mal tipados.',
            'category': 'accuracy',
            'parameters': {"columns": [], "auto_detect_types": True, "threshold": 0.95}
        },
        {
            'name': 'logical_consistency',
            'description': 'Valida reglas lógicas entre campos dentro de cada registro. Detecta inconsistencias como fechas de fin anteriores a fechas de inicio o valores mutuamente excluyentes.',
            'category': 'consistency',
            'parameters': {"rules": []}
        }
    ]
    
    for new_metric_data in new_metrics:
        existing = Metric.query.filter_by(name=new_metric_data['name']).first()
        if not existing:
            new_metric = Metric(**new_metric_data)
            db.session.add(new_metric)
            print(f"✅ Insertada nueva métrica: {new_metric_data['name']}")
        else:
            # Actualizar si ya existe
            existing.description = new_metric_data['description']
            existing.category = new_metric_data['category']
            existing.parameters = new_metric_data['parameters']
            print(f"✅ Actualizada métrica existente: {new_metric_data['name']}")
    
    # Commit de todos los cambios
    db.session.commit()
    
    # 5. Verificar resultado
    print("\n📊 Métricas finales en la base de datos:")
    all_metrics = Metric.query.order_by(Metric.name).all()
    for m in all_metrics:
        desc_preview = m.description[:60] + '...' if len(m.description) > 60 else m.description
        print(f"  • {m.name}: {desc_preview}")
    
    print(f"\n✅ Total de métricas activas: {len(all_metrics)}")
    print("🎉 ¡Actualización completada!")
