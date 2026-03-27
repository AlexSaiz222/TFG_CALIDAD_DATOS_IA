from datetime import datetime
import pandas as pd
import numpy as np
import io
import json
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
    generate_outlier_issue_fingerprint,
    generate_syntactic_accuracy_fingerprint,
    generate_logical_consistency_fingerprint,
    generate_class_balance_fingerprint,
    generate_timeliness_fingerprint,
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
                        
                        # Calculate dynamic severity based on distance from threshold
                        severity = self._calculate_dynamic_severity(
                            actual_value=completeness,
                            threshold=completeness_threshold,
                            metric_type='completeness',
                            higher_is_better=True
                        )
                        
                        # Create issue with fingerprint
                        issues.append({
                            'evaluation_id': evaluation.id,
                            'metric_id': metrics_map.get(metric_id),
                            'severity': severity,
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
                    # REFACTORED: Separate row-level uniqueness from column-level variability
                    # Based on professor feedback to avoid mixing two distinct concepts
                    
                    # Initialize column variability issues list (FIX: bug if columns parameter is used)
                    column_variability_issues = []
                    
                    # 1. ROW-LEVEL UNIQUENESS (duplicate rows detection)
                    row_uniqueness = len(df.drop_duplicates()) / len(df) if len(df) > 0 else 1.0
                    
                    # 2. COLUMN-LEVEL VARIABILITY (diversity/cardinality check)
                    # Check all columns for low variability with adaptive thresholds
                    for col in df.columns:
                        # FIX: Exclude nulls from denominator to avoid mixing completeness issues
                        non_null_count = df[col].notna().sum()
                        if non_null_count == 0:
                            continue  # Skip columns with all nulls
                        
                        num_unique = df[col].nunique(dropna=True)
                        col_variability = num_unique / non_null_count
                        
                        # Determine adaptive threshold based on column characteristics
                        threshold = self._get_adaptive_variability_threshold(df[col], col)
                        
                        # Only flag if below adaptive threshold and dataset is non-trivial
                        if col_variability < threshold and len(df) > 10:
                            column_variability_issues.append({
                                'column': col,
                                'variability': float(col_variability),
                                'unique_values': int(num_unique),
                                'non_null_count': int(non_null_count),
                                'threshold_used': float(threshold),
                                'column_type': self._infer_column_type(df[col], col)
                            })
                    
                    # Store separate metrics in results
                    results['row_uniqueness'] = row_uniqueness
                    if column_variability_issues:
                        # Calculate average variability for columns with issues
                        avg_variability = sum(c['variability'] for c in column_variability_issues) / len(column_variability_issues)
                        results['column_variability_avg'] = avg_variability
                    
                    # For backward compatibility and quality score calculation
                    # Use row_uniqueness as the primary metric
                    results['uniqueness'] = row_uniqueness
                    processed_metrics.append('uniqueness')
                    metric_scores.append(row_uniqueness * weight)
                    
                    # Check uniqueness threshold for row duplicates
                    uniqueness_threshold = parameters.get('threshold', 1.0)
                    
                    # 3. GENERATE ISSUES FOR COLUMN VARIABILITY
                    for col_issue in column_variability_issues:
                        # FIX: Use adaptive threshold for severity calculation (not hardcoded 0.3)
                        col_var_severity = self._calculate_dynamic_severity(
                            actual_value=col_issue['variability'],
                            threshold=col_issue['threshold_used'],
                            metric_type='uniqueness',
                            higher_is_better=True
                        )
                        
                        # FIX: Use "low variability" instead of "low uniqueness" for clarity
                        col_type_desc = col_issue['column_type']
                        issues.append({
                            'evaluation_id': evaluation.id,
                            'metric_id': metrics_map.get(metric_id),
                            'severity': col_var_severity,
                            'description': f"Low variability in {col_type_desc} column '{col_issue['column']}' ({col_issue['variability']:.2%} unique values)",
                            'affected_columns': [col_issue],
                            'issue_type': 'low_variability',
                            'fingerprint': generate_issue_fingerprint(
                                issue_type='low_variability',
                                column_name=col_issue['column'],
                                rule_key='adaptive_threshold',
                                extra_params={'threshold': col_issue['threshold_used']}
                            )
                        })
                    
                    # 4. GENERATE ISSUES FOR ROW DUPLICATES
                    if row_uniqueness < uniqueness_threshold:
                        duplicates = df[df.duplicated(keep='first')]
                        duplicate_count = len(duplicates)
                        
                        if duplicate_count > 0:
                            # Dynamic severity based on uniqueness score
                            row_dup_severity = self._calculate_dynamic_severity(
                                actual_value=row_uniqueness,
                                threshold=uniqueness_threshold,
                                metric_type='uniqueness',
                                higher_is_better=True
                            )
                            
                            sample_data = json.loads(duplicates.head(5).to_json(orient='records')) if duplicate_count > 0 else []
                            if dataset.sensitive_columns and sample_data:
                                for row in sample_data:
                                    for col in dataset.sensitive_columns:
                                        if col in row:
                                            row[col] = "***"
                                            
                            issues.append({
                                'evaluation_id': evaluation.id,
                                'metric_id': metrics_map.get(metric_id),
                                'severity': row_dup_severity,
                                'description': f"Dataset contains {duplicate_count} duplicate rows ({(1-row_uniqueness):.2%} of total)",
                                'affected_rows': {
                                    'count': duplicate_count,
                                    'sample': sample_data
                                },
                                'issue_type': 'duplicate_rows',
                                'fingerprint': generate_duplicate_issue_fingerprint(
                                    is_row_level=True
                                )
                            })
                    
                    # 5. HANDLE COLUMN-SPECIFIC UNIQUENESS (if columns parameter provided)
                    # This checks for non-unique values in columns that SHOULD be unique (e.g., IDs)
                    if 'columns' in parameters and parameters['columns']:
                        for col in parameters['columns']:
                            if col not in df.columns:
                                continue
                            
                            non_null_count = df[col].notna().sum()
                            if non_null_count == 0:
                                continue
                            
                            num_unique = df[col].nunique(dropna=True)
                            col_uniqueness = num_unique / non_null_count
                            duplicate_count = non_null_count - num_unique
                            
                            if col_uniqueness < uniqueness_threshold and duplicate_count > 0:
                                # This is a true uniqueness violation (expected unique, found duplicates)
                                col_dup_severity = self._calculate_dynamic_severity(
                                    actual_value=col_uniqueness,
                                    threshold=uniqueness_threshold,
                                    metric_type='uniqueness',
                                    higher_is_better=True
                                )
                                
                                issues.append({
                                    'evaluation_id': evaluation.id,
                                    'metric_id': metrics_map.get(metric_id),
                                    'severity': col_dup_severity,
                                    'description': f"Column '{col}' expected to be unique but contains {duplicate_count} duplicate values ({col_uniqueness:.2%} unique)",
                                    'affected_columns': [{'column': col, 'duplicate_count': duplicate_count, 'uniqueness': float(col_uniqueness)}],
                                    'issue_type': 'non_unique_identifier',
                                    'fingerprint': generate_issue_fingerprint(
                                        issue_type='non_unique_identifier',
                                        column_name=col,
                                        rule_key='expected_unique',
                                        extra_params={'threshold': uniqueness_threshold}
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
                                        'examples': ["***" for _ in invalid_examples] if column in (dataset.sensitive_columns or []) else invalid_examples
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
                            
                            if outliers['count'] > 0:
                                # Mask sensitive columns data
                                if column in (dataset.sensitive_columns or []):
                                    outliers['sample_values'] = ["***" for _ in outliers.get('sample_values', [])]
                                    for stat_key in ["series_min", "series_max", "median", "mean", "lower_bound", "upper_bound", "q1", "q3", "iqr", "z_threshold", "std"]:
                                        outliers.pop(stat_key, None)
                            
                            outlier_results[column] = outliers
                            
                            if outliers['count'] > 0:
                                # Calculate outlier proportion for dynamic severity
                                non_null_count = len(df[column].dropna())
                                outlier_proportion = outliers['count'] / non_null_count if non_null_count > 0 else 0
                                
                                outlier_severity = self._calculate_dynamic_severity(
                                    actual_value=outlier_proportion,
                                    threshold=0.0,  # Any outlier is technically an issue
                                    metric_type='outliers',
                                    higher_is_better=False
                                )
                                
                                issues.append({
                                    'evaluation_id': evaluation.id,
                                    'metric_id': metrics_map.get(metric_id),
                                    'severity': outlier_severity,
                                    'description': f"Column '{column}' contains {outliers['count']} outliers ({outlier_proportion:.1%} of values)",
                                    'affected_columns': [{'column': column, 'outlier_count': outliers['count'], 'outlier_proportion': float(outlier_proportion)}],
                                    'issue_type': 'outliers',
                                    'fingerprint': generate_outlier_issue_fingerprint(
                                        column_name=column,
                                        method=method,
                                        factor=factor
                                    )
                                })
                    
                    results['outliers'] = outlier_results
                    
                    # Calculate outlier score per-column with severity multiplier
                    if outlier_results:
                        cols_with_outliers = {col: data for col, data in outlier_results.items() if data['count'] > 0}
                        if cols_with_outliers:
                            # Per-column score with 3x penalty multiplier for outlier ratio
                            col_scores = []
                            for col, data in cols_with_outliers.items():
                                non_null = len(df[col].dropna())
                                ratio = data['count'] / non_null if non_null > 0 else 0
                                col_scores.append(max(0.0, 1 - ratio * 3))
                            outlier_score = sum(col_scores) / len(col_scores)
                        else:
                            outlier_score = 1.0
                        processed_metrics.append('outliers')
                        metric_scores.append(outlier_score * weight)
            
                elif metric_id == 'syntactic_accuracy':
                    # Syntactic Accuracy: validate values against expected types/patterns
                    import re as re_module

                    # Built-in pattern library
                    SYNTACTIC_PATTERNS = {
                        'email': r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$',
                        'url': r'^https?://[^\s]+$',
                        'phone_es': r'^(\+34)?[6-9]\d{8}$',
                        'phone_intl': r'^\+?\d{1,4}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{4,14}$',
                        'dni_es': r'^\d{8}[A-Za-z]$',
                        'date_iso': r'^\d{4}-\d{2}-\d{2}$',
                        'date_eu': r'^\d{2}/\d{2}/\d{4}$',
                        'integer': r'^-?\d+$',
                        'decimal': r'^-?\d+[.,]?\d*$',
                        'uuid': r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
                        'ip_v4': r'^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$',
                        'postal_code_es': r'^\d{5}$',
                        'credit_card': r'^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$',
                    }

                    auto_detect = parameters.get('auto_detect_types', True)
                    custom_patterns = parameters.get('custom_patterns', {})
                    user_columns = parameters.get('columns', [])
                    accuracy_threshold = parameters.get('threshold', 0.95)

                    # Build column -> (expected_type, pattern) mapping
                    column_checks = {}

                    # 1. User-defined column checks
                    for col_cfg in user_columns:
                        if isinstance(col_cfg, dict):
                            col_name = col_cfg.get('column', '')
                            exp_type = col_cfg.get('expected_type', '')
                            custom_pat = col_cfg.get('pattern', '')
                            if col_name and col_name in df.columns:
                                if custom_pat:
                                    column_checks[col_name] = (exp_type or 'custom', custom_pat)
                                elif exp_type in SYNTACTIC_PATTERNS:
                                    column_checks[col_name] = (exp_type, SYNTACTIC_PATTERNS[exp_type])

                    # 2. User-defined custom patterns (key=column, value=pattern)
                    for col_name, pattern_str in custom_patterns.items():
                        if col_name in df.columns and col_name not in column_checks:
                            column_checks[col_name] = ('custom', pattern_str)

                    # 3. Auto-detect types for string columns not already assigned
                    if auto_detect:
                        string_cols = [c for c in df.columns
                                       if df[c].dtype == 'object' and c not in column_checks]
                        for col in string_cols:
                            sample = df[col].dropna().head(100).astype(str)
                            if len(sample) == 0:
                                continue

                            best_type = None
                            best_rate = 0.0

                            for type_name, pattern_str in SYNTACTIC_PATTERNS.items():
                                try:
                                    regex = re_module.compile(pattern_str)
                                    match_count = sum(1 for v in sample if regex.match(str(v)))
                                    match_rate = match_count / len(sample)
                                    if match_rate > best_rate and match_rate >= 0.60:
                                        best_rate = match_rate
                                        best_type = type_name
                                except re_module.error:
                                    continue

                            if best_type:
                                column_checks[col] = (best_type, SYNTACTIC_PATTERNS[best_type])

                    # 4. Validate each column
                    accuracy_results = {}
                    conformance_scores = []

                    for col_name, (expected_type, pattern_str) in column_checks.items():
                        try:
                            regex = re_module.compile(pattern_str)
                        except re_module.error:
                            logger.warning(f"[SYNTACTIC] Invalid regex for column '{col_name}': {pattern_str}")
                            continue

                        non_null = df[col_name].dropna()
                        if len(non_null) == 0:
                            continue

                        valid_count = 0
                        invalid_count = 0
                        invalid_samples = []

                        for value in non_null:
                            str_value = str(value)
                            if regex.match(str_value):
                                valid_count += 1
                            else:
                                invalid_count += 1
                                if len(invalid_samples) < 5:
                                    invalid_samples.append(str_value)

                        total_checked = valid_count + invalid_count
                        conformance_rate = valid_count / total_checked if total_checked > 0 else 1.0
                        conformance_scores.append(conformance_rate)

                        # Mask sensitive columns
                        if col_name in (dataset.sensitive_columns or []):
                            invalid_samples = ['***' for _ in invalid_samples]

                        accuracy_results[col_name] = {
                            'expected_type': expected_type,
                            'pattern': pattern_str,
                            'conformance_rate': float(conformance_rate),
                            'valid_count': valid_count,
                            'invalid_count': invalid_count,
                            'total_checked': total_checked,
                            'sample_invalid': invalid_samples,
                        }

                        # Generate issue if below threshold
                        if conformance_rate < accuracy_threshold:
                            severity = self._calculate_dynamic_severity(
                                actual_value=conformance_rate,
                                threshold=accuracy_threshold,
                                metric_type='completeness',
                                higher_is_better=True
                            )

                            issues.append({
                                'evaluation_id': evaluation.id,
                                'metric_id': metrics_map.get('syntactic_accuracy'),
                                'severity': severity,
                                'description': (
                                    f"Column '{col_name}' has {invalid_count} values not matching "
                                    f"expected type '{expected_type}' ({conformance_rate:.2%} conformance)"
                                ),
                                'affected_columns': [{
                                    'column': col_name,
                                    'expected_type': expected_type,
                                    'invalid_count': invalid_count,
                                    'conformance_rate': float(conformance_rate),
                                }],
                                'issue_type': 'syntactic_accuracy',
                                'fingerprint': generate_syntactic_accuracy_fingerprint(
                                    column_name=col_name,
                                    expected_type=expected_type,
                                    pattern=pattern_str
                                ),
                            })

                    # Overall score
                    overall_conformance = (
                        sum(conformance_scores) / len(conformance_scores)
                        if conformance_scores else 1.0
                    )

                    results['syntactic_accuracy'] = {
                        'overall_conformance': float(overall_conformance),
                        'columns_checked': len(column_checks),
                        'columns': accuracy_results,
                    }
                    processed_metrics.append('syntactic_accuracy')
                    metric_scores.append(overall_conformance * weight)

                    logger.info(
                        f"[SYNTACTIC] Checked {len(column_checks)} columns, "
                        f"overall conformance: {overall_conformance:.2%}"
                    )

                elif metric_id == 'logical_consistency':
                    # Logical Consistency: cross-field validation rules
                    import re as re_module

                    rules = parameters.get('rules', [])

                    if not rules:
                        logger.info("[CONSISTENCY] No rules configured, skipping")
                    else:
                        # Blacklist of dangerous tokens for safe evaluation
                        FORBIDDEN_TOKENS = [
                            'import', '__', 'exec', 'eval', 'compile',
                            'globals', 'locals', 'getattr', 'setattr', 'delattr',
                            'open', 'os.', 'sys.', 'subprocess', 'shutil',
                            'lambda', 'def ', 'class ',
                        ]

                        consistency_results = []
                        compliance_scores = []

                        for rule_idx, rule in enumerate(rules):
                            rule_name = rule.get('name', f'Regla {rule_idx + 1}')
                            expression = rule.get('expression', '')
                            rule_type = rule.get('type', 'violation')  # violation | if_then

                            if not expression:
                                continue

                            # Sanitize expression
                            expr_lower = expression.lower()
                            is_safe = True
                            for token in FORBIDDEN_TOKENS:
                                if token in expr_lower:
                                    logger.warning(
                                        f"[CONSISTENCY] Blocked unsafe expression in rule '{rule_name}': "
                                        f"contains '{token}'"
                                    )
                                    is_safe = False
                                    break

                            if not is_safe:
                                issues.append({
                                    'evaluation_id': evaluation.id,
                                    'metric_id': metrics_map.get('logical_consistency'),
                                    'severity': 'high',
                                    'description': (
                                        f"Rule '{rule_name}' contains forbidden tokens and was blocked for safety"
                                    ),
                                    'affected_columns': [],
                                    'issue_type': 'logical_consistency',
                                    'fingerprint': generate_logical_consistency_fingerprint(
                                        rule_expression=expression,
                                        rule_name=rule_name
                                    ),
                                })
                                continue

                            try:
                                total_rows = len(df)

                                if rule_type == 'if_then':
                                    # Format: {"condition": "col == 'X'", "assertion": "col2.notna()"}
                                    condition = rule.get('condition', '')
                                    assertion = rule.get('assertion', '')

                                    if not condition or not assertion:
                                        # Try parsing from expression: "IF ... THEN ..."
                                        if_match = re_module.match(
                                            r'(?:IF|Si|WHEN|Cuando)\s+(.+?)\s+(?:THEN|Entonces|THEN)\s+(.+)',
                                            expression, re_module.IGNORECASE
                                        )
                                        if if_match:
                                            condition = if_match.group(1).strip()
                                            assertion = if_match.group(2).strip()
                                        else:
                                            logger.warning(
                                                f"[CONSISTENCY] Could not parse IF-THEN rule '{rule_name}': {expression}"
                                            )
                                            continue

                                    # Find rows where condition is true
                                    condition_rows = df.query(condition)

                                    if len(condition_rows) == 0:
                                        # Condition never met, rule passes
                                        compliance_rate = 1.0
                                        violation_count = 0
                                        sample_violations = []
                                    else:
                                        # Among condition rows, find which violate assertion
                                        # Negate assertion: rows where assertion is FALSE are violations
                                        try:
                                            passing_rows = condition_rows.query(assertion)
                                            violation_count = len(condition_rows) - len(passing_rows)
                                            violating_indices = condition_rows.index.difference(passing_rows.index)
                                            violation_df = df.loc[violating_indices]
                                        except Exception:
                                            # If assertion can't be queried (e.g. notna()), try negation
                                            try:
                                                negated = f"not ({assertion})"
                                                violation_df = condition_rows.query(negated)
                                                violation_count = len(violation_df)
                                            except Exception:
                                                # Last resort: evaluate assertion as boolean mask
                                                violation_df = pd.DataFrame()
                                                violation_count = 0

                                        compliance_rate = 1 - (violation_count / total_rows) if total_rows > 0 else 1.0

                                        # Sample violations
                                        sample_data = json.loads(
                                            violation_df.head(5).to_json(orient='records')
                                        ) if violation_count > 0 else []
                                        # Mask sensitive columns
                                        if dataset.sensitive_columns and sample_data:
                                            for row in sample_data:
                                                for sc in dataset.sensitive_columns:
                                                    if sc in row:
                                                        row[sc] = "***"
                                        sample_violations = sample_data

                                else:
                                    # Default: expression directly selects violating rows
                                    # e.g. "end_date < start_date" returns rows that violate the rule
                                    violation_df = df.query(expression)
                                    violation_count = len(violation_df)
                                    compliance_rate = 1 - (violation_count / total_rows) if total_rows > 0 else 1.0

                                    sample_data = json.loads(
                                        violation_df.head(5).to_json(orient='records')
                                    ) if violation_count > 0 else []
                                    if dataset.sensitive_columns and sample_data:
                                        for row in sample_data:
                                            for sc in dataset.sensitive_columns:
                                                if sc in row:
                                                    row[sc] = "***"
                                    sample_violations = sample_data

                                compliance_scores.append(compliance_rate)

                                # Extract affected columns from expression
                                affected_cols = [
                                    c for c in df.columns
                                    if c in expression or c in rule.get('condition', '') or c in rule.get('assertion', '')
                                ]

                                rule_result = {
                                    'name': rule_name,
                                    'expression': expression,
                                    'type': rule_type,
                                    'violation_count': violation_count,
                                    'total_rows': total_rows,
                                    'compliance_rate': float(compliance_rate),
                                    'affected_columns': affected_cols,
                                    'sample_violations': sample_violations if violation_count > 0 else [],
                                }
                                consistency_results.append(rule_result)

                                # Generate issue if violations found
                                if violation_count > 0:
                                    violation_pct = violation_count / total_rows if total_rows > 0 else 0
                                    severity = self._calculate_dynamic_severity(
                                        actual_value=compliance_rate,
                                        threshold=1.0,
                                        metric_type='completeness',
                                        higher_is_better=True
                                    )

                                    issues.append({
                                        'evaluation_id': evaluation.id,
                                        'metric_id': metrics_map.get('logical_consistency'),
                                        'severity': severity,
                                        'description': (
                                            f"Rule '{rule_name}' violated in {violation_count} rows "
                                            f"({violation_pct:.2%} of dataset)"
                                        ),
                                        'affected_columns': [{'column': c} for c in affected_cols],
                                        'affected_rows': {
                                            'count': violation_count,
                                            'sample': sample_violations[:5],
                                        },
                                        'issue_type': 'logical_consistency',
                                        'fingerprint': generate_logical_consistency_fingerprint(
                                            rule_expression=expression,
                                            rule_name=rule_name
                                        ),
                                    })

                            except Exception as rule_error:
                                logger.error(
                                    f"[CONSISTENCY] Error evaluating rule '{rule_name}': {rule_error}"
                                )
                                consistency_results.append({
                                    'name': rule_name,
                                    'expression': expression,
                                    'type': rule_type,
                                    'error': str(rule_error),
                                    'violation_count': 0,
                                    'total_rows': len(df),
                                    'compliance_rate': None,
                                    'affected_columns': [],
                                    'sample_violations': [],
                                })

                        # Overall score
                        overall_compliance = (
                            sum(compliance_scores) / len(compliance_scores)
                            if compliance_scores else 1.0
                        )

                        results['logical_consistency'] = {
                            'overall_compliance': float(overall_compliance),
                            'rules_evaluated': len(consistency_results),
                            'rules_with_violations': sum(
                                1 for r in consistency_results if r.get('violation_count', 0) > 0
                            ),
                            'rules': consistency_results,
                        }
                        processed_metrics.append('logical_consistency')
                        metric_scores.append(overall_compliance * weight)

                        logger.info(
                            f"[CONSISTENCY] Evaluated {len(consistency_results)} rules, "
                            f"overall compliance: {overall_compliance:.2%}"
                        )

                elif metric_id == 'class_balance':
                    # Class Balance: measure distribution balance of categorical variables
                    auto_detect = parameters.get('auto_detect', True)
                    user_columns = parameters.get('columns', [])
                    max_cardinality = parameters.get('max_cardinality', 50)
                    threshold_high = parameters.get('imbalance_threshold_high', 0.90)
                    threshold_low = parameters.get('imbalance_threshold_low', 0.05)

                    # Select columns to analyze
                    target_columns = []

                    if user_columns:
                        target_columns = [c for c in user_columns if c in df.columns]

                    if auto_detect:
                        for col in df.columns:
                            if col in target_columns:
                                continue
                            n_unique = df[col].nunique(dropna=True)
                            if n_unique <= 1:
                                continue  # Skip constant columns
                            if n_unique <= max_cardinality:
                                # Categorical-like: object/category or int with few values
                                if df[col].dtype == 'object' or str(df[col].dtype) == 'category':
                                    target_columns.append(col)
                                elif pd.api.types.is_integer_dtype(df[col]) and n_unique <= 20:
                                    target_columns.append(col)

                    balance_results = {}
                    balance_scores = []

                    for col in target_columns:
                        non_null = df[col].dropna()
                        if len(non_null) == 0:
                            continue

                        value_counts = non_null.value_counts(normalize=True)
                        n_classes = len(value_counts)

                        if n_classes <= 1:
                            balance_index = 0.0
                            entropy_val = 0.0
                            max_entropy = 0.0
                        else:
                            # Shannon entropy (numpy-based, no scipy needed)
                            probs = value_counts.values
                            entropy_val = float(-np.sum(probs * np.log2(probs + 1e-12)))
                            max_entropy = float(np.log2(n_classes))
                            balance_index = float((entropy_val / max_entropy) * 100) if max_entropy > 0 else 100.0

                        balance_scores.append(balance_index / 100.0)

                        # Frequency table (top 20 + others)
                        abs_counts = non_null.value_counts()
                        freq_table = {}
                        for i, (val, count) in enumerate(abs_counts.items()):
                            if i < 20:
                                freq_table[str(val)] = {
                                    'count': int(count),
                                    'proportion': float(value_counts.iloc[i]),
                                }
                            else:
                                # Aggregate remaining
                                others_count = int(abs_counts.iloc[20:].sum())
                                others_prop = float(value_counts.iloc[20:].sum())
                                freq_table['__others__'] = {
                                    'count': others_count,
                                    'proportion': others_prop,
                                    'num_classes': n_classes - 20,
                                }
                                break

                        dominant_class = str(value_counts.index[0])
                        dominant_prop = float(value_counts.iloc[0])
                        minority_class = str(value_counts.index[-1])
                        minority_prop = float(value_counts.iloc[-1])

                        # Mask sensitive columns
                        if col in (dataset.sensitive_columns or []):
                            dominant_class = '***'
                            minority_class = '***'
                            freq_table = {'***': {'count': len(non_null), 'proportion': 1.0}}

                        alerts = []
                        if dominant_prop >= threshold_high:
                            alerts.append(f"Clase dominante '{dominant_class}' ocupa {dominant_prop:.1%} del total")
                        if minority_prop <= threshold_low and n_classes > 1:
                            alerts.append(f"Clase minoritaria '{minority_class}' solo ocupa {minority_prop:.1%} del total")

                        balance_results[col] = {
                            'balance_index': round(balance_index, 2),
                            'entropy': round(entropy_val, 4),
                            'max_entropy': round(max_entropy, 4),
                            'num_classes': n_classes,
                            'total_values': len(non_null),
                            'frequency_table': freq_table,
                            'dominant_class': {'value': dominant_class, 'proportion': round(dominant_prop, 4)},
                            'minority_class': {'value': minority_class, 'proportion': round(minority_prop, 4)},
                            'alerts': alerts,
                        }

                        # Generate issues for imbalanced columns
                        if dominant_prop >= threshold_high:
                            severity = self._calculate_dynamic_severity(
                                actual_value=dominant_prop,
                                threshold=0.0,
                                metric_type='outliers',
                                higher_is_better=False
                            )

                            issues.append({
                                'evaluation_id': evaluation.id,
                                'metric_id': metrics_map.get('class_balance'),
                                'severity': severity,
                                'description': (
                                    f"Column '{col}' is highly imbalanced: dominant class "
                                    f"'{dominant_class}' represents {dominant_prop:.1%} of values "
                                    f"(balance index: {balance_index:.1f}/100)"
                                ),
                                'affected_columns': [{
                                    'column': col,
                                    'dominant_class': dominant_class,
                                    'dominant_proportion': round(dominant_prop, 4),
                                    'balance_index': round(balance_index, 2),
                                }],
                                'issue_type': 'class_balance',
                                'fingerprint': generate_class_balance_fingerprint(
                                    column_name=col,
                                    imbalance_type='dominant_class'
                                ),
                            })

                        if minority_prop <= threshold_low and n_classes > 1:
                            # Only generate separate issue if not already covered by dominant
                            severity_min = 'medium' if minority_prop < 0.02 else 'low'

                            issues.append({
                                'evaluation_id': evaluation.id,
                                'metric_id': metrics_map.get('class_balance'),
                                'severity': severity_min,
                                'description': (
                                    f"Column '{col}' has underrepresented minority class "
                                    f"'{minority_class}' at {minority_prop:.2%} of values"
                                ),
                                'affected_columns': [{
                                    'column': col,
                                    'minority_class': minority_class,
                                    'minority_proportion': round(minority_prop, 4),
                                    'balance_index': round(balance_index, 2),
                                }],
                                'issue_type': 'class_balance',
                                'fingerprint': generate_class_balance_fingerprint(
                                    column_name=col,
                                    imbalance_type='minority_class'
                                ),
                            })

                    # Overall score
                    overall_balance = (
                        sum(balance_scores) / len(balance_scores)
                        if balance_scores else 1.0
                    )

                    results['class_balance'] = {
                        'overall_balance_index': round(overall_balance * 100, 2),
                        'columns_analyzed': len(balance_results),
                        'columns_with_alerts': sum(
                            1 for r in balance_results.values() if r.get('alerts')
                        ),
                        'columns': balance_results,
                    }
                    processed_metrics.append('class_balance')
                    metric_scores.append(overall_balance * weight)

                    logger.info(
                        f"[CLASS_BALANCE] Analyzed {len(balance_results)} columns, "
                        f"overall balance index: {overall_balance * 100:.1f}/100"
                    )

                elif metric_id == 'timeliness':
                    # Timeliness: measure data freshness and recency
                    auto_detect = parameters.get('auto_detect', True)
                    user_columns = parameters.get('columns', [])
                    staleness_days = parameters.get('staleness_threshold_days', 30)

                    now = pd.Timestamp.now()

                    # Identify date columns
                    date_columns = {}  # col_name -> parsed Series

                    # 1. User-specified columns
                    for col in user_columns:
                        if col in df.columns:
                            parsed = pd.to_datetime(df[col], errors='coerce', infer_datetime_format=True)
                            success_rate = parsed.notna().sum() / len(df) if len(df) > 0 else 0
                            if success_rate > 0.3:
                                date_columns[col] = parsed

                    # 2. Auto-detect date columns
                    if auto_detect:
                        for col in df.columns:
                            if col in date_columns:
                                continue

                            # Already datetime dtype
                            if pd.api.types.is_datetime64_any_dtype(df[col]):
                                date_columns[col] = df[col]
                                continue

                            # Try parsing object columns (sample first for performance)
                            if df[col].dtype == 'object':
                                sample = df[col].dropna().head(50)
                                if len(sample) == 0:
                                    continue
                                try:
                                    parsed_sample = pd.to_datetime(
                                        sample, errors='coerce', infer_datetime_format=True
                                    )
                                    sample_success = parsed_sample.notna().sum() / len(sample)
                                    if sample_success >= 0.50:
                                        # Good match on sample, parse full column
                                        parsed_full = pd.to_datetime(
                                            df[col], errors='coerce', infer_datetime_format=True
                                        )
                                        date_columns[col] = parsed_full
                                except Exception:
                                    continue

                    # Analyze each date column
                    timeliness_results = {}
                    freshness_scores = []

                    for col_name, parsed_series in date_columns.items():
                        valid_dates = parsed_series.dropna()
                        if len(valid_dates) == 0:
                            continue

                        parse_success_rate = float(parsed_series.notna().sum() / len(df)) if len(df) > 0 else 0
                        max_date = valid_dates.max()
                        min_date = valid_dates.min()
                        age_days = (now - max_date).days if pd.notna(max_date) else None
                        date_range_days = (max_date - min_date).days if pd.notna(max_date) and pd.notna(min_date) else None

                        is_stale = age_days is not None and age_days > staleness_days

                        # Freshness score for this column
                        if age_days is None:
                            col_freshness = 0.0
                        elif age_days <= staleness_days:
                            col_freshness = 1.0
                        else:
                            # Linear decay: drops to 0 at 2x the threshold
                            col_freshness = max(0.0, 1.0 - (age_days - staleness_days) / staleness_days)

                        freshness_scores.append(col_freshness)

                        # Format human-readable age
                        if age_days is not None:
                            if age_days == 0:
                                age_human = 'Hoy'
                            elif age_days == 1:
                                age_human = '1 dia'
                            elif age_days < 30:
                                age_human = f'{age_days} dias'
                            elif age_days < 365:
                                months = age_days // 30
                                remaining_days = age_days % 30
                                age_human = f'{months} mes{"es" if months > 1 else ""}'
                                if remaining_days > 0:
                                    age_human += f' y {remaining_days} dia{"s" if remaining_days > 1 else ""}'
                            else:
                                years = age_days // 365
                                remaining_months = (age_days % 365) // 30
                                age_human = f'{years} ano{"s" if years > 1 else ""}'
                                if remaining_months > 0:
                                    age_human += f' y {remaining_months} mes{"es" if remaining_months > 1 else ""}'
                        else:
                            age_human = 'Desconocido'

                        timeliness_results[col_name] = {
                            'max_date': max_date.isoformat() if pd.notna(max_date) else None,
                            'min_date': min_date.isoformat() if pd.notna(min_date) else None,
                            'age_days': int(age_days) if age_days is not None else None,
                            'age_human': age_human,
                            'date_range_days': int(date_range_days) if date_range_days is not None else None,
                            'parse_success_rate': round(parse_success_rate, 4),
                            'valid_dates_count': len(valid_dates),
                            'is_stale': is_stale,
                            'freshness_score': round(col_freshness, 4),
                            'staleness_threshold_days': staleness_days,
                        }

                        # Generate issue for stale columns
                        if is_stale:
                            # Severity based on how far past threshold
                            ratio = age_days / staleness_days if staleness_days > 0 else 10
                            if ratio >= 10:
                                severity = 'critical'
                            elif ratio >= 3:
                                severity = 'high'
                            elif ratio >= 1:
                                severity = 'medium'
                            else:
                                severity = 'low'

                            issues.append({
                                'evaluation_id': evaluation.id,
                                'metric_id': metrics_map.get('timeliness'),
                                'severity': severity,
                                'description': (
                                    f"Column '{col_name}' contains stale data: most recent record "
                                    f"is {age_human} old (threshold: {staleness_days} days)"
                                ),
                                'affected_columns': [{
                                    'column': col_name,
                                    'age_days': int(age_days),
                                    'max_date': max_date.isoformat(),
                                    'freshness_score': round(col_freshness, 4),
                                }],
                                'issue_type': 'timeliness',
                                'fingerprint': generate_timeliness_fingerprint(
                                    column_name=col_name,
                                    staleness_threshold_days=staleness_days
                                ),
                            })

                        # Generate info issue for poor date parsing
                        if parse_success_rate < 0.80 and len(df) > 10:
                            issues.append({
                                'evaluation_id': evaluation.id,
                                'metric_id': metrics_map.get('timeliness'),
                                'severity': 'low',
                                'description': (
                                    f"Column '{col_name}' has low date parse success rate "
                                    f"({parse_success_rate:.1%}): some values may not be valid dates"
                                ),
                                'affected_columns': [{
                                    'column': col_name,
                                    'parse_success_rate': round(parse_success_rate, 4),
                                }],
                                'issue_type': 'timeliness',
                                'fingerprint': generate_issue_fingerprint(
                                    issue_type='timeliness',
                                    column_name=col_name,
                                    rule_key='parse_quality_check'
                                ),
                            })

                    # Overall freshness score
                    overall_freshness = (
                        sum(freshness_scores) / len(freshness_scores)
                        if freshness_scores else 1.0
                    )

                    results['timeliness'] = {
                        'overall_freshness_score': round(overall_freshness, 4),
                        'columns_analyzed': len(timeliness_results),
                        'columns_stale': sum(
                            1 for r in timeliness_results.values() if r.get('is_stale')
                        ),
                        'staleness_threshold_days': staleness_days,
                        'analysis_timestamp': now.isoformat(),
                        'columns': timeliness_results,
                    }
                    processed_metrics.append('timeliness')
                    metric_scores.append(overall_freshness * weight)

                    logger.info(
                        f"[TIMELINESS] Analyzed {len(timeliness_results)} date columns, "
                        f"overall freshness: {overall_freshness:.2%}, "
                        f"stale: {sum(1 for r in timeliness_results.values() if r.get('is_stale'))}"
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
                
                # Generate issues for individual columns with low completeness
                if completeness < 0.98 and 'completeness' in processed_metrics:
                    # Calculate dynamic severity for this column
                    col_severity = self._calculate_dynamic_severity(
                        actual_value=completeness,
                        threshold=0.98,
                        metric_type='completeness',
                        higher_is_better=True
                    )
                    
                    issues.append({
                        'evaluation_id': evaluation.id,
                        'metric_id': metrics_map.get('completeness'),
                        'severity': col_severity,
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
            
            # Calculate overall quality score with issue-based penalty
            base_score = sum(metric_scores) / len(metric_scores) if metric_scores else 0.0
            
            # Apply penalty based on detected issues (severity-weighted)
            high_count = sum(1 for i in issues if i.get('severity') == 'high')
            medium_count = sum(1 for i in issues if i.get('severity') == 'medium')
            low_count = sum(1 for i in issues if i.get('severity') == 'low')
            issue_penalty = (high_count * 0.05) + (medium_count * 0.025) + (low_count * 0.01)
            
            quality_score = max(0.0, min(1.0, base_score - issue_penalty))
            logger.info(f"[SCORE] base={base_score:.4f}, penalty={issue_penalty:.4f} "
                        f"(high={high_count}, med={medium_count}, low={low_count}), "
                        f"final={quality_score:.4f}")
            
            self._update_progress(evaluation_id, 95, "Guardando resultados...", analysis_run_id)
            
            # Build per-metric score breakdown for transparency
            score_breakdown = {}
            for i, metric_name in enumerate(processed_metrics):
                score_breakdown[metric_name] = round(metric_scores[i], 4) if i < len(metric_scores) else None
            
            # Prepare results dict
            results_dict = {
                'overall': {
                    'quality_score': quality_score,
                    'metrics_processed': processed_metrics,
                    'score_breakdown': {
                        'metric_scores': score_breakdown,
                        'base_score': round(base_score, 4),
                        'issue_penalty': round(issue_penalty, 4),
                        'penalty_detail': {
                            'high_issues': high_count,
                            'medium_issues': medium_count,
                            'low_issues': low_count,
                            'high_weight': 0.05,
                            'medium_weight': 0.025,
                            'low_weight': 0.01,
                        },
                        'final_score': round(quality_score, 4),
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
    
    def _infer_column_type(self, series, column_name):
        """Infer semantic column type for better issue descriptions
        
        Args:
            series: Pandas series to analyze
            column_name: Name of the column
            
        Returns:
            str: Column type description ('ID', 'categorical', 'numeric', 'text')
        """
        num_unique = series.nunique()
        
        # Check if it's an ID column (more specific patterns)
        id_patterns = [r'_id$', r'^id$', r'_uuid$', r'^uuid$', r'_guid$', r'_key$']
        import re
        if any(re.search(pattern, column_name.lower()) for pattern in id_patterns):
            return 'ID'
        
        # Categorical: few unique values, non-numeric
        if num_unique <= 20 and not pd.api.types.is_numeric_dtype(series):
            return 'categorical'
        
        # Numeric
        if pd.api.types.is_numeric_dtype(series):
            return 'numeric'
        
        # High-cardinality text
        return 'text'
    
    def _get_adaptive_variability_threshold(self, series, column_name):
        """Determine adaptive threshold for column variability based on column type
        
        Args:
            series: Pandas series to analyze
            column_name: Name of the column
            
        Returns:
            float: Adaptive threshold for uniqueness (0.0 to 1.0)
        """
        num_unique = series.nunique()
        
        # FIX: More specific ID column detection (avoid false positives like 'country_code')
        # Only match patterns like: _id, id, _uuid, _guid, _key at end of name
        id_patterns = [r'_id$', r'^id$', r'_uuid$', r'^uuid$', r'_guid$', r'_key$']
        import re
        is_id_column = any(re.search(pattern, column_name.lower()) for pattern in id_patterns)
        
        if is_id_column:
            return 0.95  # Expect 95%+ unique values for ID columns
        
        # Categorical columns (few unique values, non-numeric)
        is_categorical = (num_unique <= 20 and not pd.api.types.is_numeric_dtype(series))
        
        if is_categorical:
            # For categorical columns, only flag if extremely low variability
            # (e.g., 95%+ of values are the same)
            return 0.05  # Flag only if < 5% unique (very low variability)
        else:
            # For numeric or high-cardinality text columns
            # Use standard threshold of 30%
            return 0.30
    
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
        
        result = {
            'count': len(outliers),
            'indices': list(outliers.index),
            'total_values': len(series),
            'proportion': len(outliers) / len(series) if len(series) > 0 else 0,
            'method': method,
            'factor': factor,
            'sample_values': [float(v) for v in outliers.head(5).values] if len(outliers) > 0 else [],
            'series_min': float(series.min()),
            'series_max': float(series.max()),
            'median': float(series.median()),
            'mean': float(series.mean()),
        }
        
        if method == 'iqr':
            result['lower_bound'] = float(lower_bound)
            result['upper_bound'] = float(upper_bound)
            result['q1'] = float(q1)
            result['q3'] = float(q3)
            result['iqr'] = float(iqr)
            result['median'] = float(series.median())  # Q2
        elif method == 'zscore':
            result['mean'] = float(mean)
            result['std'] = float(std)
            result['z_threshold'] = float(factor)
        
        return result
