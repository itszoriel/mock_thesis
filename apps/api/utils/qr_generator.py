"""QR code generation utilities for document validation."""
import qrcode
import json
import os
from datetime import datetime
from flask import current_app
from io import BytesIO
import base64


def generate_qr_code_data(document_request):
    """
    Generate simple verification URL for QR code.
    
    Returns a simple URL string that can be scanned and opened directly.
    Format: http://localhost:5000/verify/REQ-2024-001
    """
    def _first(*candidates):
        for candidate in candidates:
            if candidate and str(candidate).strip():
                return str(candidate).strip()
        return None

    cfg = current_app.config if current_app else {}
    base_url = _first(
        os.getenv('QR_BASE_URL'),
        cfg.get('QR_BASE_URL') if cfg else None,
        os.getenv('VERIFICATION_BASE_URL'),
        os.getenv('WEB_BASE_URL'),
        cfg.get('WEB_BASE_URL') if cfg else None,
        'https://munlink-web.onrender.com/verify',
    )

    base_url = base_url.rstrip('/')
    if not base_url.lower().endswith('/verify'):
        base_url = f"{base_url}/verify"

    # Return simple URL string, not JSON object
    return f"{base_url}/{document_request.request_number}"


def generate_qr_code_image(qr_data, size=300):
    """
    Generate QR code image from data.
    
    Args:
        qr_data: String URL to encode
        size: Size of QR code in pixels
    
    Returns:
        Base64 encoded PNG image
    """
    # qr_data is now a simple string URL
    qr_string = str(qr_data)
    
    # Create QR code instance
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    
    qr.add_data(qr_string)
    qr.make(fit=True)
    
    # Create image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Resize to specified size
    img = img.resize((size, size))
    
    # Convert to base64
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"


def save_qr_code_file(qr_data, file_path):
    """
    Save QR code as PNG file.
    
    Args:
        qr_data: String URL to encode (simple verification URL)
        file_path: Path where to save the file
    """
    # qr_data is now a simple string URL
    qr_string = str(qr_data)
    
    # Create QR code instance
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    
    qr.add_data(qr_string)
    qr.make(fit=True)
    
    # Create image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    # Save image
    img.save(file_path)
    
    return file_path


def validate_qr_data(qr_string):
    """
    Validate and parse QR code data.
    
    Returns:
        Parsed QR data dictionary or None if invalid
    """
    try:
        qr_data = json.loads(qr_string)
        
        # Check required fields
        required_fields = ['request_number', 'document_type', 'issued_to', 'municipality']
        
        for field in required_fields:
            if field not in qr_data:
                return None
        
        return qr_data
    
    except (json.JSONDecodeError, TypeError):
        return None

