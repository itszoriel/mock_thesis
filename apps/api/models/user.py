"""User model for authentication and profile management."""
from datetime import datetime
try:
    from apps.api import db
except ImportError:
    from __init__ import db
from sqlalchemy import Index

class User(db.Model):
    __tablename__ = 'users'
    
    # Primary Key
    id = db.Column(db.Integer, primary_key=True)
    
    # Authentication
    username = db.Column(db.String(30), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    
    # Profile Information
    first_name = db.Column(db.String(50), nullable=False)
    middle_name = db.Column(db.String(50), nullable=True)
    last_name = db.Column(db.String(50), nullable=False)
    suffix = db.Column(db.String(10), nullable=True)
    
    # Location (required for residents)
    municipality_id = db.Column(db.Integer, db.ForeignKey('municipalities.id'), nullable=True)
    barangay_id = db.Column(db.Integer, db.ForeignKey('barangays.id'), nullable=True)
    street_address = db.Column(db.String(200), nullable=True)
    
    # Contact
    phone_number = db.Column(db.String(15), nullable=True)
    
    # Birth Information
    date_of_birth = db.Column(db.Date, nullable=True)
    place_of_birth = db.Column(db.String(100), nullable=True)
    
    # Role and Verification Status
    role = db.Column(db.String(20), default='resident')  # public, resident, municipal_admin
    email_verified = db.Column(db.Boolean, default=False)
    admin_verified = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    verification_status = db.Column(db.String(30), nullable=False, default='pending')
    verification_notes = db.Column(db.Text, nullable=True)
    
    # Profile Picture
    profile_picture = db.Column(db.String(255), nullable=True)
    
    # Verification Documents (stored paths)
    valid_id_front = db.Column(db.String(255), nullable=True)
    valid_id_back = db.Column(db.String(255), nullable=True)
    proof_of_residency = db.Column(db.String(255), nullable=True)
    selfie_with_id = db.Column(db.String(255), nullable=True)
    
    # Admin-specific fields
    admin_municipality_id = db.Column(db.Integer, db.ForeignKey('municipalities.id'), nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    email_verified_at = db.Column(db.DateTime, nullable=True)
    admin_verified_at = db.Column(db.DateTime, nullable=True)
    last_login = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    municipality = db.relationship('Municipality', foreign_keys=[municipality_id], backref='residents')
    barangay = db.relationship('Barangay', foreign_keys=[barangay_id], backref='residents')
    admin_municipality = db.relationship('Municipality', foreign_keys=[admin_municipality_id], backref='admins')
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_user_email', 'email'),
        Index('idx_user_username', 'username'),
        Index('idx_user_municipality', 'municipality_id'),
        Index('idx_user_role', 'role'),
    )
    
    def __repr__(self):
        return f'<User {self.username}>'
    
    def to_dict(self, include_sensitive=False, include_municipality=False):
        """Convert user to dictionary."""
        data = {
            'id': self.id,
            'username': self.username,
            'email': self.email if include_sensitive else None,
            'first_name': self.first_name,
            'middle_name': self.middle_name,
            'last_name': self.last_name,
            'suffix': self.suffix,
            'municipality_id': self.municipality_id,
            'barangay_id': self.barangay_id,
            'phone_number': self.phone_number if include_sensitive else None,
            'role': self.role,
            'email_verified': self.email_verified,
            'admin_verified': self.admin_verified,
            'is_active': self.is_active,
            'verification_status': self.verification_status,
            'verification_notes': self.verification_notes if include_sensitive else None,
            'profile_picture': self.profile_picture,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
        }
        # Include verification files for privileged contexts
        if include_sensitive:
            if self.valid_id_front is not None:
                data['valid_id_front'] = self.valid_id_front
            if self.valid_id_back is not None:
                data['valid_id_back'] = self.valid_id_back
            if self.selfie_with_id is not None:
                data['selfie_with_id'] = self.selfie_with_id
            if self.proof_of_residency is not None:
                data['proof_of_residency'] = self.proof_of_residency
        
        # Add municipality data if requested
        if include_municipality and self.municipality:
            data['municipality_name'] = self.municipality.name
            data['municipality_slug'] = self.municipality.slug
        if include_municipality and self.barangay:
            data['barangay_name'] = self.barangay.name
            data['barangay_slug'] = self.barangay.slug
        
        # Add admin municipality data if user is admin
        if include_municipality and self.admin_municipality:
            data['admin_municipality_name'] = self.admin_municipality.name
            data['admin_municipality_slug'] = self.admin_municipality.slug
        
        return {k: v for k, v in data.items() if v is not None or include_sensitive}
    
    def is_under_18(self):
        """Check if user is under 18 years old."""
        if not self.date_of_birth:
            return True  # Default to restricted if DOB not provided
        
        today = datetime.utcnow().date()
        age = today.year - self.date_of_birth.year
        if (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day):
            age -= 1
        return age < 18
    
    def get_access_level(self):
        """Get user's access level based on verification status."""
        if self.role == 'municipal_admin':
            return 'admin'
        elif self.role == 'public':
            return 'public'
        elif self.is_under_18():
            return 'resident_under_18'
        status = (self.verification_status or '').lower()
        if status == 'needs_revision':
            return 'resident_needs_revision'
        if self.email_verified and not self.admin_verified:
            return 'resident_email_verified'
        if self.admin_verified:
            return 'resident_fully_verified'
        else:
            return 'resident_unverified'

