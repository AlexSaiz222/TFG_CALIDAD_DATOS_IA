import os
import io
from minio import Minio
from minio.error import S3Error
from flask import current_app
import uuid

class MinioService:
    """Service for interacting with MinIO (S3-compatible storage)"""
    
    def __init__(self):
        """Initialize MinIO client"""
        self.client = None
        self.bucket_name = None
    
    def _get_client(self):
        """Get or create MinIO client"""
        if self.client is None:
            self.client = Minio(
                endpoint=current_app.config['MINIO_ENDPOINT'],
                access_key=current_app.config['MINIO_ACCESS_KEY'],
                secret_key=current_app.config['MINIO_SECRET_KEY'],
                secure=current_app.config['MINIO_SECURE']
            )
            self.bucket_name = current_app.config['MINIO_BUCKET']
            
            # Ensure bucket exists
            if not self.client.bucket_exists(self.bucket_name):
                self.client.make_bucket(self.bucket_name)
        
        return self.client
    
    def upload_file(self, file_obj, content_type='application/octet-stream'):
        """Upload a file to MinIO storage
        
        Args:
            file_obj: File object to upload
            content_type: MIME type of the file
            
        Returns:
            str: Path to the uploaded file
        """
        client = self._get_client()
        
        # If content_length is not available, read to memory and delegate to upload_bytes
        if not getattr(file_obj, "content_length", None):
            # Rewind, read and upload as bytes
            file_obj.stream.seek(0)
            raw = file_obj.read()
            return self.upload_bytes(raw, content_type)
        
        # Generate unique filename
        file_extension = os.path.splitext(file_obj.filename)[1]
        object_name = f"{uuid.uuid4()}{file_extension}"
        
        try:
            # Ensure stream is at the beginning
            file_obj.stream.seek(0)
            
            # Upload file
            client.put_object(
                bucket_name=self.bucket_name,
                object_name=object_name,
                data=file_obj.stream,
                length=file_obj.content_length,
                content_type=content_type
            )
            
            return object_name
        
        except S3Error as e:
            raise Exception(f"Error uploading file to MinIO: {str(e)}")
    
    def download_file(self, object_name):
        """Download a file from MinIO storage
        
        Args:
            object_name: Name of the object to download
            
        Returns:
            bytes: File content
        """
        client = self._get_client()
        response = None
        
        try:
            # Download file
            response = client.get_object(
                bucket_name=self.bucket_name,
                object_name=object_name
            )
            
            # Read all bytes from the response stream
            data = response.read()
            return data
        
        except S3Error as e:
            raise Exception(f"Error downloading file from MinIO: {str(e)}")
        
        finally:
            if response is not None:
                try:
                    response.close()
                finally:
                    response.release_conn()
    
    def upload_bytes(self, data_bytes, content_type='application/octet-stream'):
        """Upload raw bytes to MinIO storage
        
        Args:
            data_bytes: Raw bytes to upload
            content_type: MIME type of the file
            
        Returns:
            str: Path to the uploaded file
        """
        client = self._get_client()
        
        # Generate unique filename
        object_name = f"{uuid.uuid4()}.csv"  # Assuming CSV for dataset service
        
        try:
            # Create BytesIO object from raw bytes
            data_stream = io.BytesIO(data_bytes)
            
            # Upload bytes
            client.put_object(
                bucket_name=self.bucket_name,
                object_name=object_name,
                data=data_stream,
                length=len(data_bytes),
                content_type=content_type
            )
            
            return object_name
        
        except S3Error as e:
            raise Exception(f"Error uploading bytes to MinIO: {str(e)}")
    
    def delete_file(self, object_name):
        """Delete a file from MinIO storage
        
        Args:
            object_name: Name of the object to delete
        """
        client = self._get_client()
        
        try:
            # Delete file
            client.remove_object(
                bucket_name=self.bucket_name,
                object_name=object_name
            )
        
        except S3Error as e:
            raise Exception(f"Error deleting file from MinIO: {str(e)}")
    
    def get_presigned_url(self, object_name, expires=3600):
        """Get a presigned URL for accessing a file
        
        Args:
            object_name: Name of the object
            expires: Expiration time in seconds
            
        Returns:
            str: Presigned URL
        """
        client = self._get_client()
        
        try:
            # Generate presigned URL
            url = client.presigned_get_object(
                bucket_name=self.bucket_name,
                object_name=object_name,
                expires=expires
            )
            
            return url
        
        except S3Error as e:
            raise Exception(f"Error generating presigned URL: {str(e)}")
