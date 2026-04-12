from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
import logging

from extensions import db
from models.project import Project
from models.analysis import AnalysisRun, AnalysisStatus, DataQualityIssue

logger = logging.getLogger(__name__)

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/dashboard')


@dashboard_bp.route('/summary', methods=['GET'])
@jwt_required()
def get_dashboard_summary():
    """
    Endpoint agregado que devuelve toda la informacion necesaria para el dashboard
    en una sola llamada. Incluye proyectos, ultimo analisis, historial de runs
    y estadisticas globales.

    Query Parameters:
        history_days (int): Dias de historial de runs a incluir (default: 90)
    """
    current_user_id = get_jwt_identity()

    try:
        current_user_id = int(current_user_id)
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'ID de usuario invalido'}), 401

    try:
        history_days = request.args.get('history_days', 90, type=int)
        history_since = datetime.utcnow() - timedelta(days=history_days)

        # Obtener todos los proyectos del usuario
        projects = Project.query.filter_by(owner_id=current_user_id).all()

        # Inicializar contadores de agregacion
        total_datasets = 0
        total_issues = 0
        critical_issues = 0
        quality_scores = []
        gate_distribution = {'passed': 0, 'warning': 0, 'failed': 0, 'no_analysis': 0}
        severity_distribution = {'critical': 0, 'major': 0, 'minor': 0, 'info': 0}

        projects_data = []

        for project in projects:
            dataset_count = len(project.datasets) if project.datasets else 0
            total_datasets += dataset_count

            # Ultimo analisis completado
            latest_run = (
                AnalysisRun.query
                .filter_by(project_id=project.id)
                .filter(AnalysisRun.status == 'COMPLETED')
                .order_by(AnalysisRun.completed_at.desc())
                .first()
            )

            latest_analysis_data = None
            if latest_run:
                latest_analysis_data = {
                    'id': latest_run.id,
                    'quality_score': float(latest_run.quality_score) if latest_run.quality_score is not None else None,
                    'quality_gate_status': latest_run.quality_gate_status.value if latest_run.quality_gate_status else None,
                    'total_issues_count': latest_run.total_issues_count or 0,
                    'critical_issues_count': latest_run.critical_issues_count or 0,
                    'new_issues_count': latest_run.new_issues_count or 0,
                    'fixed_issues_count': latest_run.fixed_issues_count or 0,
                    'completed_at': latest_run.completed_at.isoformat() if latest_run.completed_at else None,
                }

                # Desglose de severidad por proyecto
                project_sev_rows = (
                    db.session.query(DataQualityIssue.severity, db.func.count(DataQualityIssue.id))
                    .filter(DataQualityIssue.analysis_run_id == latest_run.id)
                    .group_by(DataQualityIssue.severity)
                    .all()
                )
                project_sev = {'critical': 0, 'major': 0, 'minor': 0, 'info': 0}
                for sev, cnt in project_sev_rows:
                    if sev in project_sev:
                        project_sev[sev] = cnt
                latest_analysis_data['issue_severity_breakdown'] = project_sev

                # Agregar a estadisticas globales
                if latest_run.quality_score is not None:
                    quality_scores.append(latest_run.quality_score)
                total_issues += latest_run.total_issues_count or 0
                critical_issues += latest_run.critical_issues_count or 0

                gate_status = latest_run.quality_gate_status.value if latest_run.quality_gate_status else None
                if gate_status == 'PASSED':
                    gate_distribution['passed'] += 1
                elif gate_status == 'WARNING':
                    gate_distribution['warning'] += 1
                elif gate_status == 'FAILED':
                    gate_distribution['failed'] += 1
                else:
                    gate_distribution['no_analysis'] += 1

                # Distribucion de severidad de issues del ultimo run
                issue_severities = (
                    db.session.query(DataQualityIssue.severity, db.func.count(DataQualityIssue.id))
                    .filter_by(analysis_run_id=latest_run.id)
                    .group_by(DataQualityIssue.severity)
                    .all()
                )
                for sev, count in issue_severities:
                    if sev in severity_distribution:
                        severity_distribution[sev] += count
            else:
                gate_distribution['no_analysis'] += 1

            # Historial de runs dentro del rango temporal
            runs_history = (
                AnalysisRun.query
                .filter_by(project_id=project.id)
                .filter(AnalysisRun.status == 'COMPLETED')
                .filter(AnalysisRun.created_at >= history_since)
                .order_by(AnalysisRun.created_at.asc())
                .all()
            )

            runs_history_data = []
            for run in runs_history:
                runs_history_data.append({
                    'id': run.id,
                    'quality_gate_status': run.quality_gate_status.value if run.quality_gate_status else None,
                    'quality_score': float(run.quality_score) if run.quality_score is not None else None,
                    'status': run.status.value if run.status else None,
                    'total_issues_count': run.total_issues_count or 0,
                    'critical_issues_count': run.critical_issues_count or 0,
                    'completed_at': run.completed_at.isoformat() if run.completed_at else None,
                    'created_at': run.created_at.isoformat() if run.created_at else None,
                })

            projects_data.append({
                'id': project.id,
                'name': project.name,
                'dataset_count': dataset_count,
                'latest_analysis': latest_analysis_data,
                'runs_history': runs_history_data,
            })

        # Calcular score medio
        avg_quality_score = round(sum(quality_scores) / len(quality_scores), 1) if quality_scores else None

        return jsonify({
            'success': True,
            'data': {
                'projects': projects_data,
                'aggregated': {
                    'total_projects': len(projects),
                    'total_datasets': total_datasets,
                    'avg_quality_score': avg_quality_score,
                    'total_issues': total_issues,
                    'critical_issues': critical_issues,
                    'gate_distribution': gate_distribution,
                    'issue_severity_distribution': severity_distribution,
                },
            },
        }), 200

    except Exception as e:
        logger.error(f"Error al obtener resumen del dashboard: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error al obtener resumen del dashboard: {str(e)}'
        }), 500
