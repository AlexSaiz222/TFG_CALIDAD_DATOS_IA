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
        """
        # Get evaluation from database
        evaluation = Evaluation.query.get(evaluation_id)
        if not evaluation:
            raise Exception("Evaluation not found")
        
        # Update evaluation status
        evaluation.status = 'running'
        db.session.commit()
        
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
            
            # Calculate completeness (percentage of non-null values)
            completeness = 1 - df.isna().mean().mean()
            results['completeness'] = completeness
            
            # Check completeness threshold
            completeness_threshold = 0.95
            for metric_config in evaluation.metrics_config:
                if metric_config.get('name') == 'completeness':
                    completeness_threshold = metric_config.get('parameters', {}).get('threshold', 0.95)
            
            if completeness < completeness_threshold:
                # Find columns with high null rates
                problem_columns = []
                for column in df.columns:
                    null_rate = df[column].isna().mean()
                    if null_rate > (1 - completeness_threshold):
                        problem_columns.append({
                            'column': column,
                            'null_rate': null_rate
                        })
                
                # Create issue
                issues.append({
                    'evaluation_id': evaluation.id,
                    'metric_id': 1,  # Completeness metric ID
                    'severity': 'high' if completeness < 0.8 else 'medium',
                    'description': f"Dataset completeness ({completeness:.2%}) is below threshold ({completeness_threshold:.2%})",
                    'affected_columns': problem_columns
                })
            
            # Calculate uniqueness (percentage of unique rows)
            uniqueness = len(df.drop_duplicates()) / len(df) if len(df) > 0 else 1
            results['uniqueness'] = uniqueness
            
            # Check uniqueness threshold
            uniqueness_threshold = 1.0
            for metric_config in evaluation.metrics_config:
                if metric_config.get('name') == 'uniqueness':
                    uniqueness_threshold = metric_config.get('parameters', {}).get('threshold', 1.0)
            
            if uniqueness < uniqueness_threshold:
                # Find duplicate rows
                duplicates = df[df.duplicated(keep='first')]
                duplicate_count = len(duplicates)
                
                # Create issue
                issues.append({
                    'evaluation_id': evaluation.id,
                    'metric_id': 2,  # Uniqueness metric ID
                    'severity': 'high' if uniqueness < 0.9 else 'medium',
                    'description': f"Dataset contains {duplicate_count} duplicate rows ({(1-uniqueness):.2%} of total)",
                    'affected_rows': {
                        'count': duplicate_count,
                        'sample': duplicates.head(5).to_dict(orient='records') if duplicate_count > 0 else []
                    }
                })
            
            # Calculate column-level metrics
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
                    
                    # Check for outliers
                    if 'outliers' in [m.get('name') for m in evaluation.metrics_config]:
                        outliers = self._detect_outliers(df[column])
                        if outliers['count'] > 0:
                            issues.append({
                                'evaluation_id': evaluation.id,
                                'metric_id': 7,  # Outliers metric ID
                                'severity': 'medium',
                                'description': f"Column '{column}' contains {outliers['count']} outliers",
                                'affected_columns': [{'column': column, 'outlier_count': outliers['count']}]
                            })
            
            # Calculate overall quality score
            quality_score = (completeness + uniqueness) / 2
            
            # Update evaluation with results
            evaluation.results = {
                'overall': {
                    'completeness': completeness,
                    'uniqueness': uniqueness,
                    'quality_score': quality_score
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
                    metric_id=issue_data['metric_id'],
                    severity=issue_data['severity'],
                    description=issue_data['description'],
                    affected_columns=issue_data.get('affected_columns'),
                    affected_rows=issue_data.get('affected_rows')
                )
                db.session.add(issue)
            
            db.session.commit()
        
        except Exception as e:
            # Update evaluation status to failed
            evaluation.status = 'failed'
            evaluation.completed_at = datetime.utcnow()
            db.session.commit()
            
            # Re-raise exception
            raise Exception(f"Error running evaluation: {str(e)}")
    
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
