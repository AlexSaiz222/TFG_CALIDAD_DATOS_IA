import os
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
        
        # Generate unique filename
        file_extension = os.path.splitext(file_obj.filename)[1]
        object_name = f"{uuid.uuid4()}{file_extension}"
        
        try:
            # Upload file
            client.put_object(
                bucket_name=self.bucket_name,
                object_name=object_name,
                data=file_obj,
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
        
        try:
            # Download file
            response = client.get_object(
                bucket_name=self.bucket_name,
                object_name=object_name
            )
            
            return response.data
        
        except S3Error as e:
            raise Exception(f"Error downloading file from MinIO: {str(e)}")
        
        finally:
            if 'response' in locals():
                response.close()
                response.release_conn()
    
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
