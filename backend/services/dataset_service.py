import pandas as pd
import numpy as np
import io
import json
import os
import csv
import gzip
import logging
from tempfile import NamedTemporaryFile
from werkzeug.datastructures import FileStorage

from services.minio_service import MinioService

# Magic bytes for file format detection
XLSX_MAGIC = b'PK\x03\x04'
GZIP_MAGIC = b'\x1f\x8b'

# Configure logger
logger = logging.getLogger(__name__)

class DatasetService:
    """Service for processing and analyzing datasets"""
    
    def __init__(self):
        """Initialize dataset service"""
        self.minio_service = MinioService()
    
    def _read_csv_robust(self, raw_bytes):
        """Read CSV data with robust handling of delimiters, encodings and file formats
        
        Args:
            raw_bytes: Raw bytes of the CSV file
            
        Returns:
            pandas.DataFrame: Parsed DataFrame
        """
        # Log the size of the input for debugging
        logger.debug(f"CSV parsing input bytes: {len(raw_bytes)}")
        if len(raw_bytes) == 0:
            raise Exception("El archivo en almacenamiento está vacío (0 bytes).")
            
        # Log the first bytes for debugging
        logger.debug(f"CSV first bytes: {repr(raw_bytes[:200])}")
        
        # 0) Detect incorrect formats
        if raw_bytes.startswith(XLSX_MAGIC):
            raise Exception("El archivo parece ser un Excel (.xlsx). Sube un CSV, no un XLSX.")
        if raw_bytes.startswith(GZIP_MAGIC):
            try:
                logger.debug("Detected GZIP format, attempting to decompress")
                raw_bytes = gzip.decompress(raw_bytes)
                logger.debug(f"Decompressed size: {len(raw_bytes)}")
            except Exception as e:
                raise Exception(f"El archivo parece estar comprimido (gzip) pero no se pudo descomprimir: {e}")
        
        # 1) Try to detect delimiter with CSV Sniffer using UTF-8 encoding
        sep_detected = None
        try:
            head = raw_bytes[:8192].decode('utf-8', errors='ignore')
            dialect = csv.Sniffer().sniff(head, delimiters=[',', ';', '\t', '|'])
            sep_detected = dialect.delimiter
            logger.debug(f"Detected separator: '{sep_detected}'")
        except Exception as e:
            logger.debug(f"Delimiter detection failed: {e}, will use inference")
            sep_detected = None  # Let pandas infer the separator
        
        # 2) Matrix of attempts: encodings x separators x engines
        encodings = ('utf-8', 'utf-8-sig', 'cp1252', 'latin-1')
        seps = [sep_detected, None, ',', ';', '\t', '|']  # None => inference
        engines = ('python', 'c')
        
        last_err = None
        for enc in encodings:
            for sep in seps:
                for eng in engines:
                    try:
                        logger.debug(f"Trying: encoding={enc}, sep={sep}, engine={eng}")
                        df = pd.read_csv(io.BytesIO(raw_bytes),
                                        sep=sep,
                                        encoding=enc,
                                        engine=eng,
                                        skip_blank_lines=True)
                        
                        # If no columns detected, try with header=None (first row as headers)
                        if df.shape[1] == 0:
                            logger.debug("No columns detected, trying with header=None")
                            df2 = pd.read_csv(io.BytesIO(raw_bytes),
                                            sep=sep,
                                            encoding=enc,
                                            engine=eng,
                                            header=None,
                                            skip_blank_lines=True)
                            if df2.shape[0] > 0:
                                df2.columns = df2.iloc[0].astype(str)
                                df = df2.iloc[1:].reset_index(drop=True)
                                logger.debug(f"Used first row as headers, now columns: {list(df.columns)}")
                        
                        # If still no columns, force error to try next combination
                        if df.shape[1] == 0:
                            raise ValueError("Sin columnas detectadas con esta combinación.")
                        
                        logger.debug(f"Successfully parsed CSV: {df.shape[0]} rows, {df.shape[1]} columns")
                        return df
                    except Exception as e:
                        last_err = e
                        continue
        
        # 3) If we get here, parsing failed with all combinations
        raise Exception(f"Failed to parse CSV tras múltiples intentos: {last_err}")
    
    def process_dataset(self, file_obj: FileStorage, project_id):
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
        
        # Read dataset with robust CSV parsing
        try:
            # Read the raw bytes from the temporary file
            with open(temp_file_path, 'rb') as f:
                raw = f.read()
            
            logger.debug(f"Processing dataset: file size = {len(raw)} bytes")
            
            # Parse the CSV with robust handling
            df = self._read_csv_robust(raw)
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
        
        # Add metadata about detected separator
        schema_meta = {
            "detected_separator": getattr(self, "_last_separator", "inferred")
        }
        
        # Get correct file size from the temporary file
        file_size = os.path.getsize(temp_file_path)
        
        # Upload raw bytes to MinIO instead of using the stream
        # This ensures we're uploading exactly what we successfully parsed
        try:
            # Check if MinioService has upload_bytes method
            if hasattr(self.minio_service, 'upload_bytes'):
                file_path = self.minio_service.upload_bytes(raw, 'text/csv')
            else:
                # Fallback to the original method if upload_bytes is not available
                file_obj.stream.seek(0)
                file_path = self.minio_service.upload_file(file_obj, 'text/csv')
        except Exception as e:
            raise Exception(f"Error uploading file to storage: {str(e)}")
        
        return {
            'file_path': file_path,
            'file_size': int(file_size),
            'row_count': int(row_count),
            'column_count': int(column_count),
            'schema': schema,
            'schema_meta': schema_meta
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
        
        # Check if file is empty
        if not file_data or len(file_data) == 0:
            raise Exception("El archivo en almacenamiento está vacío (0 bytes).")
        
        # Log the first bytes for debugging
        logger.debug(f"Preview first bytes: {repr(file_data[:200])}")
        
        # Read dataset with robust CSV parsing
        try:
            df = self._read_csv_robust(file_data)
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
        
        # Read dataset with robust CSV parsing
        try:
            df = self._read_csv_robust(file_data)
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
        
    def get_dataset_columns(self, file_path):
        """Get column names from a dataset
        
        Args:
            file_path: Path to the dataset file
            
        Returns:
            list: Column names
        """
        # Download file from MinIO
        file_data = self.minio_service.download_file(file_path)
        
        # Read dataset with robust CSV parsing
        try:
            df = self._read_csv_robust(file_data)
            return list(df.columns)
        except Exception as e:
            raise Exception(f"Error reading CSV file: {str(e)}")

