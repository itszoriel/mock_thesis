import bcrypt
import pytest
from datetime import datetime

from apps.api.app import create_app
from apps.api.config import TestingConfig
from apps.api import db
from apps.api.models.user import User
from apps.api.models.benefit import BenefitProgram, BenefitApplication


@pytest.fixture()
def app():
    app = create_app(TestingConfig)
    app.config['TESTING'] = True
    with app.app_context():
        db.create_all()
    yield app
    with app.app_context():
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def _create_user(**overrides):
    base = dict(
        username='history_user',
        email='history_user@example.com',
        first_name='History',
        last_name='Resident',
        role='resident',
        email_verified=True,
        admin_verified=True,
        password_hash=bcrypt.hashpw(b'SecurePass1', bcrypt.gensalt()).decode('utf-8'),
    )
    base.update(overrides)
    user = User(**base)
    db.session.add(user)
    db.session.commit()
    return user


def _create_program(**overrides):
    base = dict(
        name='Assistance Program',
        code='ASSIST_TEST',
        description='Test assistance program',
        program_type='general',
        is_active=True,
        required_documents=['Valid ID'],
    )
    base.update(overrides)
    program = BenefitProgram(**base)
    db.session.add(program)
    db.session.commit()
    return program


def _auth_headers(client, username='history_user', password='SecurePass1'):
    resp = client.post('/api/auth/login', json={'username': username, 'password': password})
    assert resp.status_code == 200
    token = (resp.json or {}).get('access_token')
    assert token
    return {'Authorization': f'Bearer {token}'}


def test_history_returns_empty_list_for_new_user(app, client):
    with app.app_context():
        _create_user()

    headers = _auth_headers(client)
    resp = client.get('/api/benefits/my-history', headers=headers)
    assert resp.status_code == 200
    data = resp.json or {}
    assert data.get('count') == 0
    assert data.get('history') == []


def test_history_includes_completed_application(app, client):
    with app.app_context():
        user = _create_user()
        program = _create_program(is_active=False, completed_at=None)
        application = BenefitApplication(
            application_number='APP-1',
            user_id=user.id,
            program_id=program.id,
            status='approved',
            approved_at=datetime.utcnow(),
        )
        db.session.add(application)
        db.session.commit()

    headers = _auth_headers(client)
    resp = client.get('/api/benefits/my-history', headers=headers)
    assert resp.status_code == 200
    data = resp.json or {}
    history = data.get('history') or []
    assert len(history) == 1
    item = history[0]
    assert item.get('program', {}).get('id') == _get_program_id(app)
    assert item.get('status') in {'approved', 'completed'}


def _get_program_id(app):
    with app.app_context():
        program = BenefitProgram.query.filter_by(code='ASSIST_TEST').first()
        return program.id if program else None


