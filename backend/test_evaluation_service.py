#!/usr/bin/env python
"""
Script para probar la funcionalidad del servicio de evaluaciones.
Este script prueba directamente el servicio de evaluación sin depender de la aplicación Flask.
"""
import os
import sys
import json
import pandas as pd
import io
from datetime import datetime
from unittest.mock import patch, MagicMock

# Asegurar que podemos importar desde el directorio actual
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Generar datos de prueba
def generate_test_csv():
    """Generate a test CSV file for evaluation"""
    data = """
id,nombre,email,edad,salario
1,Juan Pérez,juan@example.com,30,50000
2,María García,maria@example.com,25,45000
3,Carlos López,carlos@example.com,40,60000
4,Ana Martínez,ana@example.com,35,55000
5,Pedro Sánchez,pedro@example.com,28,48000
6,Laura Fernández,laura@example.com,32,52000
7,Miguel Rodríguez,miguel@example.com,45,65000
8,Carmen Díaz,carmen@example.com,38,58000
9,Javier Ruiz,javier@example.com,42,62000
10,Isabel Gómez,isabel@example.com,29,49000
"""
    return data

def test_evaluation_service():
    """Prueba la funcionalidad del servicio de evaluación"""
    print("=" * 50)
    print("PRUEBA DEL SERVICIO DE EVALUACIÓN")
    print("=" * 50)
    
    # Importar Flask y crear una aplicación
    from flask import Flask
    from extensions import db
    
    # Crear una aplicación Flask simple para pruebas
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    
    # Importar el servicio de evaluación
    from services.evaluation_service import EvaluationService
    
    # Crear una instancia del servicio
    evaluation_service = EvaluationService()
    
    # Crear un mock para MinioService
    mock_minio = MagicMock()
    mock_minio.download_file.return_value = generate_test_csv().encode('utf-8')
    
    # Reemplazar el servicio MinIO en el servicio de evaluación
    evaluation_service.minio_service = mock_minio
    
    # Crear un mock para la clase Evaluation
    mock_evaluation = MagicMock()
    mock_evaluation.id = 1
    mock_evaluation.dataset_id = 1
    mock_evaluation.metrics_config = {
        'metrics': [
            {
                'id': 'completeness',
                'parameters': {
                    'columns': ['nombre', 'email']
                },
                'weight': 1.0
            },
            {
                'id': 'uniqueness',
                'parameters': {
                    'columns': ['id', 'email']
                },
                'weight': 1.0
            }
        ],
        'options': {
            'sample_size': 1.0
        }
    }
    mock_evaluation.status = 'pending'
    mock_evaluation.progress = 0
    mock_evaluation.current_step = 'Iniciando evaluación'
    
    # Crear un mock para la clase Dataset
    mock_dataset = MagicMock()
    mock_dataset.id = 1
    mock_dataset.file_path = 'test/test_dataset.csv'
    mock_dataset.name = 'Dataset de Prueba'
    
    # Crear un mock para la consulta de base de datos
    mock_db_query = MagicMock()
    mock_db_query.get.return_value = mock_evaluation
    
    # Crear un mock para la clase db
    mock_db = MagicMock()
    mock_db.session.commit = MagicMock()
    
    # Crear un mock para la clase Issue
    mock_issue = MagicMock()
    
    # Aplicar los patches dentro del contexto de la aplicación
    with app.app_context(), \
         patch('services.evaluation_service.Evaluation.query', mock_db_query), \
         patch('services.evaluation_service.Dataset.query', mock_db_query), \
         patch('services.evaluation_service.db', mock_db), \
         patch('services.evaluation_service.Issue', mock_issue):
        
        # Configurar el mock de Dataset.query.get para devolver mock_dataset
        mock_db_query.get.side_effect = lambda id: mock_evaluation if id == 1 else mock_dataset
        
        try:
            print("\nEjecutando evaluación...")
            result = evaluation_service.run_evaluation(1)
            print(f"✅ Evaluación completada con éxito")
            print(f"Resultado: {json.dumps(result, indent=2)}")
            
            # Verificar que se llamó a commit
            print("\nVerificando llamadas a la base de datos...")
            if mock_db.session.commit.called:
                print("✅ Se llamó a db.session.commit()")
            else:
                print("❌ No se llamó a db.session.commit()")
            
            # Verificar que se actualizó el estado de la evaluación
            print("\nVerificando actualización de la evaluación...")
            print(f"Estado: {mock_evaluation.status}")
            print(f"Progreso: {mock_evaluation.progress}")
            print(f"Puntuación de calidad: {mock_evaluation.quality_score}")
            
            # Verificar que se crearon issues
            print("\nVerificando creación de issues...")
            if mock_issue.called:
                print(f"✅ Se crearon {mock_issue.call_count} issues")
            else:
                print("❓ No se detectaron llamadas a Issue()")
            
            print("\n✅ Prueba completada con éxito")
            
        except Exception as e:
            print(f"\n❌ Error durante la prueba: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    test_evaluation_service()
