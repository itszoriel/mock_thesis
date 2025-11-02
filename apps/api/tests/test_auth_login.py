import bcrypt
import pytest

from apps.api.app import create_app
from apps.api.config import TestingConfig
from apps.api import db
from apps.api.models.user import User


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
        username='resident1',
        email='resident1@example.com',
        first_name='Resident',
        last_name='One',
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


def test_login_accepts_case_insensitive_username(app, client):
    with app.app_context():
        _create_user()

    resp = client.post('/api/auth/login', json={
        'username': 'RESIDENT1',
        'password': 'SecurePass1'
    })

    assert resp.status_code == 200
    data = resp.json or {}
    assert data.get('access_token')
    assert (data.get('user') or {}).get('username') == 'resident1'


def test_login_inactive_user_blocked(app, client):
    with app.app_context():
        _create_user(is_active=False)

    resp = client.post('/api/auth/login', json={
        'username': 'resident1',
        'password': 'SecurePass1'
    })

    assert resp.status_code == 403
    assert 'deactivated' in (resp.json or {}).get('error', '').lower()


def test_login_invalid_password_returns_401(app, client):
    with app.app_context():
        _create_user()

    resp = client.post('/api/auth/login', json={
        'username': 'resident1',
        'password': 'WrongPass1'
    })

    assert resp.status_code == 401
    assert 'invalid credentials' in (resp.json or {}).get('error', '').lower()


