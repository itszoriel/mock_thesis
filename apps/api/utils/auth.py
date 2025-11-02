"""Authentication and authorization utilities."""
from functools import wraps
from typing import Optional

from flask import jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

from apps.api.models.token_blacklist import TokenBlacklist
from apps.api.models.user import User


def jwt_identity_as_int() -> Optional[int]:
    """Return the current JWT identity as an int when possible."""
    uid = get_jwt_identity()
    if uid is None:
        return None
    if isinstance(uid, int):
        return uid
    try:
        return int(uid)
    except (TypeError, ValueError):
        return None


def get_current_user():
    """Get the current authenticated user."""
    verify_jwt_in_request()
    user_id = jwt_identity_as_int()

    if not user_id:
        return None

    user = User.query.get(user_id)
    return user


def admin_required(fn):
    """Decorator to require admin role (accept legacy 'municipal_admin')."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user_id = jwt_identity_as_int()

        if not user_id:
            return jsonify({'error': 'Authentication required'}), 401

        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        if user.role not in ('admin', 'municipal_admin'):
            return jsonify({'error': 'Admin access required', 'code': 'ROLE_MISMATCH'}), 403

        return fn(*args, **kwargs)
    
    return wrapper


def verified_resident_required(fn):
    """Decorator to require verified resident (email verified at minimum)."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user_id = jwt_identity_as_int()

        if not user_id:
            return jsonify({'error': 'Authentication required'}), 401

        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Strict resident role requirement
        if user.role != 'resident':
            return jsonify({'error': 'Resident account required', 'code': 'ROLE_MISMATCH'}), 403
        
        if not user.email_verified:
            return jsonify({'error': 'Email verification required'}), 403
        
        return fn(*args, **kwargs)
    
    return wrapper


def fully_verified_required(fn):
    """Decorator to require fully verified resident (admin verified)."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user_id = jwt_identity_as_int()

        if not user_id:
            return jsonify({'error': 'Authentication required'}), 401

        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Must be a resident and fully verified
        if user.role != 'resident':
            return jsonify({'error': 'Resident account required', 'code': 'ROLE_MISMATCH'}), 403
        if not user.admin_verified:
            return jsonify({'error': 'Full verification required. Please submit ID documents for verification'}), 403
        
        return fn(*args, **kwargs)
    
    return wrapper


def adult_required(fn):
    """Decorator to require user to be 18 or older."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user_id = jwt_identity_as_int()

        if not user_id:
            return jsonify({'error': 'Authentication required'}), 401

        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        if user.is_under_18():
            return jsonify({'error': 'You must be 18 or older to access this feature'}), 403
        
        return fn(*args, **kwargs)
    
    return wrapper


def check_token_blacklist():
    """Check if the current token is blacklisted."""
    verify_jwt_in_request()
    jti = get_jwt()['jti']
    
    if TokenBlacklist.is_token_revoked(jti):
        return jsonify({'error': 'Token has been revoked'}), 401
    
    return None


def municipality_admin_required(municipality_id=None):
    """Decorator to require admin of a specific municipality (accept legacy 'municipal_admin')."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user_id = jwt_identity_as_int()

            if not user_id:
                return jsonify({'error': 'Authentication required'}), 401

            user = User.query.get(user_id)

            if not user:
                return jsonify({'error': 'User not found'}), 404

            if user.role not in ('admin', 'municipal_admin'):
                return jsonify({'error': 'Admin access required', 'code': 'ROLE_MISMATCH'}), 403
            
            # If specific municipality is required
            if municipality_id is not None:
                if user.admin_municipality_id != municipality_id:
                    return jsonify({'error': 'You do not have admin access to this municipality'}), 403
            
            return fn(*args, **kwargs)
        
        return wrapper
    
    return decorator


def roles_required(allowed_roles):
    """Generic role-based guard using JWT claims for fast checks."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt() or {}
            role = claims.get('role')
            if role not in allowed_roles:
                return jsonify({'error': 'Forbidden', 'code': 'ROLE_MISMATCH'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def check_user_access_level(user, required_level):
    """
    Check if user meets required access level.
    
    Access levels (lowest to highest):
    - public
    - resident_under_18
    - resident_unverified
    - resident_email_verified
    - resident_fully_verified
    - admin
    """
    access_hierarchy = {
        'public': 0,
        'resident_under_18': 1,
        'resident_unverified': 2,
        'resident_email_verified': 3,
        'resident_fully_verified': 4,
        'admin': 5,
    }
    
    user_level = user.get_access_level()
    
    user_level_value = access_hierarchy.get(user_level, 0)
    required_level_value = access_hierarchy.get(required_level, 0)
    
    return user_level_value >= required_level_value


def generate_verification_token(user_id, token_type='email'):
    """Generate a verification token for email or password reset."""
    from flask_jwt_extended import create_access_token
    from datetime import timedelta
    
    # Create a short-lived token (24 hours for email verification, 1 hour for password reset)
    expires_delta = timedelta(hours=24) if token_type == 'email' else timedelta(hours=1)
    
    additional_claims = {
        'type': token_type,
        'user_id': user_id,
    }
    
    token = create_access_token(
        identity=user_id,
        expires_delta=expires_delta,
        additional_claims=additional_claims
    )
    
    return token


def verify_token_type(token_type):
    """Verify that the JWT has the correct type."""
    jwt_data = get_jwt()
    
    if jwt_data.get('type') != token_type:
        return False
    
    return True

