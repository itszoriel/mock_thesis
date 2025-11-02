"""Password reset token model."""
from datetime import datetime

try:
    from apps.api import db
    from apps.api.models.user import User
except ImportError:  # pragma: no cover
    from __init__ import db
    from models.user import User


class PasswordResetToken(db.Model):
    __tablename__ = 'password_reset_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    token_hash = db.Column(db.String(128), nullable=False, unique=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_ip = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)

    user = db.relationship('User', backref=db.backref('password_reset_tokens', lazy='dynamic'))

    def is_valid(self) -> bool:
        now = datetime.utcnow()
        return self.used_at is None and self.expires_at and self.expires_at >= now

    def mark_used(self) -> None:
        if self.used_at is None:
            self.used_at = datetime.utcnow()


