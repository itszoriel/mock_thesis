"""Public/resident Issue reporting routes."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import or_

try:
    from apps.api import db
    from apps.api.models.issue import Issue, IssueCategory
    from apps.api.models.user import User
    from apps.api.models.municipality import Municipality
    from apps.api.utils import (
        validate_required_fields,
        ValidationError,
        fully_verified_required,
        save_issue_attachment,
        jwt_identity_as_int,
    )
except ImportError:
    from __init__ import db
    from models.issue import Issue, IssueCategory
    from models.user import User
    from models.municipality import Municipality
    from utils import (
        validate_required_fields,
        ValidationError,
        fully_verified_required,
        save_issue_attachment,
        jwt_identity_as_int,
    )


issues_bp = Blueprint('issues', __name__, url_prefix='/api/issues')


@issues_bp.route('/categories', methods=['GET'])
def list_categories():
    """Public list of active issue categories."""
    try:
        cats = IssueCategory.query.filter_by(is_active=True).all()
        return jsonify({'categories': [c.to_dict() for c in cats], 'count': len(cats)}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get categories', 'details': str(e)}), 500

@issues_bp.route('', methods=['GET'])
def list_issues():
    """Public list of issues (only public ones). Supports filters and pagination."""
    try:
        municipality_id = request.args.get('municipality_id', type=int)
        status = request.args.get('status')
        category = request.args.get('category')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)

        query = Issue.query.filter_by(is_public=True)
        if municipality_id:
            query = query.filter(Issue.municipality_id == municipality_id)
        if status:
            query = query.filter(Issue.status == status)
        if category:
            # category may be id or slug/name
            try:
                category_id = int(category)
                query = query.filter(Issue.category_id == category_id)
            except (TypeError, ValueError):
                cat = IssueCategory.query.filter(or_(IssueCategory.slug == category, IssueCategory.name == category)).first()
                if cat:
                    query = query.filter(Issue.category_id == cat.id)

        # Manual pagination to avoid paginate() edge cases
        total = query.count()
        items = (
            query.order_by(Issue.created_at.desc())
                 .limit(per_page)
                 .offset((page - 1) * per_page)
                 .all()
        )
        pages = (total + per_page - 1) // per_page if per_page else 1
        return jsonify({
            'issues': [i.to_dict() for i in items],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': pages,
            }
        }), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get issues', 'details': str(e)}), 500


@issues_bp.route('/<int:issue_id>', methods=['GET'])
def get_issue(issue_id: int):
    """Public issue detail if issue is public; otherwise 404."""
    try:
        issue = Issue.query.get(issue_id)
        if not issue or not issue.is_public:
            return jsonify({'error': 'Issue not found'}), 404
        return jsonify(issue.to_dict(include_updates=True)), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get issue', 'details': str(e)}), 500


@issues_bp.route('', methods=['POST'])
@jwt_required()
@fully_verified_required
def create_issue():
    """Create a new resident issue (scoped to resident's municipality)."""
    try:
        user_id = jwt_identity_as_int()
        if user_id is None:
            return jsonify({'error': 'Invalid session', 'details': 'Please log in again.'}), 401

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json() or {}
        required = ['category_id', 'title', 'description']
        validate_required_fields(data, required)

        # Municipality scoping
        municipality_id = user.municipality_id
        if not municipality_id:
            return jsonify({'error': 'User has no registered municipality'}), 400

        # Validate category
        try:
            category_id = int(data['category_id'])
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid category'}), 400

        category = IssueCategory.query.get(category_id)
        if not category:
            return jsonify({'error': 'Invalid category'}), 400

        # Generate issue number (simple and unique enough)
        count = Issue.query.count() + 1
        issue_number = f"ISS-{municipality_id}-{user_id}-{count}"

        # Require a specific location (address) for actionable triage
        specific_location = (data.get('specific_location') or '').strip()
        if not specific_location:
            return jsonify({'error': 'specific_location is required'}), 400

        raw_barangay_id = data.get('barangay_id')
        try:
            barangay_id = int(raw_barangay_id) if raw_barangay_id is not None else None
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid barangay_id'}), 400

        issue = Issue(
            issue_number=issue_number,
            user_id=user_id,
            category_id=category.id,
            title=data['title'],
            description=data['description'],
            municipality_id=municipality_id,
            barangay_id=barangay_id,
            specific_location=specific_location,
            latitude=data.get('latitude'),
            longitude=data.get('longitude'),
            attachments=[],
            priority=data.get('priority', 'medium'),
            status='submitted',
            is_public=True,
        )
        db.session.add(issue)
        db.session.commit()

        return jsonify({'message': 'Issue created successfully', 'issue': issue.to_dict()}), 201
    except ValidationError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create issue', 'details': str(e)}), 500


@issues_bp.route('/my', methods=['GET'])
@jwt_required()
def my_issues():
    """Get current user's issues."""
    try:
        user_id = jwt_identity_as_int()
        if user_id is None:
            return jsonify({'error': 'Invalid session', 'details': 'Please log in again.'}), 401

        issues = Issue.query.filter(Issue.user_id == user_id).order_by(Issue.created_at.desc()).all()
        return jsonify({'issues': [i.to_dict() for i in issues], 'count': len(issues)}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get issues', 'details': str(e)}), 500


@issues_bp.route('/<int:issue_id>/upload', methods=['POST'])
@jwt_required()
@fully_verified_required
def upload_issue_file(issue_id: int):
    """Upload attachment to an owned issue."""
    try:
        user_id = jwt_identity_as_int()
        if user_id is None:
            return jsonify({'error': 'Invalid session', 'details': 'Please log in again.'}), 401

        user = User.query.get(user_id)
        issue = Issue.query.get(issue_id)
        if not issue:
            return jsonify({'error': 'Issue not found'}), 404
        if issue.user_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403

        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        file = request.files['file']

        # Determine municipality slug
        municipality = Municipality.query.get(user.municipality_id)
        municipality_slug = municipality.slug if municipality else 'unknown'

        # Enforce max 5 attachments per issue
        existing = issue.attachments or []
        if len(existing) >= 5:
            return jsonify({'error': 'Maximum attachments reached (5)'}), 400

        rel_path = save_issue_attachment(file, issue.id, municipality_slug)

        # Append to attachments
        existing.append(rel_path)
        issue.attachments = existing
        db.session.commit()

        return jsonify({'message': 'File uploaded', 'path': rel_path, 'issue': issue.to_dict()}), 200
    except ValidationError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to upload file', 'details': str(e)}), 500


