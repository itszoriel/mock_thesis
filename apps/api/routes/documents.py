"""Document types and requests routes."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

try:
    from apps.api import db
    from apps.api.models.document import DocumentType, DocumentRequest
    from apps.api.models.user import User
    from apps.api.models.municipality import Municipality
    from apps.api.utils import (
        validate_required_fields,
        ValidationError,
        save_document_request_file,
        fully_verified_required,
        jwt_identity_as_int,
    )
except ImportError:
    from __init__ import db
    from models.document import DocumentType, DocumentRequest
    from models.user import User
    from models.municipality import Municipality
    from utils import (
        validate_required_fields,
        ValidationError,
        save_document_request_file,
        fully_verified_required,
        jwt_identity_as_int,
    )


documents_bp = Blueprint('documents', __name__, url_prefix='/api/documents')


@documents_bp.route('/types', methods=['GET'])
def list_document_types():
    """Public list of active document types."""
    try:
        types = DocumentType.query.filter_by(is_active=True).all()
        return jsonify({
            'types': [t.to_dict() for t in types],
            'count': len(types)
        }), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get document types', 'details': str(e)}), 500


@documents_bp.route('/requests', methods=['POST'])
@jwt_required()
@fully_verified_required
def create_document_request():
    """Create a new document request for the current user."""
    try:
        user_id = jwt_identity_as_int()
        if user_id is None:
            return jsonify({'error': 'Invalid session', 'details': 'Please log in again.'}), 401

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        is_multipart = (request.content_type or '').lower().startswith('multipart/form-data')
        if is_multipart:
            form = request.form or {}
            data = {key: form.get(key) for key in form.keys()}
        else:
            data = request.get_json(silent=True) or {}

        required = ['document_type_id', 'municipality_id', 'delivery_method', 'purpose']
        validate_required_fields(data, required)

        # Enforce municipality scoping: residents may only request in their registered municipality
        try:
            municipality_id = int(data['municipality_id'])
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid municipality_id'}), 400

        if not user.municipality_id or int(user.municipality_id) != municipality_id:
            return jsonify({'error': 'You can only request documents in your registered municipality'}), 403

        # Validate delivery rules against selected document type
        try:
            document_type_id = int(data['document_type_id'])
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid document_type_id'}), 400

        dt = DocumentType.query.get(document_type_id)
        if not dt or not dt.is_active:
            return jsonify({'error': 'Selected document type is not available'}), 400

        requirements = []
        if isinstance(dt.requirements, list):
            requirements = [str(item).strip() for item in dt.requirements if str(item).strip()]
        requirement_count = min(len(requirements), 5)

        uploaded_requirement_files = []
        additional_files = []
        if is_multipart:
            primary = request.files.getlist('requirement_files')
            alternate = request.files.getlist('requirements[]')
            uploaded_requirement_files = [f for f in (primary or alternate or []) if getattr(f, 'filename', '')]
            additional_files = [f for f in request.files.getlist('supporting_files') if getattr(f, 'filename', '')]

        if requirement_count > 0 and len(uploaded_requirement_files) < requirement_count:
            return jsonify({'error': 'Missing required attachments', 'details': f'{requirement_count} files required; received {len(uploaded_requirement_files)}'}), 400

        # Digital is allowed only when the type supports digital AND the fee is zero
        requested_method = (data.get('delivery_method') or '').lower()
        is_zero_fee = float(dt.fee or 0.0) <= 0.0
        digital_allowed = bool(dt.supports_digital and is_zero_fee)
        if requested_method == 'digital' and not digital_allowed:
            return jsonify({'error': 'This document can only be requested for in-person pickup'}), 400

        # Require barangay on profile for all requests (guided pickup uses profile location)
        if not getattr(user, 'barangay_id', None):
            return jsonify({'error': 'Please complete your barangay details in your Profile before requesting documents.'}), 400

        # Create request
        # Normalize and capture extended fields
        remarks = data.get('remarks') or data.get('additional_notes') or data.get('additional_details')
        additional_details = data.get('additional_details')
        civil_status = data.get('civil_status')
        age = data.get('age')
        request_level = data.get('request_level')
        pickup_location = (data.get('pickup_location') or 'municipal').lower()

        # Build derived pickup address and barangay selection
        pickup_address = None
        if requested_method == 'pickup':
            muni_name = getattr(getattr(user, 'municipality', None), 'name', data.get('municipality_id'))
            if pickup_location == 'barangay' and getattr(user, 'barangay', None):
                pickup_address = f"Barangay {getattr(user.barangay, 'name', '')} Hall, {muni_name}"
            else:
                pickup_address = f"Municipal Hall - {muni_name}"

        raw_barangay_id = data.get('barangay_id')
        provided_barangay_id = None
        if raw_barangay_id is not None and raw_barangay_id != '':
            try:
                provided_barangay_id = int(raw_barangay_id)
            except (TypeError, ValueError):
                return jsonify({'error': 'Invalid barangay_id'}), 400

        selected_barangay_id = None
        if pickup_location == 'barangay':
            selected_barangay_id = getattr(user, 'barangay_id', None)

        # Build resident_input snapshot for auditability
        try:
            resident_input = {
                'purpose': data.get('purpose'),
                'remarks': remarks,
                'civil_status': civil_status,
                'age': age,
                'delivery_method': requested_method,
                'pickup_location': pickup_location,
                'document_type_id': data.get('document_type_id'),
            }
        except Exception:
            resident_input = None

        req = DocumentRequest(
            request_number=f"REQ-{user_id}-{User.query.count()}-{DocumentRequest.query.count()+1}",
            user_id=user_id,
            document_type_id=document_type_id,
            municipality_id=municipality_id,
            barangay_id= selected_barangay_id if requested_method == 'pickup' else (provided_barangay_id or getattr(user, 'barangay_id', None)),
            delivery_method=requested_method,
            # Derive pickup location string from selection; no free-text input
            delivery_address= pickup_address if requested_method == 'pickup' else data.get('delivery_address'),
            purpose=data['purpose'],
            additional_notes=(remarks or None),
            supporting_documents=data.get('supporting_documents') or [],
            status='pending',
        )

        # Gracefully set new fields if columns exist
        try:
            if hasattr(req, 'civil_status') and civil_status is not None:
                setattr(req, 'civil_status', civil_status)
            if hasattr(req, 'request_level') and request_level is not None:
                setattr(req, 'request_level', request_level)
            # Backward-safe: only set resident_input if column exists in DB
            try:
                if hasattr(req, 'resident_input') and resident_input is not None:
                    setattr(req, 'resident_input', resident_input)
            except Exception:
                pass
        except Exception:
            pass

        db.session.add(req)
        db.session.commit()

        if (uploaded_requirement_files or additional_files):
            municipality = Municipality.query.get(req.municipality_id)
            municipality_slug = municipality.slug if municipality else 'unknown'
            stored_paths = []
            try:
                for upload in uploaded_requirement_files + additional_files:
                    path = save_document_request_file(upload, req.id, municipality_slug)
                    stored_paths.append(path)
                if stored_paths:
                    existing = req.supporting_documents or []
                    req.supporting_documents = existing + stored_paths
                    db.session.commit()
            except Exception as file_exc:
                db.session.rollback()
                db.session.delete(req)
                db.session.commit()
                return jsonify({'error': 'Failed to save attachments', 'details': str(file_exc)}), 500

        return jsonify({'message': 'Request created successfully', 'request': req.to_dict()}), 201

    except ValidationError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create document request', 'details': str(e)}), 500


@documents_bp.route('/my-requests', methods=['GET'])
@jwt_required()
def get_my_requests():
    """Get current user's document requests."""
    try:
        user_id = jwt_identity_as_int()
        if user_id is None:
            return jsonify({'error': 'Invalid session', 'details': 'Please log in again.'}), 401

        requests_q = (
            DocumentRequest.query.filter_by(user_id=user_id)
            .order_by(DocumentRequest.created_at.desc())
            .all()
        )
        return jsonify({
            'count': len(requests_q),
            'requests': [r.to_dict() for r in requests_q]
        }), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get document requests', 'details': str(e)}), 500


@documents_bp.route('/requests/<int:request_id>', methods=['GET'])
@jwt_required()
def get_request_detail(request_id: int):
    """Get a specific request detail (owned by user)."""
    try:
        user_id = jwt_identity_as_int()
        if user_id is None:
            return jsonify({'error': 'Invalid session', 'details': 'Please log in again.'}), 401

        r = DocumentRequest.query.get(request_id)
        if not r or r.user_id != user_id:
            return jsonify({'error': 'Request not found'}), 404
        return jsonify({'request': r.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get request', 'details': str(e)}), 500


@documents_bp.route('/requests/<int:request_id>/claim-ticket', methods=['GET'])
@jwt_required()
def get_claim_ticket(request_id: int):
    """Return current claim ticket info for the owner (pickup requests).

    Reuses qr_code (relative path) and qr_data (JSON) fields.
    """
    try:
        user_id = jwt_identity_as_int()
        if user_id is None:
            return jsonify({'error': 'Invalid session', 'details': 'Please log in again.'}), 401

        r = DocumentRequest.query.get(request_id)
        if not r or r.user_id != user_id:
            return jsonify({'error': 'Request not found'}), 404
        if (r.delivery_method or '').lower() not in ('physical', 'pickup'):
            return jsonify({'error': 'Not a pickup request'}), 400
        data = r.qr_data or {}
        # Optional reveal of plaintext code for owner only
        reveal = (request.args.get('reveal') or '').strip() not in ('', '0', 'false', 'False')
        code_plain = None
        if reveal:
            try:
                from apps.api.utils.qr_utils import decrypt_code
                enc = (data or {}).get('code_enc')
                if enc:
                    code_plain = decrypt_code(enc)
            except Exception:
                code_plain = None
        # Build public URL to QR image if stored
        qr_url = None
        if r.qr_code:
            qr_url = f"/uploads/{str(r.qr_code).replace('\\', '/')}"
        # Resolve names
        muni_name = getattr(getattr(r, 'municipality', None), 'name', None)
        doc_name = getattr(getattr(r, 'document_type', None), 'name', None)
        return jsonify({
            'request_id': r.id,
            'request_number': r.request_number,
            'qr_url': qr_url,
            'code_masked': data.get('code_masked'),
            'code_plain': code_plain,
            'window_start': data.get('window_start'),
            'window_end': data.get('window_end'),
            'doc_name': doc_name,
            'muni_name': muni_name,
        }), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get claim ticket', 'details': str(e)}), 500


@documents_bp.route('/verify/<string:request_number>', methods=['GET'])
def public_verify_document(request_number: str):
    """Public verification endpoint for digital documents via request_number.

    Returns validity and limited non-sensitive details.
    """
    try:
        r = DocumentRequest.query.filter_by(request_number=request_number).first()
        if not r:
            return jsonify({'valid': False, 'reason': 'not_found'}), 200
        if (r.delivery_method or '').lower() != 'digital':
            return jsonify({'valid': False, 'reason': 'not_digital'}), 200
        if not r.document_file:
            return jsonify({'valid': False, 'reason': 'no_file'}), 200
        status = (r.status or '').lower()
        if status not in ('ready', 'completed'):
            return jsonify({'valid': False, 'reason': f'status_{status}'}), 200
        muni_name = getattr(getattr(r, 'municipality', None), 'name', None)
        doc_name = getattr(getattr(r, 'document_type', None), 'name', None)
        issued_at = r.ready_at.isoformat() if getattr(r, 'ready_at', None) else None
        return jsonify({
            'valid': True,
            'request_number': r.request_number,
            'status': r.status,
            'muni_name': muni_name,
            'doc_name': doc_name,
            'issued_at': issued_at,
            'url': f"/uploads/{str(r.document_file).replace('\\', '/')}"
        }), 200
    except Exception as e:
        return jsonify({'valid': False, 'error': str(e)}), 500


@documents_bp.route('/requests/<int:request_id>/upload', methods=['POST'])
@jwt_required()
@fully_verified_required
def upload_request_files(request_id: int):
    """Upload supporting documents to a request (owned by user). Accepts multiple 'file' parts."""
    try:
        user_id = jwt_identity_as_int()
        if user_id is None:
            return jsonify({'error': 'Invalid session', 'details': 'Please log in again.'}), 401

        r = DocumentRequest.query.get(request_id)
        if not r or r.user_id != user_id:
            return jsonify({'error': 'Request not found'}), 404

        if not request.files:
            return jsonify({'error': 'No files uploaded'}), 400

        # Determine municipality slug from request
        municipality_slug = r.municipality.slug if getattr(r, 'municipality', None) else 'unknown'

        saved = []
        # Accept multiple 'file' fields
        for key in request.files:
            files = request.files.getlist(key)
            for f in files:
                rel = save_document_request_file(f, r.id, municipality_slug)
                saved.append(rel)

        existing = r.supporting_documents or []
        r.supporting_documents = existing + saved
        db.session.commit()

        return jsonify({'message': 'Files uploaded', 'files': saved, 'request': r.to_dict()}), 200
    except ValidationError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to upload files', 'details': str(e)}), 500


