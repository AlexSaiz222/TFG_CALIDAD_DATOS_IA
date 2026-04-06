from datetime import datetime
import pandas as pd
import numpy as np
import io
import logging

from extensions import db
from models.evaluation import Evaluation, Issue
from models.analysis import AnalysisRun, AnalysisStatus, QualityGateStatus, DataQualityIssue
from models.dataset import Dataset
from models.metric import Metric
from services.dataset_service import DatasetService
from services.minio_service import MinioService
from services.metrics import get_metric
from utils.fingerprint_utils import generate_issue_fingerprint

logger = logging.getLogger(__name__)

class EvaluationService:
    """Service for running data quality evaluations"""
    
    def __init__(self):
        """Initialize evaluation service"""
        self.dataset_service = DatasetService()
        self.minio_service = MinioService()
    
    def _update_progress(self, evaluation_id, progress, current_step, analysis_run_id=None):
        """Update evaluation progress in the database using direct SQL update
        
        Args:
            evaluation_id: ID of the evaluation (legacy)
            progress: Progress percentage (0-100)
            current_step: Description of current step
            analysis_run_id: ID of the AnalysisRun (Sonar-Lite)
        """
        try:
            from sqlalchemy import text
            progress_value = min(99, max(0, progress))  # Cap at 99 until complete
            
            logger.info(f"[PROGRESS] Updating evaluation {evaluation_id}: {progress_value}% - {current_step}")
            
            # Update legacy Evaluation table
            result = db.session.execute(
                text("UPDATE evaluations SET progress = :progress, current_step = :step, status = 'processing' WHERE id = :id"),
                {"progress": progress_value, "step": current_step, "id": evaluation_id}
            )
            
            # Update new AnalysisRun table (Sonar-Lite)
            if analysis_run_id:
                db.session.execute(
                    text("UPDATE analysis_runs SET progress = :progress, current_step = :step, status = 'RUNNING' WHERE id = :id"),
                    {"progress": progress_value, "step": current_step, "id": analysis_run_id}
                )
            
            db.session.commit()
            
            logger.info(f"[PROGRESS] Updated evaluation {evaluation_id}: rows affected = {result.rowcount}")
        except Exception as e:
            logger.error(f"[PROGRESS] Failed to update progress for evaluation {evaluation_id}: {e}")
            db.session.rollback()
    
    def _generate_issue_fingerprint_legacy(self, rule_key, column_name, issue_type, description_hash):
        """[DEPRECATED] Legacy fingerprint generation - use utils.fingerprint_utils instead
        
        This method is kept for backward compatibility but new code should use
        the functions from utils.fingerprint_utils module.
        
        Args:
            rule_key: The rule that generated the issue
            column_name: The affected column (if any)
            issue_type: Type of issue (completeness, uniqueness, etc.)
            description_hash: Hash of the description for uniqueness
            
        Returns:
            str: SHA256 fingerprint (first 16 chars)
        """
        # Delegate to new utility function for consistency
        return generate_issue_fingerprint(
            issue_type=issue_type,
            column_name=column_name,
            rule_key=rule_key,
            extra_params={"desc_hash": description_hash} if description_hash else None
        )
    
    def _evaluate_quality_gate(self, analysis_run, quality_score, issues, results):
        """Evaluate Quality Gate status based on configurable thresholds.
        
        Reads thresholds from the project's QualityGate config in the database.
        Falls back to default thresholds if no QualityGate is configured.
        
        Args:
            analysis_run: The AnalysisRun being evaluated
            quality_score: Overall quality score (0.0 - 1.0 scale)
            issues: List of issue dictionaries from the evaluation
            results: Results dictionary containing metric values
            
        Returns:
            QualityGateStatus: PASSED, FAILED, or WARNING
        """
        from models.analysis import QualityGate as QualityGateModel
        
        # Load thresholds from project's QualityGate config (or use defaults)
        quality_gate_config = QualityGateModel.query.filter_by(
            project_id=analysis_run.project_id
        ).first()
        
        if quality_gate_config and quality_gate_config.is_active:
            thresholds = quality_gate_config.thresholds or {}
            logger.info(f"[QUALITY_GATE] Using project thresholds for project {analysis_run.project_id}: {thresholds}")
        else:
            thresholds = QualityGateModel.get_default_thresholds()
            logger.info(f"[QUALITY_GATE] No custom config found, using default thresholds")

        # Extract threshold values (stored as 0-100 scale in DB)
        threshold_min_score = thresholds.get('min_score', 70) / 100.0
        max_critical_issues = thresholds.get('max_critical_issues', 0)
        
        gate_status = QualityGateStatus.PASSED
        gate_reasons = []
        
        # CRITERIO 1: Check for critical/blocker issues
        critical_count = 0
        for issue in issues:
            severity = issue.get('severity', '').lower()
            if severity in {'critical', 'blocker'} or (severity == 'high' and 'critical' in issue.get('description', '').lower()):
                critical_count += 1
        
        if critical_count > max_critical_issues:
            gate_status = QualityGateStatus.FAILED
            gate_reasons.append(
                f"Critical issues ({critical_count}) exceed maximum allowed ({max_critical_issues})"
            )
            logger.info(f"[QUALITY_GATE] FAILED - {critical_count} critical issues > max {max_critical_issues}")
        
        # CRITERIO 2: Check minimum quality score (only if not already failed)
        if gate_status != QualityGateStatus.FAILED:
            if quality_score < threshold_min_score:
                gate_status = QualityGateStatus.FAILED
                gate_reasons.append(f"Quality score {quality_score:.2%} is below minimum threshold {threshold_min_score:.0%}")
                logger.info(f"[QUALITY_GATE] FAILED - Score {quality_score:.2%} < {threshold_min_score:.0%}")
        
        # Log final decision
        logger.info(f"[QUALITY_GATE] Final status: {gate_status.value} | Score: {quality_score:.2%} | Issues: {len(issues)} | Reasons: {gate_reasons}")
        
        return gate_status
    
    def _compare_issues_with_baseline(self, analysis_run, baseline_run):
        """Compare issues between current run and baseline to determine new vs recurrent issues
        
        This function implements the Diff logic for Sonar-Lite architecture:
        - Compares fingerprints from current run with baseline run
        - Marks issues as is_new=True if fingerprint doesn't exist in baseline
        - Marks issues as is_new=False if fingerprint already existed (recurrent)
        - Calculates new_issues_count and fixed_issues_count
        
        Args:
            analysis_run: Current AnalysisRun being processed
            baseline_run: Previous AnalysisRun to compare against (can be None)
            
        Returns:
            dict: Comparison results with counts
        """
        if not baseline_run:
            # No baseline - all issues are new
            current_issues = analysis_run.issues.all()
            new_count = len(current_issues)
            
            logger.info(f"[DIFF] No baseline for run {analysis_run.id} - all {new_count} issues marked as NEW")
            
            return {
                'new_issues_count': new_count,
                'fixed_issues_count': 0,
                'recurrent_issues_count': 0,
                'baseline_fingerprints': set(),
                'current_fingerprints': {i.fingerprint for i in current_issues if i.fingerprint}
            }
        
        # Get fingerprints from baseline
        baseline_issues = baseline_run.issues.all()
        baseline_fingerprints = {issue.fingerprint for issue in baseline_issues if issue.fingerprint}
        
        # Get current issues
        current_issues = analysis_run.issues.all()
        current_fingerprints = set()
        
        new_count = 0
        recurrent_count = 0
        
        # Compare each current issue with baseline
        for issue in current_issues:
            if not issue.fingerprint:
                # Issues without fingerprint are considered new
                issue.is_new = True
                new_count += 1
                continue
            
            current_fingerprints.add(issue.fingerprint)
            
            if issue.fingerprint in baseline_fingerprints:
                # Fingerprint exists in baseline - recurrent issue
                issue.is_new = False
                recurrent_count += 1
            else:
                # Fingerprint doesn't exist in baseline - new issue
                issue.is_new = True
                new_count += 1
        
        # Calculate fixed issues (fingerprints in baseline but not in current)
        fixed_fingerprints = baseline_fingerprints - current_fingerprints
        fixed_count = len(fixed_fingerprints)
        
        logger.info(
            f"[DIFF] Run {analysis_run.id} vs baseline {baseline_run.id}: "
            f"NEW={new_count}, RECURRENT={recurrent_count}, FIXED={fixed_count}"
        )
        
        return {
            'new_issues_count': new_count,
            'fixed_issues_count': fixed_count,
            'recurrent_issues_count': recurrent_count,
            'baseline_fingerprints': baseline_fingerprints,
            'current_fingerprints': current_fingerprints,
            'fixed_fingerprints': fixed_fingerprints
        }
    
    def _get_baseline_for_analysis(self, analysis_run):
        """Get the baseline AnalysisRun for comparison
        
        Priority:
        1. Explicit baseline_analysis_id if set
        2. Most recent COMPLETED analysis for the same project (excluding current)
        
        Args:
            analysis_run: Current AnalysisRun
            
        Returns:
            AnalysisRun or None: The baseline run to compare against
        """
        # Check if explicit baseline is set
        if analysis_run.baseline_analysis_id:
            baseline = AnalysisRun.query.get(analysis_run.baseline_analysis_id)
            if baseline and baseline.status == AnalysisStatus.COMPLETED:
                logger.info(f"[DIFF] Using explicit baseline {baseline.id} for run {analysis_run.id}")
                return baseline
        
        # Find most recent completed analysis for the same project
        baseline = AnalysisRun.query.filter(
            AnalysisRun.project_id == analysis_run.project_id,
            AnalysisRun.id != analysis_run.id,
            AnalysisRun.status == AnalysisStatus.COMPLETED
        ).order_by(AnalysisRun.completed_at.desc()).first()
        
        if baseline:
            logger.info(f"[DIFF] Found automatic baseline {baseline.id} for run {analysis_run.id}")
            # Store the baseline reference
            analysis_run.baseline_analysis_id = baseline.id
        else:
            logger.info(f"[DIFF] No baseline found for run {analysis_run.id} (first analysis for project)")
        
        return baseline
    
    def run_evaluation(self, evaluation_id, analysis_run_id=None):
        """Run evaluation for the given evaluation ID
        
        This method maintains backward compatibility with the legacy Evaluation model
        while also supporting the new AnalysisRun model (Sonar-Lite architecture).
        
        Args:
            evaluation_id: ID of the evaluation to run (legacy)
            analysis_run_id: ID of the AnalysisRun (Sonar-Lite, optional)
            
        Returns:
            dict: Result of the evaluation
        """
        analysis_run = None
        
        try:
            # Get evaluation (legacy)
            evaluation = Evaluation.query.get(evaluation_id)
            if not evaluation:
                return {
                    'success': False,
                    'error': f"Evaluation {evaluation_id} not found"
                }
            
            # Get or create AnalysisRun (Sonar-Lite)
            if analysis_run_id:
                analysis_run = AnalysisRun.query.get(analysis_run_id)
                if analysis_run:
                    # Update to PROCESSING status
                    analysis_run.status = AnalysisStatus.RUNNING
                    analysis_run.started_at = datetime.utcnow()
                    db.session.commit()
                    logger.info(f"[SONAR-LITE] AnalysisRun {analysis_run_id} updated to PROCESSING")
            
            # Get metrics mapping for ID lookup
            metrics_map = {}
            all_metrics = Metric.query.all()
            for metric in all_metrics:
                metrics_map[metric.name] = metric.id
            
            # Update evaluation status using direct SQL to ensure it persists
            self._update_progress(evaluation_id, 5, "Iniciando evaluación...", analysis_run_id)
            
            # Get dataset
            dataset = Dataset.query.get(evaluation.dataset_id)
            if not dataset:
                raise Exception("Dataset no encontrado")
            
            self._update_progress(evaluation_id, 10, "Descargando dataset...", analysis_run_id)
            
            # Download dataset from MinIO
            file_data = self.minio_service.download_file(dataset.file_path)
            
            self._update_progress(evaluation_id, 20, "Leyendo datos del dataset...", analysis_run_id)
            
            # Read dataset with pandas
            df = pd.read_csv(io.BytesIO(file_data))
            
            self._update_progress(evaluation_id, 25, "Preparando análisis de métricas...", analysis_run_id)
            
            # Run metrics based on configuration
            results = {}
            issues = []
            
            # Get metrics configuration
            metrics_config = evaluation.metrics_config.get('metrics', [])
            total_metrics = len(metrics_config) if metrics_config else 1
            
            # Track processed metrics for quality score calculation
            processed_metrics = []
            metric_scores = []
            metric_weights = []

            # Process each configured metric
            for metric_index, metric_config in enumerate(metrics_config):
                # Calculate progress: 25% to 70% for metrics processing
                metric_progress = 25 + int(((metric_index + 1) / total_metrics) * 45)
                metric_id = metric_config.get('id')
                parameters = metric_config.get('parameters', {})
                # Weight lives inside parameters (from template config); fall back to
                # top-level 'weight' field (MetricSchema default = 1.0) only if absent.
                weight = parameters.get('weight', metric_config.get('weight', 1.0))

                # Update progress for current metric
                self._update_progress(evaluation_id, metric_progress, f"Analizando métrica: {metric_id}...", analysis_run_id)

                try:
                    metric_instance = get_metric(metric_id)
                    metric_result = metric_instance.evaluate(
                        df, parameters, dataset, evaluation.id, metrics_map
                    )
                    if metric_result.score is not None:
                        processed_metrics.append(metric_id)
                        metric_scores.append(metric_result.score)
                        metric_weights.append(weight)
                    results.update(metric_result.results)
                    issues.extend(metric_result.issues)
                except KeyError:
                    logger.warning(f"[EVAL] Unknown metric '{metric_id}', skipping")
                except Exception as metric_error:
                    logger.error(
                        f"[EVAL] Error evaluating '{metric_id}': {metric_error}",
                        exc_info=True,
                    )

            self._update_progress(evaluation_id, 75, "Analizando métricas por columna...", analysis_run_id)

            # Calculate column-level metrics for all columns
            column_metrics = {}
            total_columns = len(df.columns)
            for col_index, column in enumerate(df.columns):
                # Update progress: 75% to 90% for column analysis
                if col_index % max(1, total_columns // 5) == 0:  # Update every 20% of columns
                    col_progress = 75 + int((col_index / total_columns) * 15)
                    self._update_progress(evaluation_id, col_progress, f"Analizando columna: {column}...", analysis_run_id)
                n_nulls = int(df[column].isna().sum())
                n_non_nulls = int(len(df) - n_nulls)
                n_unique = int(df[column].nunique())
                completeness = 1 - df[column].isna().mean()
                uniqueness = n_unique / len(df) if len(df) > 0 else 1
                
                column_metrics[column] = {
                    'completeness': completeness,
                    'uniqueness': uniqueness,
                    'n_nulls': n_nulls,
                    'n_non_nulls': n_non_nulls,
                    'n_unique': n_unique,
                    'type': str(df[column].dtype)
                }
                
                # Add statistics based on data type
                if pd.api.types.is_numeric_dtype(df[column]):
                    column_metrics[column].update({
                        'min': float(df[column].min()) if not pd.isna(df[column].min()) else None,
                        'max': float(df[column].max()) if not pd.isna(df[column].max()) else None,
                        'mean': float(df[column].mean()) if not pd.isna(df[column].mean()) else None,
                        'median': float(df[column].median()) if not pd.isna(df[column].median()) else None,
                        'std': float(df[column].std()) if not pd.isna(df[column].std()) else None,
                        'histogram': self._generate_histogram(df[column])
                    })
            
            self._update_progress(evaluation_id, 92, "Calculando puntuación de calidad...", analysis_run_id)

            # ── Quality Score: weighted arithmetic mean of raw metric scores ───
            # Each metric returns its raw score in [0, 1] (no weight applied
            # internally). Metrics that opted out (score=None, e.g. logical
            # consistency without rules, class_balance without explicit columns)
            # are excluded from both numerator and denominator.
            #
            # Issues do NOT penalize the quality_score directly: critical
            # problems are enforced by the Quality Gate (max_critical_issues),
            # avoiding double counting against the metric score that already
            # reflects the problem.
            if metric_scores:
                total_weight = sum(metric_weights)
                if total_weight > 0:
                    base_score = sum(s * w for s, w in zip(metric_scores, metric_weights)) / total_weight
                else:
                    base_score = sum(metric_scores) / len(metric_scores)
            else:
                base_score = 0.0

            quality_score = max(0.0, min(1.0, base_score))

            # Issue counts kept for transparency and for the Quality Gate.
            critical_count = sum(1 for i in issues if i.get('severity') == 'critical')
            high_count     = sum(1 for i in issues if i.get('severity') == 'high')
            medium_count   = sum(1 for i in issues if i.get('severity') == 'medium')
            low_count      = sum(1 for i in issues if i.get('severity') == 'low')

            logger.info(
                f"[SCORE] weighted_mean={base_score:.4f} "
                f"(metrics_in_score={len(metric_scores)}, "
                f"crit={critical_count}, high={high_count}, med={medium_count}, low={low_count}), "
                f"final={quality_score:.4f}"
            )

            self._update_progress(evaluation_id, 95, "Guardando resultados...", analysis_run_id)

            # Per-metric raw score breakdown for transparency in the UI.
            score_breakdown = {
                metric_name: round(metric_scores[i], 4)
                for i, metric_name in enumerate(processed_metrics)
                if i < len(metric_scores)
            }

            # Prepare results dict
            results_dict = {
                'overall': {
                    'quality_score': quality_score,
                    'metrics_processed': processed_metrics,
                    'score_breakdown': {
                        'metric_scores': score_breakdown,
                        'metric_weights': {
                            processed_metrics[i]: metric_weights[i]
                            for i in range(len(processed_metrics))
                            if i < len(metric_weights)
                        },
                        'base_score': round(base_score, 4),
                        'final_score': round(quality_score, 4),
                        'formula': 'weighted_mean',
                        'issue_counts': {
                            'critical': critical_count,
                            'high': high_count,
                            'medium': medium_count,
                            'low': low_count,
                        },
                    },
                    **results  # Include all metric results
                },
                'column_metrics': column_metrics
            }
            
            # Update legacy Evaluation with results
            evaluation.results = results_dict
            evaluation.quality_score = float(quality_score) * 100  # Convert to 0-100 scale
            evaluation.status = 'completed'
            evaluation.completed_at = datetime.utcnow()
            
            # Save evaluation results to database
            db.session.commit()
            
            # Check for data type consistency issues
            if 'consistency' in processed_metrics or len(processed_metrics) > 0:
                # Check for inconsistent data types that might indicate problems
                numeric_columns = df.select_dtypes(include=['number']).columns.tolist()
                for col in numeric_columns:
                    # Check if there are potential string values stored as numbers
                    if col in df.columns and len(df) > 0:
                        # Check for suspicious integer values in columns that should be categorical
                        if df[col].dtype == 'int64' and df[col].nunique() < 10 and len(df) > 20:
                            issues.append({
                                'evaluation_id': evaluation.id,
                                'metric_id': metrics_map.get('consistency'),
                                'severity': 'low',
                                'description': f"Column '{col}' might be categorical but stored as numeric",
                                'affected_columns': [{'column': col}],
                                'issue_type': 'consistency',
                                'fingerprint': generate_issue_fingerprint(
                                    issue_type='consistency',
                                    column_name=col,
                                    rule_key='categorical_as_numeric'
                                )
                            })
            
            # Create issues in database (legacy Issue table)
            for issue_data in issues:
                issue = Issue(
                    evaluation_id=issue_data['evaluation_id'],
                    metric_id=issue_data.get('metric_id'),
                    severity=issue_data['severity'],
                    description=issue_data['description'],
                    affected_columns=issue_data.get('affected_columns'),
                    affected_rows=issue_data.get('affected_rows'),
                    issue_type=issue_data.get('issue_type'),
                    fingerprint=issue_data.get('fingerprint')
                )
                db.session.add(issue)
            
            # Count critical issues for AnalysisRun (high = major, critical/blocker = critical)
            critical_issues_count = sum(1 for i in issues if i.get('severity') in ['critical', 'blocker'])
            major_issues_count = sum(1 for i in issues if i.get('severity') == 'high')
            
            # Update AnalysisRun with results (Sonar-Lite)
            if analysis_run:
                analysis_run.status = AnalysisStatus.COMPLETED
                analysis_run.quality_score = float(quality_score) * 100  # Convert to 0-100 scale
                analysis_run.total_issues_count = len(issues)
                analysis_run.critical_issues_count = critical_issues_count
                # Note: results will be assigned after diff comparison to include diff info
                analysis_run.completed_at = datetime.utcnow()
                analysis_run.progress = 100
                analysis_run.current_step = "Análisis completado"
                
                # Evaluate Quality Gate using MVP criteria
                analysis_run.quality_gate_status = self._evaluate_quality_gate(
                    analysis_run=analysis_run,
                    quality_score=quality_score,
                    issues=issues,
                    results=results_dict
                )
                
                # Create DataQualityIssues for AnalysisRun (new table)
                for issue_data in issues:
                    # Use pre-computed fingerprint if available, otherwise generate one
                    fingerprint = issue_data.get('fingerprint')
                    issue_type = issue_data.get('issue_type', 'general')
                    desc = issue_data.get('description', '')
                    
                    if not fingerprint:
                        # Fallback: generate fingerprint for legacy issues without one
                        column_name = ''
                        if issue_data.get('affected_columns'):
                            cols = issue_data['affected_columns']
                            if isinstance(cols, list) and len(cols) > 0:
                                column_name = cols[0].get('column', '') if isinstance(cols[0], dict) else str(cols[0])
                        
                        # Infer issue_type from description if not set
                        if issue_type == 'general':
                            if 'completeness' in desc.lower():
                                issue_type = 'completeness'
                            elif 'uniqueness' in desc.lower() or 'duplicate' in desc.lower():
                                issue_type = 'uniqueness'
                            elif 'consistency' in desc.lower() or 'pattern' in desc.lower():
                                issue_type = 'consistency'
                            elif 'outlier' in desc.lower():
                                issue_type = 'outliers'
                        
                        fingerprint = generate_issue_fingerprint(
                            issue_type=issue_type,
                            column_name=column_name,
                            rule_key=f"{issue_type}_check"
                        )
                    
                    # Map severity (legacy uses high/medium/low, new uses critical/major/minor/info)
                    severity_map = {'high': 'major', 'medium': 'minor', 'low': 'info', 'critical': 'critical'}
                    mapped_severity = severity_map.get(issue_data['severity'], 'minor')
                    
                    dq_issue = DataQualityIssue(
                        analysis_run_id=analysis_run.id,
                        metric_id=issue_data.get('metric_id'),
                        fingerprint=fingerprint,
                        issue_type=issue_type,
                        severity=mapped_severity,
                        description=desc,
                        affected_columns=issue_data.get('affected_columns'),
                        affected_rows=issue_data.get('affected_rows'),
                        rule_key=f"{issue_type}_check",
                        is_new=True  # Will be updated by comparison below
                    )
                    db.session.add(dq_issue)
                
                # Flush to ensure issues are in DB before comparison
                db.session.flush()
                
                # Compare with baseline to determine new vs recurrent issues
                baseline_run = self._get_baseline_for_analysis(analysis_run)
                diff_result = self._compare_issues_with_baseline(analysis_run, baseline_run)
                
                # Update AnalysisRun with diff counts
                analysis_run.new_issues_count = diff_result['new_issues_count']
                analysis_run.fixed_issues_count = diff_result['fixed_issues_count']
                
                # Enrich results with diff information for persistence and auditing
                results_dict['diff'] = {
                    'baseline_analysis_id': analysis_run.baseline_analysis_id,
                    'baseline_completed_at': baseline_run.completed_at.isoformat() if baseline_run and baseline_run.completed_at else None,
                    'comparison_timestamp': datetime.utcnow().isoformat(),
                    'new_issues_count': diff_result['new_issues_count'],
                    'fixed_issues_count': diff_result['fixed_issues_count'],
                    'recurrent_issues_count': diff_result.get('recurrent_issues_count', 0),
                    'has_baseline': baseline_run is not None
                }
                
                # Update results in AnalysisRun with enriched data
                analysis_run.results = results_dict
                
                logger.info(
                    f"[SONAR-LITE] AnalysisRun {analysis_run.id} completed: "
                    f"score={quality_score:.2f}, total_issues={len(issues)}, "
                    f"new={diff_result['new_issues_count']}, fixed={diff_result['fixed_issues_count']}"
                )
            
            db.session.commit()
            
            return {
                'success': True,
                'evaluation_id': evaluation.id,
                'analysis_run_id': analysis_run.id if analysis_run else None,
                'quality_score': float(quality_score),
                'issues_count': len(issues),
                'new_issues_count': analysis_run.new_issues_count if analysis_run else len(issues),
                'fixed_issues_count': analysis_run.fixed_issues_count if analysis_run else 0
            }
        
        except Exception as e:
            logger.error(f"[EVALUATION] Error in evaluation {evaluation_id}: {str(e)}", exc_info=True)
            
            # Update legacy Evaluation status to failed
            try:
                evaluation = Evaluation.query.get(evaluation_id)
                if evaluation:
                    evaluation.status = 'failed'
                    evaluation.error = str(e)
                    evaluation.completed_at = datetime.utcnow()
            except Exception:
                pass
            
            # Update AnalysisRun status to FAILED (Sonar-Lite)
            if analysis_run_id:
                try:
                    analysis_run = AnalysisRun.query.get(analysis_run_id)
                    if analysis_run:
                        analysis_run.status = AnalysisStatus.FAILED
                        analysis_run.error_message = str(e)
                        analysis_run.completed_at = datetime.utcnow()
                        logger.info(f"[SONAR-LITE] AnalysisRun {analysis_run_id} marked as FAILED")
                except Exception as ar_error:
                    logger.error(f"[SONAR-LITE] Failed to update AnalysisRun {analysis_run_id}: {ar_error}")
            
            db.session.commit()
            
            return {
                'success': False,
                'error': str(e)
            }
    
    def _calculate_dynamic_severity(self, actual_value, threshold, metric_type='completeness', higher_is_better=True):
        """Calculate dynamic severity based on distance from threshold
        
        Args:
            actual_value: The actual metric value (0.0 to 1.0 for percentages)
            threshold: The threshold value to compare against
            metric_type: Type of metric ('completeness', 'uniqueness', 'outliers')
            higher_is_better: True if higher values are better (completeness, uniqueness), False for outliers
            
        Returns:
            str: Severity level ('critical', 'high', 'medium', 'low')
        """
        if metric_type == 'outliers':
            # For outliers, actual_value is the proportion of outliers (0.0 to 1.0)
            # Higher proportion = worse
            if actual_value >= 0.20:  # >= 20% outliers
                return 'critical'
            elif actual_value >= 0.10:  # 10-20% outliers
                return 'high'
            elif actual_value >= 0.05:  # 5-10% outliers
                return 'medium'
            else:  # < 5% outliers
                return 'low'
        
        # For completeness and uniqueness (higher is better)
        if higher_is_better:
            distance = threshold - actual_value  # How far below threshold
            
            if distance <= 0:
                # Above threshold - no issue (shouldn't create issue in this case)
                return 'low'
            
            # Calculate severity based on distance from threshold
            if actual_value < 0.50:  # < 50% - critical (more than half missing/duplicate)
                return 'critical'
            elif actual_value < 0.70:  # 50-70% - high (significant problem)
                return 'high'
            elif actual_value < threshold:  # 70% to threshold - medium/low based on distance
                # Fine-grained: closer to threshold = lower severity
                if distance > 0.15:  # More than 15% below threshold
                    return 'high'
                elif distance > 0.05:  # 5-15% below threshold
                    return 'medium'
                else:  # < 5% below threshold
                    return 'low'
            else:
                return 'low'
        
        return 'medium'  # Default fallback
    
    def _generate_histogram(self, series, bins=10):
        """Generate histogram data for a numeric series
        
        Args:
            series: Pandas series to analyze
            bins: Number of bins for histogram
            
        Returns:
            dict: Histogram data
        """
        # Remove NaN values
        series = series.dropna()
        
        if len(series) == 0:
            return {'bins': [], 'counts': []}
        
        # Calculate histogram
        counts, bin_edges = np.histogram(series, bins=bins)
        
        # Convert to list for JSON serialization
        return {
            'bins': [float(x) for x in bin_edges[:-1]],
            'counts': [int(x) for x in counts]
        }
    
