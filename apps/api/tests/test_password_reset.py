import hashlib
from datetime import date, timedelta, datetime

import bcrypt
import pytest

from apps.api.app import create_app
from apps.api.config import TestingConfig
from apps.api import db
from apps.api.models.user import User
from apps.api.models.password_reset import PasswordResetToken


@pytest.fixture()
def app():
    app = create_app(TestingConfig)
    app.config['TESTING'] = True
    app.config['WEB_URL'] = 'https://munlink-web.test'
    with app.app_context():
        db.create_all()
    yield app
    with app.app_context():
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def _create_user(app):
    with app.app_context():
        user = User(
            username='resident1',
            email='resident1@example.com',
            first_name='Resident',
            last_name='User',
            role='resident',
            email_verified=True,
            admin_verified=True,
            is_active=True,
            date_of_birth=date(1995, 5, 20),
            password_hash=bcrypt.hashpw(b'OldPass1', bcrypt.gensalt()).decode('utf-8'),
        )
        db.session.add(user)
        db.session.commit()
        return user.id


def test_forgot_password_creates_token_and_sends_email(app, client, monkeypatch):
    user_id = _create_user(app)

    sent = {}

    def fake_send(email, link, name):
        sent['email'] = email
        sent['link'] = link
        sent['name'] = name

    monkeypatch.setattr('apps.api.utils.email_sender.send_password_reset_email', fake_send)
    monkeypatch.setattr('apps.api.routes.auth.secrets.token_urlsafe', lambda _: 'fixture-token')

    resp = client.post('/api/auth/forgot-password', json={
        'email': 'resident1@example.com',
        'username': 'resident1',
        'date_of_birth': '1995-05-20',
    })
    assert resp.status_code == 200
    assert sent['email'] == 'resident1@example.com'
    assert 'fixture-token' in sent['link']

    token_hash = hashlib.sha256('fixture-token'.encode('utf-8')).hexdigest()
    with app.app_context():
        stored = PasswordResetToken.query.filter_by(token_hash=token_hash, user_id=user_id).first()
        assert stored is not None
        assert stored.expires_at > stored.created_at


def test_forgot_password_with_invalid_details_is_silent(app, client, monkeypatch):
    _create_user(app)

    send_called = {'count': 0}

    def fake_send(*args, **kwargs):
        send_called['count'] += 1

    monkeypatch.setattr('apps.api.utils.email_sender.send_password_reset_email', fake_send)

    resp = client.post('/api/auth/forgot-password', json={
        'email': 'resident1@example.com',
        'username': 'wronguser',
        'date_of_birth': '1995-05-20',
    })
    assert resp.status_code == 200
    assert send_called['count'] == 0

    with app.app_context():
        assert PasswordResetToken.query.count() == 0


def test_reset_password_flow(app, client, monkeypatch):
    user_id = _create_user(app)

    monkeypatch.setattr('apps.api.utils.email_sender.send_password_reset_email', lambda *args, **kwargs: None)
    monkeypatch.setattr('apps.api.routes.auth.secrets.token_urlsafe', lambda _: 'fixture-token-2')

    # Request reset
    client.post('/api/auth/forgot-password', json={
        'email': 'resident1@example.com',
        'username': 'resident1',
        'date_of_birth': '1995-05-20',
    })

    # Verify token
    verify_resp = client.post('/api/auth/forgot-password/verify', json={'token': 'fixture-token-2'})
    assert verify_resp.status_code == 200
    assert verify_resp.get_json()['valid'] is True

    # Perform reset
    reset_resp = client.post('/api/auth/reset-password', json={
        'token': 'fixture-token-2',
        'new_password': 'NewPass123',
        'confirm_password': 'NewPass123',
    })
    assert reset_resp.status_code == 200

    with app.app_context():
        user = db.session.get(User, user_id)
        assert user is not None
        assert bcrypt.checkpw(b'NewPass123', user.password_hash.encode('utf-8'))

        # Token should be marked used
        token_hash = hashlib.sha256('fixture-token-2'.encode('utf-8')).hexdigest()
        stored = PasswordResetToken.query.filter_by(token_hash=token_hash).first()
        assert stored is not None
        assert stored.used_at is not None

    # Token cannot be reused
    second_attempt = client.post('/api/auth/reset-password', json={
        'token': 'fixture-token-2',
        'new_password': 'AnotherPass123',
        'confirm_password': 'AnotherPass123',
    })
    assert second_attempt.status_code == 400


def test_reset_password_with_expired_token(app, client, monkeypatch):
    user_id = _create_user(app)

    with app.app_context():
        expired = PasswordResetToken(
            user_id=user_id,
            token_hash=hashlib.sha256('expired-token'.encode('utf-8')).hexdigest(),
            expires_at=datetime.utcnow() - timedelta(minutes=1)
        )
        db.session.add(expired)
        db.session.commit()

    resp = client.post('/api/auth/reset-password', json={
        'token': 'expired-token',
        'new_password': 'NewPass123',
        'confirm_password': 'NewPass123',
    })
    assert resp.status_code == 400

