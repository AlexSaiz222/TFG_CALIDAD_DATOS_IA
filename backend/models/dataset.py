from datetime import datetime
from extensions import db

class Dataset(db.Model):
    """Dataset model for storing dataset metadata"""
    __tablename__ = 'datasets'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.BigInteger)
    row_count = db.Column(db.Integer)
    column_count = db.Column(db.Integer)
    schema = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    evaluations = db.relationship('Evaluation', backref='dataset', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Dataset {self.name}>'
    
    def to_dict(self):
        """Convert dataset to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'project_id': self.project_id,
            'file_path': self.file_path,
            'file_size': self.file_size,
            'row_count': self.row_count,
            'column_count': self.column_count,
            'schema': self.schema,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'evaluation_count': len(self.evaluations)
        }
