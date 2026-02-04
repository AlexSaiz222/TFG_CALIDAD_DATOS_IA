"""
Script para generar datos de prueba de AnalysisRun y DataQualityIssue.

Uso:
    cd backend
    python scripts/seed_analysis_data.py

Este script crea análisis de ejemplo con issues para probar:
- QualityGateBadge en tarjetas de proyecto
- AnalysisHistory con historial de análisis
- QualityTrendChart con gráficos de tendencia
- IssuesList con lista de issues filtrable
- Página de detalle de AnalysisRun
"""

import sys
import os
from datetime import datetime, timedelta
import random
import hashlib

# Añadir el directorio padre al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from extensions import db
from models.analysis import AnalysisRun, AnalysisStatus, QualityGateStatus, DataQualityIssue
from models.project import Project
from models.dataset import Dataset


def generate_fingerprint(issue_type: str, column: str, description: str) -> str:
    """Genera un fingerprint único para un issue."""
    content = f"{issue_type}:{column}:{description}"
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def create_sample_issues(analysis_run_id: int, num_issues: int, is_first_run: bool = False):
    """Crea issues de ejemplo para un análisis."""
    issue_types = [
        ('completeness', 'Valores nulos detectados'),
        ('uniqueness', 'Valores duplicados encontrados'),
        ('consistency', 'Formato inconsistente'),
        ('validity', 'Valores fuera de rango'),
        ('accuracy', 'Valores atípicos detectados'),
    ]
    
    severities = ['critical', 'major', 'minor', 'info']
    severity_weights = [0.1, 0.3, 0.4, 0.2]  # Distribución realista
    
    columns = ['id', 'name', 'email', 'phone', 'address', 'created_at', 'status', 'amount', 'category']
    
    issues = []
    for i in range(num_issues):
        issue_type, base_description = random.choice(issue_types)
        severity = random.choices(severities, weights=severity_weights)[0]
        column = random.choice(columns)
        
        # Generar descripción específica
        if issue_type == 'completeness':
            null_rate = random.uniform(0.01, 0.3)
            description = f"Columna '{column}' tiene {null_rate*100:.1f}% de valores nulos"
            affected_columns = [{'column': column, 'null_rate': null_rate}]
        elif issue_type == 'uniqueness':
            dup_count = random.randint(10, 500)
            description = f"Se encontraron {dup_count} valores duplicados en '{column}'"
            affected_columns = [column]
        elif issue_type == 'consistency':
            description = f"Formato inconsistente en columna '{column}'"
            affected_columns = [column]
        elif issue_type == 'validity':
            description = f"Valores fuera del rango esperado en '{column}'"
            affected_columns = [column]
        else:
            outlier_count = random.randint(5, 50)
            description = f"Detectados {outlier_count} valores atípicos en '{column}'"
            affected_columns = [column]
        
        fingerprint = generate_fingerprint(issue_type, column, description[:50])
        
        issue = DataQualityIssue(
            analysis_run_id=analysis_run_id,
            fingerprint=fingerprint,
            issue_type=issue_type,
            severity=severity,
            description=description,
            affected_columns=affected_columns,
            affected_row_count=random.randint(1, 1000),
            is_new=is_first_run or random.random() > 0.6,  # 40% recurrentes si no es primer run
            rule_key=f"{issue_type}_check",
        )
        issues.append(issue)
    
    return issues


def create_analysis_runs_for_project(project_id: int, dataset_id: int, num_runs: int = 5):
    """Crea una serie de análisis para un proyecto, simulando evolución temporal."""
    
    print(f"\n  Creando {num_runs} análisis para proyecto {project_id}...")
    
    runs = []
    base_date = datetime.utcnow() - timedelta(days=num_runs * 7)
    
    # Simular mejora gradual del quality score
    base_score = random.uniform(60, 75)
    
    for i in range(num_runs):
        run_date = base_date + timedelta(days=i * 7 + random.randint(0, 2))
        
        # Simular mejora gradual con algo de variación
        score_improvement = i * random.uniform(2, 5)
        quality_score = min(98, base_score + score_improvement + random.uniform(-3, 3))
        
        # Determinar Quality Gate status basado en score
        if quality_score >= 80:
            gate_status = QualityGateStatus.PASSED
        elif quality_score >= 60:
            gate_status = QualityGateStatus.WARNING
        else:
            gate_status = QualityGateStatus.FAILED
        
        # Número de issues decrece con el tiempo (mejora)
        base_issues = random.randint(15, 30)
        num_issues = max(3, base_issues - i * 3)
        
        # Crear AnalysisRun
        analysis_run = AnalysisRun(
            project_id=project_id,
            dataset_id=dataset_id,
            status=AnalysisStatus.COMPLETED,
            quality_gate_status=gate_status,
            quality_score=quality_score,
            total_issues_count=num_issues,
            critical_issues_count=random.randint(0, max(1, num_issues // 5)),
            new_issues_count=random.randint(1, max(2, num_issues // 3)),
            fixed_issues_count=random.randint(0, 5) if i > 0 else 0,
            progress=100,
            current_step="Análisis completado",
            created_at=run_date,
            started_at=run_date,
            completed_at=run_date + timedelta(minutes=random.randint(2, 10)),
            metrics_config={'metrics': [
                {'id': 'completeness', 'parameters': {'threshold': 0.95}},
                {'id': 'uniqueness', 'parameters': {'threshold': 1.0}},
                {'id': 'consistency', 'parameters': {}},
            ]},
            results={
                'overall': {
                    'quality_score': quality_score,
                    'metrics_processed': 3,
                },
                'diff': {
                    'new_issues_count': random.randint(1, 5),
                    'fixed_issues_count': random.randint(0, 3),
                    'recurrent_issues_count': num_issues - random.randint(1, 5),
                }
            }
        )
        
        db.session.add(analysis_run)
        db.session.flush()  # Para obtener el ID
        
        # Establecer baseline (el análisis anterior)
        if runs:
            analysis_run.baseline_analysis_id = runs[-1].id
        
        # Crear issues para este análisis
        issues = create_sample_issues(analysis_run.id, num_issues, is_first_run=(i == 0))
        for issue in issues:
            db.session.add(issue)
        
        runs.append(analysis_run)
        print(f"    ✓ Run {i+1}: Score={quality_score:.1f}%, Gate={gate_status.value}, Issues={num_issues}")
    
    return runs


def seed_analysis_data():
    """Función principal para sembrar datos de prueba."""
    
    app = create_app()
    
    with app.app_context():
        print("\n" + "="*60)
        print("SEED: Generando datos de prueba para Sonar-Lite")
        print("="*60)
        
        # Obtener proyectos existentes
        projects = Project.query.all()
        
        if not projects:
            print("\n⚠️  No hay proyectos en la base de datos.")
            print("   Primero crea un proyecto y un dataset desde el frontend.")
            return
        
        print(f"\nProyectos encontrados: {len(projects)}")
        
        created_runs = 0
        created_issues = 0
        
        for project in projects:
            print(f"\n📁 Proyecto: {project.name} (ID: {project.id})")
            
            # Verificar si ya tiene análisis
            existing_runs = AnalysisRun.query.filter_by(project_id=project.id).count()
            if existing_runs > 0:
                print(f"   ⏭️  Ya tiene {existing_runs} análisis, saltando...")
                continue
            
            # Obtener datasets del proyecto
            datasets = Dataset.query.filter_by(project_id=project.id).all()
            
            if not datasets:
                print(f"   ⚠️  No tiene datasets, saltando...")
                continue
            
            # Usar el primer dataset
            dataset = datasets[0]
            print(f"   📊 Dataset: {dataset.name} (ID: {dataset.id})")
            
            # Crear análisis de prueba
            num_runs = random.randint(4, 8)
            runs = create_analysis_runs_for_project(project.id, dataset.id, num_runs)
            
            created_runs += len(runs)
            for run in runs:
                created_issues += run.total_issues_count
        
        # Guardar cambios
        db.session.commit()
        
        print("\n" + "="*60)
        print(f"✅ SEED COMPLETADO")
        print(f"   - Análisis creados: {created_runs}")
        print(f"   - Issues creados: {created_issues}")
        print("="*60 + "\n")


if __name__ == '__main__':
    seed_analysis_data()
