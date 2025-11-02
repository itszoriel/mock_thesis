"""Utility functions for the API."""

try:
    from apps.api.utils.validators import (
        validate_email,
        validate_username,
        validate_password,
        validate_phone,
        validate_name,
        validate_date_of_birth,
        validate_municipality,
        validate_file_size,
        validate_file_extension,
        validate_required_fields,
        sanitize_string,
        validate_transaction_type,
        validate_item_condition,
        validate_price,
        ValidationError,
    )
except ImportError:
    from .validators import (
        validate_email,
        validate_username,
        validate_password,
        validate_phone,
        validate_name,
        validate_date_of_birth,
        validate_municipality,
        validate_file_size,
        validate_file_extension,
        validate_required_fields,
        sanitize_string,
        validate_transaction_type,
        validate_item_condition,
        validate_price,
        ValidationError,
    )

from apps.api.utils.auth import (
    jwt_identity_as_int,
    get_current_user,
    admin_required,
    verified_resident_required,
    fully_verified_required,
    adult_required,
    check_token_blacklist,
    municipality_admin_required,
    check_user_access_level,
    generate_verification_token,
    verify_token_type,
)

from apps.api.utils.file_handler import (
    save_uploaded_file,
    save_profile_picture,
    save_verification_document,
    save_marketplace_image,
    save_issue_attachment,
    save_benefit_document,
    save_document_request_file,
    delete_file,
    get_file_url,
    cleanup_user_files,
    cleanup_item_files,
    FileUploadError,
)

from apps.api.utils.qr_generator import (
    generate_qr_code_data,
    generate_qr_code_image,
    save_qr_code_file,
    validate_qr_data,
)

# Transaction audit helpers
try:
    from apps.api.utils.tx_audit import (
        log_tx_action,
        require_tx_role,
        assert_status,
        TransitionError,
    )
except ImportError:
    from .tx_audit import (
        log_tx_action,
        require_tx_role,
        assert_status,
        TransitionError,
    )

__all__ = [
    # Validators
    'validate_email',
    'validate_username',
    'validate_password',
    'validate_phone',
    'validate_name',
    'validate_date_of_birth',
    'validate_municipality',
    'validate_file_size',
    'validate_file_extension',
    'validate_required_fields',
    'sanitize_string',
    'validate_transaction_type',
    'validate_item_condition',
    'validate_price',
    'ValidationError',
    # Auth
    'jwt_identity_as_int',
    'get_current_user',
    'admin_required',
    'verified_resident_required',
    'fully_verified_required',
    'adult_required',
    'check_token_blacklist',
    'municipality_admin_required',
    'check_user_access_level',
    'generate_verification_token',
    'verify_token_type',
    # File Handler
    'save_uploaded_file',
    'save_profile_picture',
    'save_verification_document',
    'save_marketplace_image',
    'save_issue_attachment',
    'save_benefit_document',
    'save_document_request_file',
    'delete_file',
    'get_file_url',
    'cleanup_user_files',
    'cleanup_item_files',
    'FileUploadError',
    # QR Generator
    'generate_qr_code_data',
    'generate_qr_code_image',
    'save_qr_code_file',
    'validate_qr_data',
    # Tx audit
    'log_tx_action',
    'require_tx_role',
    'assert_status',
    'TransitionError',
]
