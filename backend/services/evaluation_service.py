from datetime import datetime
import pandas as pd
import numpy as np
import io

from extensions import db
from models.evaluation import Evaluation, Issue
from models.dataset import Dataset
from models.metric import Metric
from services.dataset_service import DatasetService
from services.minio_service import MinioService

class EvaluationService:
    """Service for running data quality evaluations"""
    
    def __init__(self):
        """Initialize evaluation service"""
        self.dataset_service = DatasetService()
        self.minio_service = MinioService()
    
    def run_evaluation(self, evaluation_id):
        """Run a data quality evaluation
        
        Args:
            evaluation_id: ID of the evaluation to run
            
        Returns:
            dict: Result of the evaluation with success status and quality score
        """
        # Get evaluation from database
        evaluation = Evaluation.query.get(evaluation_id)
        if not evaluation:
            raise Exception("Evaluation not found")
        
        try:
            # Get dataset
            dataset = Dataset.query.get(evaluation.dataset_id)
            if not dataset:
                raise Exception("Dataset not found")
            
            # Download dataset from MinIO
            file_data = self.minio_service.download_file(dataset.file_path)
            
            # Read dataset with pandas
            df = pd.read_csv(io.BytesIO(file_data))
            
            # Run metrics based on configuration
            results = {}
            issues = []
            
            # Get metrics configuration
            metrics_config = evaluation.metrics_config.get('metrics', [])
            
            # Track processed metrics for quality score calculation
            processed_metrics = []
            metric_scores = []
            
            # Process each configured metric
            for metric_config in metrics_config:
                metric_id = metric_config.get('id')
                parameters = metric_config.get('parameters', {})
                weight = metric_config.get('weight', 1.0)
                
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
                        
                        # Create issue
                        issues.append({
                            'evaluation_id': evaluation.id,
                            'metric_id': metric_id,
                            'severity': 'high' if completeness < 0.8 else 'medium',
                            'description': f"Dataset completeness ({completeness:.2%}) is below threshold ({completeness_threshold:.2%})",
                            'affected_columns': problem_columns
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
                        # Calculate for entire dataset (row-wise)
                        uniqueness = len(df.drop_duplicates()) / len(df) if len(df) > 0 else 1.0
                    
                    results['uniqueness'] = uniqueness
                    processed_metrics.append('uniqueness')
                    metric_scores.append(uniqueness * weight)
                    
                    # Check uniqueness threshold
                    uniqueness_threshold = parameters.get('threshold', 1.0)
                    
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
                                issues.append({
                                    'evaluation_id': evaluation.id,
                                    'metric_id': metric_id,
                                    'severity': 'high' if uniqueness < 0.9 else 'medium',
                                    'description': f"Columns contain duplicate values",
                                    'affected_columns': [{'column': col, 'duplicate_count': count} 
                                                        for col, count in duplicate_info.items()]
                                })
                        else:
                            # Row-wise duplicates
                            duplicates = df[df.duplicated(keep='first')]
                            duplicate_count = len(duplicates)
                            
                            if duplicate_count > 0:
                                issues.append({
                                    'evaluation_id': evaluation.id,
                                    'metric_id': metric_id,
                                    'severity': 'high' if uniqueness < 0.9 else 'medium',
                                    'description': f"Dataset contains {duplicate_count} duplicate rows ({(1-uniqueness):.2%} of total)",
                                    'affected_rows': {
                                        'count': duplicate_count,
                                        'sample': duplicates.head(5).to_dict(orient='records') if duplicate_count > 0 else []
                                    }
                                })
                
                elif metric_id == 'consistency_pattern':
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
                                    'metric_id': metric_id,
                                    'severity': 'high' if consistency_score < 0.8 else 'medium',
                                    'description': f"Column '{column}' has {invalid_count} values that don't match pattern '{pattern}'",
                                    'affected_columns': [{'column': column, 'invalid_count': invalid_count}],
                                    'details': {
                                        'valid_count': valid_count,
                                        'invalid_count': invalid_count,
                                        'examples': invalid_examples
                                    }
                                })
                        except re.error:
                            issues.append({
                                'evaluation_id': evaluation.id,
                                'metric_id': metric_id,
                                'severity': 'high',
                                'description': f"Invalid regex pattern '{pattern}' for column '{column}'"
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
                                    'metric_id': metric_id,
                                    'severity': 'medium',
                                    'description': f"Column '{column}' contains {outliers['count']} outliers",
                                    'affected_columns': [{'column': column, 'outlier_count': outliers['count']}]
                                })
                    
                    results['outliers'] = outlier_results
                    
                    # Calculate outlier score (1 - proportion of outliers)
                    if outlier_results:
                        total_values = sum(len(df[col].dropna()) for col in outlier_results.keys())
                        total_outliers = sum(outlier_results[col]['count'] for col in outlier_results.keys())
                        outlier_score = 1 - (total_outliers / total_values if total_values > 0 else 0)
                        processed_metrics.append('outliers')
                        metric_scores.append(outlier_score * weight)
            
            # Calculate column-level metrics for all columns
            column_metrics = {}
            for column in df.columns:
                column_metrics[column] = {
                    'completeness': 1 - df[column].isna().mean(),
                    'uniqueness': df[column].nunique() / len(df) if len(df) > 0 else 1,
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
            
            # Calculate overall quality score
            quality_score = sum(metric_scores) / len(metric_scores) if metric_scores else 0.0
            
            # Update evaluation with results
            evaluation.results = {
                'overall': {
                    'quality_score': quality_score,
                    'metrics_processed': processed_metrics,
                    **results  # Include all metric results
                },
                'column_metrics': column_metrics
            }
            evaluation.quality_score = quality_score
            evaluation.status = 'completed'
            evaluation.completed_at = datetime.utcnow()
            
            # Save evaluation results to database
            db.session.commit()
            
            # Create issues in database
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
            
            db.session.commit()
            
            return {
                'success': True,
                'evaluation_id': evaluation.id,
                'quality_score': float(quality_score),
                'issues_count': len(issues)
            }
        
        except Exception as e:
            # Update evaluation status to failed
            evaluation.status = 'failed'
            evaluation.error = str(e)
            evaluation.completed_at = datetime.utcnow()
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
