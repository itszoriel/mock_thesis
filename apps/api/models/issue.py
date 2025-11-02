"""Issue reporting and tracking models."""
from datetime import datetime
try:
    from apps.api import db
except ImportError:
    from __init__ import db
from sqlalchemy import Index

class IssueCategory(db.Model):
    __tablename__ = 'issue_categories'
    
    # Primary Key
    id = db.Column(db.Integer, primary_key=True)
    
    # Basic Information
    name = db.Column(db.String(100), unique=True, nullable=False)
    slug = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    icon = db.Column(db.String(50), nullable=True)
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    issues = db.relationship('Issue', backref='category', lazy='dynamic')
    
    def __repr__(self):
        return f'<IssueCategory {self.name}>'
    
    def to_dict(self):
        """Convert issue category to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'description': self.description,
            'icon': self.icon,
            'is_active': self.is_active,
        }


class Issue(db.Model):
    __tablename__ = 'issues'
    
    # Primary Key
    id = db.Column(db.Integer, primary_key=True)
    
    # Issue Number (unique identifier for tracking)
    issue_number = db.Column(db.String(50), unique=True, nullable=False)
    
    # Reporter Information
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Issue Details
    category_id = db.Column(db.Integer, db.ForeignKey('issue_categories.id'), nullable=False)
    category_label = db.Column(db.String(120), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    
    # Location
    municipality_id = db.Column(db.Integer, db.ForeignKey('municipalities.id'), nullable=False)
    barangay_id = db.Column(db.Integer, db.ForeignKey('barangays.id'), nullable=True)
    specific_location = db.Column(db.String(200), nullable=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    
    # Evidence (photos/videos)
    attachments = db.Column(db.JSON, nullable=True)  # Array of file paths
    
    # Priority
    priority = db.Column(db.String(20), default='medium')  # low, medium, high, urgent
    
    # Status
    status = db.Column(db.String(20), default='submitted')  # submitted, under_review, in_progress, resolved, closed, rejected
    
    # Admin Response
    assigned_admin_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    admin_notes = db.Column(db.Text, nullable=True)
    admin_response = db.Column(db.Text, nullable=True)
    admin_response_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    admin_response_at = db.Column(db.DateTime, nullable=True)
    resolution_notes = db.Column(db.Text, nullable=True)
    status_updated_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    status_updated_at = db.Column(db.DateTime, nullable=True)
    
    # Visibility
    is_public = db.Column(db.Boolean, default=True)
    
    # Upvotes/Support
    upvote_count = db.Column(db.Integer, default=0)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    resolved_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    user = db.relationship('User', foreign_keys=[user_id], backref='reported_issues')
    assigned_admin = db.relationship('User', foreign_keys=[assigned_admin_id], backref='assigned_issues')
    municipality = db.relationship('Municipality', backref='issues')
    barangay = db.relationship('Barangay', backref='issues')
    updates = db.relationship('IssueUpdate', backref='issue', lazy='dynamic', cascade='all, delete-orphan')
    
    # Indexes
    __table_args__ = (
        Index('idx_issue_municipality', 'municipality_id'),
        Index('idx_issue_category', 'category_id'),
        Index('idx_issue_status', 'status'),
        Index('idx_issue_priority', 'priority'),
        Index('idx_issue_number', 'issue_number'),
    )
    
    def __repr__(self):
        return f'<Issue {self.issue_number} - {self.title}>'
    
    def to_dict(self, include_user=False, include_updates=False):
        """Convert issue to dictionary."""
        data = {
            'id': self.id,
            'issue_number': self.issue_number,
            'user_id': self.user_id,
            'category_id': self.category_id,
            'category_label': self.category_label,
            'title': self.title,
            'description': self.description,
            'municipality_id': self.municipality_id,
            'barangay_id': self.barangay_id,
            'specific_location': self.specific_location,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'attachments': self.attachments,
            'priority': self.priority,
            'status': self.status,
            'assigned_admin_id': self.assigned_admin_id,
            'admin_notes': self.admin_notes,
            'admin_response': self.admin_response,
            'admin_response_by': self.admin_response_by,
            'admin_response_at': self.admin_response_at.isoformat() if self.admin_response_at else None,
            'resolution_notes': self.resolution_notes,
            'status_updated_by': self.status_updated_by,
            'status_updated_at': self.status_updated_at.isoformat() if self.status_updated_at else None,
            'is_public': self.is_public,
            'upvote_count': self.upvote_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
        }
        
        if include_user and self.user:
            data['user'] = self.user.to_dict()
        
        if self.category:
            data['category'] = self.category.to_dict()
        
        if include_updates:
            data['updates'] = [u.to_dict() for u in self.updates.order_by(IssueUpdate.created_at.desc()).all()]
        
        return data


class IssueUpdate(db.Model):
    __tablename__ = 'issue_updates'
    
    # Primary Key
    id = db.Column(db.Integer, primary_key=True)
    
    # Related Issue
    issue_id = db.Column(db.Integer, db.ForeignKey('issues.id'), nullable=False)
    
    # Author (can be user or admin)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    author_type = db.Column(db.String(20), nullable=False)  # user, admin
    
    # Update Content
    content = db.Column(db.Text, nullable=False)
    
    # Attachments
    attachments = db.Column(db.JSON, nullable=True)
    
    # Status Change
    status_change = db.Column(db.String(50), nullable=True)  # e.g., "submitted -> under_review"
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    author = db.relationship('User', backref='issue_updates')
    
    def __repr__(self):
        return f'<IssueUpdate {self.id} for Issue {self.issue_id}>'
    
    def to_dict(self):
        """Convert issue update to dictionary."""
        return {
            'id': self.id,
            'issue_id': self.issue_id,
            'author_id': self.author_id,
            'author_type': self.author_type,
            'content': self.content,
            'attachments': self.attachments,
            'status_change': self.status_change,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

