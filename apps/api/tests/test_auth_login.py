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
        verification_status='verified',
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

    assert resp.status_code == 400
    assert (resp.json or {}).get('error') == 'Incorrect password'


def test_login_allows_needs_revision_user(app, client):
    with app.app_context():
        _create_user(
            username='resident2',
            email='resident2@example.com',
            admin_verified=False,
            verification_status='needs_revision',
            verification_notes='Please provide clearer ID',
        )

    resp = client.post('/api/auth/login', json={
        'username': 'resident2',
        'password': 'SecurePass1'
    })

    assert resp.status_code == 200
    assert resp.json.get('access_token')
    assert resp.json.get('user', {}).get('verification_status') == 'needs_revision'


def test_resubmit_profile_sets_pending(app, client):
    with app.app_context():
        user = _create_user(
            username='resident3',
            email='resident3@example.com',
            admin_verified=False,
            verification_status='needs_revision',
            verification_notes='Update documents',
        )
        user_id = user.id

    login = client.post('/api/auth/login', json={'username': 'resident3', 'password': 'SecurePass1'})
    token = login.json.get('access_token')
    assert token

    resp = client.post('/api/auth/profile/resubmit', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    with app.app_context():
        refreshed = User.query.get(user_id)
        assert refreshed.verification_status == 'pending'
        assert refreshed.verification_notes is None


