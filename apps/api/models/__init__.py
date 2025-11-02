"""
MunLink Zambales - Database Models
Import all models here for Flask-Migrate to detect them
"""
try:
    from apps.api import db
except ImportError:
    from __init__ import db

# Base model will be imported by other models
Base = db.Model

# Import all models to register them with SQLAlchemy
try:
    from apps.api.models.user import User
    from apps.api.models.municipality import Municipality, Barangay
    from apps.api.models.marketplace import Item, Transaction, Message
    from apps.api.models.document import DocumentType, DocumentRequest
    from apps.api.models.issue import IssueCategory, Issue, IssueUpdate
    from apps.api.models.benefit import BenefitProgram, BenefitApplication
    from apps.api.models.token_blacklist import TokenBlacklist
    from apps.api.models.password_reset import PasswordResetToken
    from apps.api.models.audit import AuditLog
except ImportError:
    from .user import User
    from .municipality import Municipality, Barangay
    from .marketplace import Item, Transaction, Message
    from .document import DocumentType, DocumentRequest
    from .issue import IssueCategory, Issue, IssueUpdate
    from .benefit import BenefitProgram, BenefitApplication
    from .token_blacklist import TokenBlacklist
    from .password_reset import PasswordResetToken
    from .audit import AuditLog

__all__ = [
    'User',
    'Municipality',
    'Barangay',
    'Item',
    'Transaction',
    'Message',
    'DocumentType',
    'DocumentRequest',
    'IssueCategory',
    'Issue',
    'IssueUpdate',
    'BenefitProgram',
    'BenefitApplication',
    'TokenBlacklist',
    'PasswordResetToken',
    'AuditLog',
]

