"""Document request and management models."""
from datetime import datetime
try:
    from apps.api import db
except ImportError:
    from __init__ import db
from sqlalchemy import Index

class DocumentType(db.Model):
    __tablename__ = 'document_types'
    
    # Primary Key
    id = db.Column(db.Integer, primary_key=True)
    
    # Basic Information
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(20), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    
    # Issuing Authority
    authority_level = db.Column(db.String(20), nullable=False)  # municipal, barangay
    
    # Requirements
    requirements = db.Column(db.JSON, nullable=True)  # List of required fields/documents
    
    # Pricing
    fee = db.Column(db.Numeric(10, 2), default=0.00)
    
    # Processing Time
    processing_days = db.Column(db.Integer, default=3)
    
    # Delivery Options
    supports_physical = db.Column(db.Boolean, default=True)
    supports_digital = db.Column(db.Boolean, default=True)
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    requests = db.relationship('DocumentRequest', backref='document_type', lazy='dynamic')
    
    def __repr__(self):
        return f'<DocumentType {self.name}>'
    
    def to_dict(self):
        """Convert document type to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'authority_level': self.authority_level,
            'requirements': self.requirements,
            'fee': float(self.fee) if self.fee else 0.00,
            'processing_days': self.processing_days,
            'supports_physical': self.supports_physical,
            'supports_digital': self.supports_digital,
            'is_active': self.is_active,
        }


class DocumentRequest(db.Model):
    __tablename__ = 'document_requests'
    
    # Primary Key
    id = db.Column(db.Integer, primary_key=True)
    
    # Request Number (unique identifier for tracking)
    request_number = db.Column(db.String(50), unique=True, nullable=False)
    
    # Requester Information
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Document Information
    document_type_id = db.Column(db.Integer, db.ForeignKey('document_types.id'), nullable=False)
    
    # Location
    municipality_id = db.Column(db.Integer, db.ForeignKey('municipalities.id'), nullable=False)
    barangay_id = db.Column(db.Integer, db.ForeignKey('barangays.id'), nullable=True)
    
    # Delivery Method
    delivery_method = db.Column(db.String(20), nullable=False)  # physical, digital
    delivery_address = db.Column(db.String(200), nullable=True)  # for physical delivery
    
    # Request Details
    purpose = db.Column(db.String(200), nullable=False)
    additional_notes = db.Column(db.Text, nullable=True)
    
    # Supporting Documents (JSON array of file paths)
    supporting_documents = db.Column(db.JSON, nullable=True)
    
    # Status
    status = db.Column(db.String(20), default='pending')  # pending, processing, ready, completed, rejected, cancelled
    
    # Admin Notes
    admin_notes = db.Column(db.Text, nullable=True)
    rejection_reason = db.Column(db.Text, nullable=True)
    
    # QR Code for validation
    qr_code = db.Column(db.String(255), nullable=True)
    qr_data = db.Column(db.JSON, nullable=True)
    
    # Generated Document
    document_file = db.Column(db.String(255), nullable=True)
    
    # Audit trail (stored as JSON/TEXT for SQLite compatibility)
    resident_input = db.Column(db.JSON, nullable=True)
    admin_edited_content = db.Column(db.JSON, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    approved_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    ready_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    user = db.relationship('User', backref='document_requests')
    municipality = db.relationship('Municipality', backref='document_requests')
    barangay = db.relationship('Barangay', backref='document_requests')
    
    # Indexes
    __table_args__ = (
        Index('idx_doc_request_user', 'user_id'),
        Index('idx_doc_request_municipality', 'municipality_id'),
        Index('idx_doc_request_status', 'status'),
        Index('idx_doc_request_number', 'request_number'),
    )
    
    def __repr__(self):
        return f'<DocumentRequest {self.request_number}>'
    
    def to_dict(self, include_user=False, include_audit=False):
        """Convert document request to dictionary."""
        data = {
            'id': self.id,
            'request_number': self.request_number,
            'user_id': self.user_id,
            'document_type_id': self.document_type_id,
            'municipality_id': self.municipality_id,
            'barangay_id': self.barangay_id,
            'delivery_method': self.delivery_method,
            'delivery_address': self.delivery_address,
            'purpose': self.purpose,
            'additional_notes': self.additional_notes,
            'supporting_documents': self.supporting_documents,
            'status': self.status,
            'admin_notes': self.admin_notes,
            'rejection_reason': self.rejection_reason,
            'qr_code': self.qr_code,
            'document_file': self.document_file,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'ready_at': self.ready_at.isoformat() if self.ready_at else None,
        }
        
        # Surface civil status / age hints if stored in resident_input/admin edits
        civil_status = None
        age_value = None
        try:
            if isinstance(self.admin_edited_content, dict):
                civil_status = self.admin_edited_content.get('civil_status', civil_status)
                age_value = self.admin_edited_content.get('age', age_value)
        except Exception:
            pass
        try:
            if civil_status is None and isinstance(self.resident_input, dict):
                civil_status = self.resident_input.get('civil_status', civil_status)
            if age_value is None and isinstance(self.resident_input, dict):
                age_value = self.resident_input.get('age', age_value)
        except Exception:
            pass
        if civil_status is not None:
            data['civil_status'] = civil_status
        if age_value is not None:
            data['age'] = age_value

        if include_user and self.user:
            data['user'] = self.user.to_dict()
        
        if self.document_type:
            data['document_type'] = self.document_type.to_dict()
        
        if include_audit:
            # Ensure JSON-serializable fallback
            try:
                data['resident_input'] = self.resident_input
            except Exception:
                data['resident_input'] = None
            try:
                data['admin_edited_content'] = self.admin_edited_content
            except Exception:
                data['admin_edited_content'] = None
        
        return data

