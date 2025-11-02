"""Benefits program models."""
from datetime import datetime
try:
    from apps.api import db
except ImportError:
    from __init__ import db
from sqlalchemy import Index

class BenefitProgram(db.Model):
    __tablename__ = 'benefit_programs'
    
    # Primary Key
    id = db.Column(db.Integer, primary_key=True)
    
    # Basic Information
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=False)
    
    # Program Details
    program_type = db.Column(db.String(50), nullable=False)  # financial, educational, health, livelihood
    
    # Municipality (if municipality-specific)
    municipality_id = db.Column(db.Integer, db.ForeignKey('municipalities.id'), nullable=True)
    
    # Eligibility Criteria (stored as JSON)
    eligibility_criteria = db.Column(db.JSON, nullable=True)
    
    # Requirements
    required_documents = db.Column(db.JSON, nullable=True)  # List of required documents
    
    # Application Period
    application_start = db.Column(db.DateTime, nullable=True)
    application_end = db.Column(db.DateTime, nullable=True)
    
    # Benefit Amount/Details
    benefit_amount = db.Column(db.Numeric(10, 2), nullable=True)
    benefit_description = db.Column(db.Text, nullable=True)
    
    # Capacity
    max_beneficiaries = db.Column(db.Integer, nullable=True)
    current_beneficiaries = db.Column(db.Integer, default=0)
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    is_accepting_applications = db.Column(db.Boolean, default=True)
    # Duration/Completion
    duration_days = db.Column(db.Integer, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    municipality = db.relationship('Municipality', backref='benefit_programs')
    applications = db.relationship('BenefitApplication', backref='program', lazy='dynamic')
    
    def __repr__(self):
        return f'<BenefitProgram {self.name}>'
    
    def to_dict(self):
        """Convert benefit program to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'description': self.description,
            'program_type': self.program_type,
            'municipality_id': self.municipality_id,
            'eligibility_criteria': self.eligibility_criteria,
            'required_documents': self.required_documents,
            'application_start': self.application_start.isoformat() if self.application_start else None,
            'application_end': self.application_end.isoformat() if self.application_end else None,
            'benefit_amount': float(self.benefit_amount) if self.benefit_amount else None,
            'benefit_description': self.benefit_description,
            'max_beneficiaries': self.max_beneficiaries,
            'current_beneficiaries': self.current_beneficiaries,
            'is_active': self.is_active,
            'is_accepting_applications': self.is_accepting_applications,
            'duration_days': self.duration_days,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'status': 'active' if self.is_active else 'completed',
        }


class BenefitApplication(db.Model):
    __tablename__ = 'benefit_applications'
    
    # Primary Key
    id = db.Column(db.Integer, primary_key=True)
    
    # Application Number
    application_number = db.Column(db.String(50), unique=True, nullable=False)
    
    # Applicant Information
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Program
    program_id = db.Column(db.Integer, db.ForeignKey('benefit_programs.id'), nullable=False)
    
    # Application Data (responses to eligibility questions)
    application_data = db.Column(db.JSON, nullable=True)
    
    # Supporting Documents
    supporting_documents = db.Column(db.JSON, nullable=True)  # Array of file paths
    
    # Status
    status = db.Column(db.String(20), default='pending')  # pending, under_review, approved, rejected, cancelled
    
    # Admin Review
    reviewed_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    admin_notes = db.Column(db.Text, nullable=True)
    rejection_reason = db.Column(db.Text, nullable=True)
    
    # Disbursement (if approved)
    disbursement_status = db.Column(db.String(20), nullable=True)  # pending, processing, completed
    disbursement_date = db.Column(db.DateTime, nullable=True)
    disbursement_amount = db.Column(db.Numeric(10, 2), nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    user = db.relationship('User', foreign_keys=[user_id], backref='benefit_applications')
    reviewed_by = db.relationship('User', foreign_keys=[reviewed_by_id], backref='reviewed_applications')
    
    # Indexes
    __table_args__ = (
        Index('idx_benefit_app_user', 'user_id'),
        Index('idx_benefit_app_program', 'program_id'),
        Index('idx_benefit_app_status', 'status'),
        Index('idx_benefit_app_number', 'application_number'),
    )
    
    def __repr__(self):
        return f'<BenefitApplication {self.application_number}>'
    
    def to_dict(self, include_user=False):
        """Convert benefit application to dictionary."""
        data = {
            'id': self.id,
            'application_number': self.application_number,
            'user_id': self.user_id,
            'program_id': self.program_id,
            'application_data': self.application_data,
            'supporting_documents': self.supporting_documents,
            'status': self.status,
            'reviewed_by_id': self.reviewed_by_id,
            'admin_notes': self.admin_notes,
            'rejection_reason': self.rejection_reason,
            'disbursement_status': self.disbursement_status,
            'disbursement_date': self.disbursement_date.isoformat() if self.disbursement_date else None,
            'disbursement_amount': float(self.disbursement_amount) if self.disbursement_amount else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }
        
        if include_user and self.user:
            data['user'] = self.user.to_dict()
        
        if self.program:
            data['program'] = self.program.to_dict()
        
        return data

