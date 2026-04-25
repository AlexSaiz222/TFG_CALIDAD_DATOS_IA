from datetime import datetime
from extensions import db


class ValidationPattern(db.Model):
    """User-scoped (or system-built-in) regex validation pattern for syntactic accuracy."""
    __tablename__ = 'validation_patterns'

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    regex = db.Column(db.Text, nullable=False)
    examples_valid = db.Column(db.JSON, default=list)
    examples_invalid = db.Column(db.JSON, default=list)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # NULL = built-in
    is_system = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('owner_id', 'key', name='uq_validation_pattern_owner_key'),
    )

    def __repr__(self):
        return f'<ValidationPattern {self.key} owner={self.owner_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'key': self.key,
            'name': self.name,
            'description': self.description,
            'regex': self.regex,
            'examples_valid': self.examples_valid or [],
            'examples_invalid': self.examples_invalid or [],
            'owner_id': self.owner_id,
            'is_system': self.is_system if self.is_system is not None else False,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }
