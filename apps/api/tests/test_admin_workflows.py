from pathlib import Path

import bcrypt
import pytest
from flask_jwt_extended import create_access_token

from apps.api.app import create_app
from apps.api.config import TestingConfig
from apps.api import db
from apps.api.models.user import User
from apps.api.models.municipality import Municipality
from apps.api.models.document import DocumentType, DocumentRequest
from apps.api.models.audit import AuditLog


@pytest.fixture()
def app(tmp_path):
    uploads_dir = tmp_path / 'uploads'
    uploads_dir.mkdir(parents=True, exist_ok=True)
    app = create_app(TestingConfig)
    app.config['TESTING'] = True
    app.config['UPLOAD_FOLDER'] = str(uploads_dir)
    with app.app_context():
        db.create_all()
    yield app
    with app.app_context():
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def _auth_header(app, user_id: int):
    with app.app_context():
        token = create_access_token(identity=str(user_id), additional_claims={'role': 'municipal_admin'})
    return {'Authorization': f'Bearer {token}'}


def _seed_admin_and_resident(app):
    with app.app_context():
        muni = Municipality(name='Iba', slug='iba', psgc_code='012345678')
        db.session.add(muni)
        db.session.commit()

        admin = User(
            username='admin1',
            email='admin1@example.com',
            first_name='Admin',
            last_name='User',
            role='municipal_admin',
            admin_municipality_id=muni.id,
            municipality_id=muni.id,
            password_hash=bcrypt.hashpw(b'AdminPass1', bcrypt.gensalt()).decode('utf-8'),
        )
        resident = User(
            username='resident1',
            email='resident1@example.com',
            first_name='Resident',
            last_name='Example',
            role='resident',
            municipality_id=muni.id,
            email_verified=True,
            admin_verified=True,
            is_active=True,
            valid_id_front='verification/resident1/front.png',
            valid_id_back='verification/resident1/back.png',
            selfie_with_id='verification/resident1/selfie.png',
            proof_of_residency='verification/resident1/proof.png',
            password_hash=bcrypt.hashpw(b'SecurePass1', bcrypt.gensalt()).decode('utf-8'),
        )
        db.session.add_all([admin, resident])
        db.session.commit()
        return admin.id, resident.id, muni.id


def test_admin_reject_resident_resets_flags_and_logs(app, client):
    admin_id, resident_id, muni_id = _seed_admin_and_resident(app)

    headers = _auth_header(app, admin_id)
    resp = client.post(f'/api/admin/users/{resident_id}/reject', json={'reason': 'Invalid documents'}, headers=headers)
    assert resp.status_code == 200

    with app.app_context():
        resident = db.session.get(User, resident_id)
        assert resident is not None
        assert resident.email_verified is False
        assert resident.admin_verified is False
        assert resident.is_active is False
        assert resident.valid_id_front is None
        assert resident.valid_id_back is None
        assert resident.selfie_with_id is None
        assert resident.proof_of_residency is None

        audit_entry = AuditLog.query.filter_by(action='resident_rejected', entity_id=resident_id, municipality_id=muni_id).first()
        assert audit_entry is not None
        assert audit_entry.notes == 'Invalid documents'


def _seed_document_request(app, resident_id: int, muni_id: int):
    with app.app_context():
        doc_type = DocumentType(
            code='INDIGENCY',
            name='Certificate of Indigency',
            supports_digital=True,
            supports_physical=True,
            authority_level='municipal',
            is_active=True,
        )
        db.session.add(doc_type)
        db.session.commit()

        request = DocumentRequest(
            request_number=f'REQ-{resident_id}-1',
            user_id=resident_id,
            document_type_id=doc_type.id,
            municipality_id=muni_id,
            delivery_method='digital',
            purpose='Scholarship assistance',
            status='approved',
        )
        db.session.add(request)
        db.session.commit()
        return doc_type.id, request.id


def test_generate_document_pdf_success(app, client, monkeypatch):
    admin_id, resident_id, muni_id = _seed_admin_and_resident(app)
    _, request_id = _seed_document_request(app, resident_id, muni_id)

    def fake_generate(req, doc_type, user, admin_user=None):
        out_dir = Path(app.config['UPLOAD_FOLDER']) / 'generated_docs'
        out_dir.mkdir(parents=True, exist_ok=True)
        abs_path = out_dir / 'dummy.pdf'
        abs_path.write_bytes(b'%PDF-1.4\n%EOF')
        return abs_path, 'generated_docs/dummy.pdf'

    monkeypatch.setattr('apps.api.utils.pdf_generator.generate_document_pdf', fake_generate)

    headers = _auth_header(app, admin_id)
    resp = client.post(f'/api/admin/documents/requests/{request_id}/generate-pdf', headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['request']['status'] == 'ready'
    assert data['url'].endswith('generated_docs/dummy.pdf')


def test_generate_document_pdf_failure_returns_json_error(app, client, monkeypatch):
    admin_id, resident_id, muni_id = _seed_admin_and_resident(app)
    _, request_id = _seed_document_request(app, resident_id, muni_id)

    def fake_generate(*args, **kwargs):
        raise RuntimeError('PDF generator failed')

    monkeypatch.setattr('apps.api.utils.pdf_generator.generate_document_pdf', fake_generate)

    headers = _auth_header(app, admin_id)
    resp = client.post(f'/api/admin/documents/requests/{request_id}/generate-pdf', headers=headers)
    assert resp.status_code == 500
    data = resp.get_json()
    assert data['error'] == 'Failed to generate PDF'
    assert 'PDF generator failed' in data.get('details', '')


def test_export_users_pdf_success(app, client, monkeypatch):
    admin_id, _, _ = _seed_admin_and_resident(app)

    def fake_generate_table_pdf(out_path, **kwargs):
        out_path.parent.mkdir(parents=True, exist_ok=True)
        Path(out_path).write_bytes(b'%PDF-1.4\n%EOF')

    monkeypatch.setattr('apps.api.utils.pdf_table_report.generate_table_pdf', fake_generate_table_pdf)

    headers = _auth_header(app, admin_id)
    resp = client.post('/api/admin/exports/users.pdf', json={'range': 'last_7_days'}, headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['url'].endswith('.pdf')
    assert data['summary']['rows'] >= 0


def test_export_users_excel_success(app, client, monkeypatch):
    admin_id, _, _ = _seed_admin_and_resident(app)

    class DummyWorkbook:
        pass

    def fake_generate_workbook(payload):
        return DummyWorkbook()

    def fake_save_workbook(workbook, out_path):
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        Path(out_path).write_bytes(b'PK\x03\x04')

    monkeypatch.setattr('apps.api.utils.excel_generator.generate_workbook', fake_generate_workbook)
    monkeypatch.setattr('apps.api.utils.excel_generator.save_workbook', fake_save_workbook)

    headers = _auth_header(app, admin_id)
    resp = client.post('/api/admin/exports/users.xlsx', json={'range': 'last_30_days'}, headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['url'].endswith('.xlsx')
    assert data['summary']['rows'] >= 0


def test_export_failure_returns_error_payload(app, client, monkeypatch):
    admin_id, _, _ = _seed_admin_and_resident(app)

    def boom(*args, **kwargs):
        raise RuntimeError('Boom')

    monkeypatch.setattr('apps.api.utils.pdf_table_report.generate_table_pdf', boom)

    headers = _auth_header(app, admin_id)
    resp = client.post('/api/admin/exports/users.pdf', headers=headers)
    assert resp.status_code == 500
    data = resp.get_json()
    assert data['error'] == 'Failed to export'
    assert 'Boom' in data.get('details', '')

