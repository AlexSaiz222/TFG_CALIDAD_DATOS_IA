import pandas as pd
import numpy as np
import io
import json
from tempfile import NamedTemporaryFile

from services.minio_service import MinioService

class DatasetService:
    """Service for processing and analyzing datasets"""
    
    def __init__(self):
        """Initialize dataset service"""
        self.minio_service = MinioService()
    
    def process_dataset(self, file_obj, project_id):
        """Process a dataset file and extract metadata
        
        Args:
            file_obj: File object to process
            project_id: ID of the project
            
        Returns:
            dict: Dataset metadata
        """
        # Save file to temporary location
        with NamedTemporaryFile(delete=False) as temp_file:
            file_obj.save(temp_file.name)
            temp_file_path = temp_file.name
        
        # Read dataset with pandas
        try:
            df = pd.read_csv(temp_file_path)
        except Exception as e:
            raise Exception(f"Error reading CSV file: {str(e)}")
        
        # Extract metadata
        row_count = len(df)
        column_count = len(df.columns)
        
        # Generate schema
        schema = []
        for column in df.columns:
            column_info = {
                'name': column,
                'type': str(df[column].dtype),
                'unique_count': int(df[column].nunique()),
                'missing_count': int(df[column].isna().sum()),
                'missing_percentage': float(round(df[column].isna().mean() * 100, 2))
            }
            
            # Add statistics based on data type
            if pd.api.types.is_numeric_dtype(df[column]):
                column_info.update({
                    'min': float(df[column].min()) if not pd.isna(df[column].min()) else None,
                    'max': float(df[column].max()) if not pd.isna(df[column].max()) else None,
                    'mean': float(df[column].mean()) if not pd.isna(df[column].mean()) else None,
                    'median': float(df[column].median()) if not pd.isna(df[column].median()) else None,
                    'std': float(df[column].std()) if not pd.isna(df[column].std()) else None
                })
            elif pd.api.types.is_string_dtype(df[column]):
                # Get most common values
                value_counts = df[column].value_counts().head(5).to_dict()
                column_info['most_common'] = [{'value': str(k), 'count': int(v)} for k, v in value_counts.items()]
            
            schema.append(column_info)
        
        # Upload file to MinIO
        file_obj.seek(0)
        file_path = self.minio_service.upload_file(file_obj, 'text/csv')
        
        return {
            'file_path': file_path,
            'file_size': int(file_obj.tell()),
            'row_count': int(row_count),
            'column_count': int(column_count),
            'schema': schema
        }
    
    def get_dataset_preview(self, file_path, rows=100):
        """Get a preview of the dataset
        
        Args:
            file_path: Path to the dataset file
            rows: Number of rows to preview
            
        Returns:
            list: Preview data as list of dictionaries
        """
        # Download file from MinIO
        file_data = self.minio_service.download_file(file_path)
        
        # Read dataset with pandas
        try:
            df = pd.read_csv(io.BytesIO(file_data))
        except Exception as e:
            raise Exception(f"Error reading CSV file: {str(e)}")
        
        # Get preview data
        preview_df = df.head(rows)
        
        # Convert to list of dictionaries
        preview_data = preview_df.replace({np.nan: None}).to_dict(orient='records')
        
        return preview_data
    
    def analyze_dataset(self, file_path):
        """Analyze a dataset and generate quality metrics
        
        Args:
            file_path: Path to the dataset file
            
        Returns:
            dict: Analysis results
        """
        # Download file from MinIO
        file_data = self.minio_service.download_file(file_path)
        
        # Read dataset with pandas
        try:
            df = pd.read_csv(io.BytesIO(file_data))
        except Exception as e:
            raise Exception(f"Error reading CSV file: {str(e)}")
        
        # Calculate completeness (percentage of non-null values)
        completeness = 1 - df.isna().mean().mean()
        
        # Calculate uniqueness (percentage of unique rows)
        uniqueness = len(df.drop_duplicates()) / len(df) if len(df) > 0 else 1
        
        # Calculate consistency (placeholder for demo)
        consistency = 0.95
        
        # Calculate overall quality score
        quality_score = (completeness + uniqueness + consistency) / 3
        
        # Generate column-level metrics
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
        
        return {
            'quality_score': quality_score,
            'completeness': completeness,
            'uniqueness': uniqueness,
            'consistency': consistency,
            'column_metrics': column_metrics
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
