from datetime import datetime
import pandas as pd
import numpy as np
import io
import logging
import hashlib

from extensions import db
from models.evaluation import Evaluation, Issue
from models.analysis import AnalysisRun, AnalysisStatus, QualityGateStatus, DataQualityIssue
from models.dataset import Dataset
from models.metric import Metric
from services.dataset_service import DatasetService
from services.minio_service import MinioService
from utils.fingerprint_utils import (
    generate_issue_fingerprint,
    generate_column_issue_fingerprint,
    generate_pattern_issue_fingerprint,
    generate_duplicate_issue_fingerprint,
    generate_outlier_issue_fingerprint
)

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
        """Evaluate Quality Gate status based on MVP criteria
        
        This function determines if an analysis passes, fails, or gets a warning
        based on hardcoded thresholds. Prepared for future config-based thresholds.
        
        Args:
            analysis_run: The AnalysisRun being evaluated
            quality_score: Overall quality score (0.0 - 1.0 scale)
            issues: List of issue dictionaries from the evaluation
            results: Results dictionary containing metric values
            
        Returns:
            QualityGateStatus: PASSED, FAILED, or WARNING
            
        MVP Criteria (hardcoded, ready for config):
            - CRITERIO 1 (Criticality): If any issue has severity='CRITICAL' or 'BLOCKER' -> FAILED
            - CRITERIO 2 (Score min): If quality_score < 80% (0.8) -> FAILED
            - CRITERIO 3 (Completeness): If any completeness metric < 90% (0.9) -> WARNING
            - Otherwise -> PASSED
        """
        # TODO: In the future, read thresholds from QualityGate config for the project
        # For now, use hardcoded MVP thresholds
        THRESHOLD_MIN_SCORE = 0.80  # 80%
        THRESHOLD_MIN_COMPLETENESS = 0.90  # 90%
        CRITICAL_SEVERITIES = {'critical', 'blocker', 'CRITICAL', 'BLOCKER'}
        
        gate_status = QualityGateStatus.PASSED
        gate_reasons = []
        
        # CRITERIO 1: Check for critical/blocker issues
        for issue in issues:
            severity = issue.get('severity', '').lower()
            # Map legacy 'high' to 'critical' for this check
            if severity in {'critical', 'blocker'} or (severity == 'high' and 'critical' in issue.get('description', '').lower()):
                gate_status = QualityGateStatus.FAILED
                gate_reasons.append(f"Critical issue found: {issue.get('description', 'Unknown')[:100]}")
                logger.info(f"[QUALITY_GATE] FAILED - Critical issue detected: {issue.get('description', '')[:50]}")
                break  # One critical is enough to fail
        
        # CRITERIO 2: Check minimum quality score (only if not already failed)
        if gate_status != QualityGateStatus.FAILED:
            if quality_score < THRESHOLD_MIN_SCORE:
                gate_status = QualityGateStatus.FAILED
                gate_reasons.append(f"Quality score {quality_score:.2%} is below minimum threshold {THRESHOLD_MIN_SCORE:.0%}")
                logger.info(f"[QUALITY_GATE] FAILED - Score {quality_score:.2%} < {THRESHOLD_MIN_SCORE:.0%}")
        
        # CRITERIO 3: Check completeness metrics (only if not already failed)
        if gate_status != QualityGateStatus.FAILED:
            # Check overall completeness from results
            overall_completeness = results.get('overall', {}).get('completeness')
            if overall_completeness is not None and overall_completeness < THRESHOLD_MIN_COMPLETENESS:
                gate_status = QualityGateStatus.WARNING
                gate_reasons.append(f"Completeness {overall_completeness:.2%} is below recommended threshold {THRESHOLD_MIN_COMPLETENESS:.0%}")
                logger.info(f"[QUALITY_GATE] WARNING - Completeness {overall_completeness:.2%} < {THRESHOLD_MIN_COMPLETENESS:.0%}")
            
            # Also check column-level completeness
            column_metrics = results.get('column_metrics', {})
            low_completeness_columns = []
            for col_name, col_data in column_metrics.items():
                col_completeness = col_data.get('completeness', 1.0)
                if col_completeness < THRESHOLD_MIN_COMPLETENESS:
                    low_completeness_columns.append(f"{col_name}: {col_completeness:.2%}")
            
            if low_completeness_columns and gate_status == QualityGateStatus.PASSED:
                gate_status = QualityGateStatus.WARNING
                gate_reasons.append(f"Low completeness in columns: {', '.join(low_completeness_columns[:3])}")
                logger.info(f"[QUALITY_GATE] WARNING - Low completeness in {len(low_completeness_columns)} columns")
        
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
                raise Exception("Dataset not found")
            
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
            
            # Process each configured metric
            for metric_index, metric_config in enumerate(metrics_config):
                # Calculate progress: 25% to 70% for metrics processing
                metric_progress = 25 + int(((metric_index + 1) / total_metrics) * 45)
                metric_id = metric_config.get('id')
                parameters = metric_config.get('parameters', {})
                weight = metric_config.get('weight', 1.0)
                
                # Update progress for current metric
                self._update_progress(evaluation_id, metric_progress, f"Analizando métrica: {metric_id}...", analysis_run_id)
                
                if metric_id == 'completeness':
                    # Calculate completeness (percentage of non-null values)
                    if 'columns' in parameters and parameters['columns']:
                        # Calculate for specific columns
                        columns = parameters['columns']
                        completeness_values = [1 - df[col].isna().mean() for col in columns if col in df.columns]
                        if completeness_values:
                            completeness = sum(completeness_values) / len(completeness_values)
                        else:
                            completeness = 1.0  # Default if no valid columns specified
                    else:
                        # Calculate for all columns
                        completeness = 1 - df.isna().mean().mean()
                    
                    results['completeness'] = completeness
                    processed_metrics.append('completeness')
                    metric_scores.append(completeness * weight)
                    
                    # Check completeness threshold
                    completeness_threshold = parameters.get('threshold', 0.95)
                    
                    if completeness < completeness_threshold:
                        # Find columns with high null rates
                        problem_columns = []
                        for column in df.columns:
                            null_rate = df[column].isna().mean()
                            if null_rate > (1 - completeness_threshold):
                                problem_columns.append({
                                    'column': column,
                                    'null_rate': float(null_rate)
                                })
                        
                        # Create issue with fingerprint
                        issues.append({
                            'evaluation_id': evaluation.id,
                            'metric_id': metrics_map.get(metric_id),
                            'severity': 'high' if completeness < 0.8 else 'medium',
                            'description': f"Dataset completeness ({completeness:.2%}) is below threshold ({completeness_threshold:.2%})",
                            'affected_columns': problem_columns,
                            'issue_type': 'completeness',
                            'fingerprint': generate_column_issue_fingerprint(
                                issue_type='completeness',
                                column_name='_dataset_',  # Dataset-level issue
                                threshold=completeness_threshold
                            )
                        })
                
                elif metric_id == 'uniqueness':
                    # Calculate uniqueness
                    if 'columns' in parameters and parameters['columns']:
                        # Calculate for specific columns
                        columns = parameters['columns']
                        uniqueness_values = []
                        for col in columns:
                            if col in df.columns:
                                col_uniqueness = df[col].nunique() / len(df) if len(df) > 0 else 1.0
                                uniqueness_values.append(col_uniqueness)
                        
                        if uniqueness_values:
                            uniqueness = sum(uniqueness_values) / len(uniqueness_values)
                        else:
                            uniqueness = 1.0  # Default if no valid columns specified
                    else:
                        # Calculate for entire dataset (row-wise) and also check column-level uniqueness
                        uniqueness = len(df.drop_duplicates()) / len(df) if len(df) > 0 else 1.0
                        
                        # Check column-level uniqueness for potential issues
                        column_uniqueness_issues = []
                        for col in df.columns:
                            col_uniqueness = df[col].nunique() / len(df) if len(df) > 0 else 1.0
                            if col_uniqueness < 0.3 and len(df) > 10:  # Only flag low uniqueness for non-trivial datasets
                                column_uniqueness_issues.append({
                                    'column': col,
                                    'uniqueness': float(col_uniqueness),
                                    'duplicate_count': int(len(df) - df[col].nunique())
                                })
                    
                    results['uniqueness'] = uniqueness
                    processed_metrics.append('uniqueness')
                    metric_scores.append(uniqueness * weight)
                    
                    # Check uniqueness threshold
                    uniqueness_threshold = parameters.get('threshold', 1.0)
                    
                    # Always check for column-level uniqueness issues
                    if column_uniqueness_issues:
                        # Create fingerprint for each affected column
                        for col_issue in column_uniqueness_issues:
                            issues.append({
                                'evaluation_id': evaluation.id,
                                'metric_id': metrics_map.get(metric_id),
                                'severity': 'medium',
                                'description': f"Low uniqueness in column '{col_issue['column']}' ({col_issue['uniqueness']:.2%})",
                                'affected_columns': [col_issue],
                                'issue_type': 'uniqueness',
                                'fingerprint': generate_duplicate_issue_fingerprint(
                                    column_name=col_issue['column'],
                                    is_row_level=False
                                )
                            })
                    
                    if uniqueness < uniqueness_threshold:
                        # Find duplicate rows or values
                        if 'columns' in parameters and parameters['columns']:
                            # Column-specific duplicates
                            duplicate_info = {}
                            for col in parameters['columns']:
                                if col in df.columns:
                                    duplicate_count = len(df) - df[col].nunique()
                                    if duplicate_count > 0:
                                        duplicate_info[col] = duplicate_count
                            
                            if duplicate_info:
                                for col, count in duplicate_info.items():
                                    issues.append({
                                        'evaluation_id': evaluation.id,
                                        'metric_id': metrics_map.get(metric_id),
                                        'severity': 'high' if uniqueness < 0.9 else 'medium',
                                        'description': f"Column '{col}' contains {count} duplicate values",
                                        'affected_columns': [{'column': col, 'duplicate_count': count}],
                                        'issue_type': 'uniqueness',
                                        'fingerprint': generate_duplicate_issue_fingerprint(
                                            column_name=col,
                                            is_row_level=False
                                        )
                                    })
                        else:
                            # Row-wise duplicates
                            duplicates = df[df.duplicated(keep='first')]
                            duplicate_count = len(duplicates)
                            
                            if duplicate_count > 0:
                                issues.append({
                                    'evaluation_id': evaluation.id,
                                    'metric_id': metrics_map.get(metric_id),
                                    'severity': 'high' if uniqueness < 0.9 else 'medium',
                                    'description': f"Dataset contains {duplicate_count} duplicate rows ({(1-uniqueness):.2%} of total)",
                                    'affected_rows': {
                                        'count': duplicate_count,
                                        'sample': duplicates.head(5).to_dict(orient='records') if duplicate_count > 0 else []
                                    },
                                    'issue_type': 'uniqueness',
                                    'fingerprint': generate_duplicate_issue_fingerprint(
                                        is_row_level=True
                                    )
                                })
                
                elif metric_id == 'consistency' or metric_id == 'consistency_pattern':
                    # Check pattern consistency
                    column = parameters.get('column')
                    pattern = parameters.get('pattern')
                    
                    if column and pattern and column in df.columns:
                        import re
                        try:
                            regex = re.compile(pattern)
                            # Convert to string and check pattern
                            valid_count = 0
                            invalid_count = 0
                            invalid_examples = []
                            
                            for value in df[column].dropna():
                                str_value = str(value)
                                if regex.match(str_value):
                                    valid_count += 1
                                else:
                                    invalid_count += 1
                                    if len(invalid_examples) < 5:
                                        invalid_examples.append(str_value)
                            
                            total_count = valid_count + invalid_count
                            consistency_score = valid_count / total_count if total_count > 0 else 1.0
                            
                            results[f'consistency_pattern_{column}'] = consistency_score
                            processed_metrics.append('consistency')
                            metric_scores.append(consistency_score * weight)
                            
                            # Check threshold
                            consistency_threshold = parameters.get('threshold', 0.95)
                            if consistency_score < consistency_threshold:
                                issues.append({
                                    'evaluation_id': evaluation.id,
                                    'metric_id': metrics_map.get(metric_id),
                                    'severity': 'high' if consistency_score < 0.8 else 'medium',
                                    'description': f"Column '{column}' has {invalid_count} values that don't match pattern '{pattern}'",
                                    'affected_columns': [{'column': column, 'invalid_count': invalid_count}],
                                    'details': {
                                        'valid_count': valid_count,
                                        'invalid_count': invalid_count,
                                        'examples': invalid_examples
                                    },
                                    'issue_type': 'consistency',
                                    'fingerprint': generate_pattern_issue_fingerprint(
                                        column_name=column,
                                        pattern=pattern
                                    )
                                })
                        except re.error:
                            issues.append({
                                'evaluation_id': evaluation.id,
                                'metric_id': metrics_map.get(metric_id),
                                'severity': 'high',
                                'description': f"Invalid regex pattern '{pattern}' for column '{column}'",
                                'issue_type': 'consistency',
                                'fingerprint': generate_issue_fingerprint(
                                    issue_type='consistency_error',
                                    column_name=column,
                                    rule_key='invalid_pattern',
                                    extra_params={'pattern': pattern}
                                )
                            })
                
                elif metric_id == 'outliers':
                    # Check for outliers in numeric columns
                    columns = parameters.get('columns', [])
                    method = parameters.get('method', 'iqr')
                    factor = parameters.get('factor', 1.5)
                    
                    # If no columns specified, check all numeric columns
                    if not columns:
                        columns = [col for col in df.columns if pd.api.types.is_numeric_dtype(df[col])]
                    
                    outlier_results = {}
                    for column in columns:
                        if column in df.columns and pd.api.types.is_numeric_dtype(df[column]):
                            outliers = self._detect_outliers(df[column], method, factor)
                            outlier_results[column] = outliers
                            
                            if outliers['count'] > 0:
                                issues.append({
                                    'evaluation_id': evaluation.id,
                                    'metric_id': metrics_map.get(metric_id),
                                    'severity': 'medium',
                                    'description': f"Column '{column}' contains {outliers['count']} outliers",
                                    'affected_columns': [{'column': column, 'outlier_count': outliers['count']}],
                                    'issue_type': 'outliers',
                                    'fingerprint': generate_outlier_issue_fingerprint(
                                        column_name=column,
                                        method=method,
                                        factor=factor
                                    )
                                })
                    
                    results['outliers'] = outlier_results
                    
                    # Calculate outlier score (1 - proportion of outliers)
                    if outlier_results:
                        total_values = sum(len(df[col].dropna()) for col in outlier_results.keys())
                        total_outliers = sum(outlier_results[col]['count'] for col in outlier_results.keys())
                        outlier_score = 1 - (total_outliers / total_values if total_values > 0 else 0)
                        processed_metrics.append('outliers')
                        metric_scores.append(outlier_score * weight)
            
            self._update_progress(evaluation_id, 75, "Analizando métricas por columna...", analysis_run_id)
            
            # Calculate column-level metrics for all columns
            column_metrics = {}
            total_columns = len(df.columns)
            for col_index, column in enumerate(df.columns):
                # Update progress: 75% to 90% for column analysis
                if col_index % max(1, total_columns // 5) == 0:  # Update every 20% of columns
                    col_progress = 75 + int((col_index / total_columns) * 15)
                    self._update_progress(evaluation_id, col_progress, f"Analizando columna: {column}...", analysis_run_id)
                completeness = 1 - df[column].isna().mean()
                uniqueness = df[column].nunique() / len(df) if len(df) > 0 else 1
                
                column_metrics[column] = {
                    'completeness': completeness,
                    'uniqueness': uniqueness,
                    'type': str(df[column].dtype)
                }
                
                # Generate issues for individual columns with low completeness
                if completeness < 0.98 and 'completeness' in processed_metrics:
                    issues.append({
                        'evaluation_id': evaluation.id,
                        'metric_id': metrics_map.get('completeness'),
                        'severity': 'high' if completeness < 0.9 else 'medium',
                        'description': f"Column '{column}' has low completeness ({completeness:.2%})",
                        'affected_columns': [{'column': column, 'null_rate': float(1 - completeness)}],
                        'issue_type': 'completeness',
                        'fingerprint': generate_column_issue_fingerprint(
                            issue_type='completeness',
                            column_name=column
                        )
                    })
                
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
            
            # Calculate overall quality score
            quality_score = sum(metric_scores) / len(metric_scores) if metric_scores else 0.0
            
            self._update_progress(evaluation_id, 95, "Guardando resultados...", analysis_run_id)
            
            # Prepare results dict
            results_dict = {
                'overall': {
                    'quality_score': quality_score,
                    'metrics_processed': processed_metrics,
                    **results  # Include all metric results
                },
                'column_metrics': column_metrics
            }
            
            # Update legacy Evaluation with results
            evaluation.results = results_dict
            evaluation.quality_score = quality_score
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
                    affected_rows=issue_data.get('affected_rows')
                )
                db.session.add(issue)
            
            # Count critical issues for AnalysisRun
            critical_issues_count = sum(1 for i in issues if i.get('severity') in ['high', 'critical'])
            
            # Update AnalysisRun with results (Sonar-Lite)
            if analysis_run:
                analysis_run.status = AnalysisStatus.COMPLETED
                analysis_run.quality_score = float(quality_score) * 100  # Convert to 0-100 scale
                analysis_run.total_issues_count = len(issues)
                analysis_run.critical_issues_count = critical_issues_count
                analysis_run.results = results_dict
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
    
    def _detect_outliers(self, series, method='iqr', factor=1.5):
        """Detect outliers in a numeric series
        
        Args:
            series: Pandas series to analyze
            method: Method to use for outlier detection ('iqr' or 'zscore')
            factor: Factor for IQR method or threshold for Z-score method
            
        Returns:
            dict: Outlier information
        """
        # Remove NaN values
        series = series.dropna()
        
        if len(series) == 0:
            return {'count': 0, 'indices': []}
        
        if method == 'iqr':
            # IQR method
            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)
            iqr = q3 - q1
            lower_bound = q1 - factor * iqr
            upper_bound = q3 + factor * iqr
            
            # Find outliers
            outliers = series[(series < lower_bound) | (series > upper_bound)]
        
        elif method == 'zscore':
            # Z-score method
            mean = series.mean()
            std = series.std()
            z_scores = (series - mean) / std
            
            # Find outliers
            outliers = series[abs(z_scores) > factor]
        
        else:
            raise ValueError(f"Unknown outlier detection method: {method}")
        
        return {
            'count': len(outliers),
            'indices': list(outliers.index)
        }
