import os
import bcrypt
import pytest
from datetime import datetime

from apps.api.app import create_app
from apps.api.config import TestingConfig
from apps.api import db
from apps.api.models.user import User
from apps.api.models.municipality import Municipality
from apps.api.models.marketplace import Item
from apps.api.models.transfer import TransferRequest
from flask_jwt_extended import create_access_token


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


def auth_header_for_user(user_id: int):
    token = create_access_token(identity=str(user_id))
    return {"Authorization": f"Bearer {token}"}


def test_change_password_hashing(app, client):
    with app.app_context():
        # Create a user with a known password
        u = User(
            username='testuser',
            email='test@example.com',
            password_hash=bcrypt.hashpw(b'OldPass1', bcrypt.gensalt()).decode('utf-8'),
            first_name='Test', last_name='User', role='resident',
            email_verified=True, admin_verified=True,
        )
        db.session.add(u)
        db.session.commit()

        # Change password via API
        hdrs = auth_header_for_user(u.id)
        resp = client.post('/api/auth/change-password', json={
            'current_password': 'OldPass1',
            'new_password': 'NewPass1'
        }, headers=hdrs)
        assert resp.status_code == 200

        # Verify new password works (hash updated)
        db.session.refresh(u)
        assert bcrypt.checkpw(b'NewPass1', u.password_hash.encode('utf-8'))


def test_self_transaction_block_even_with_string_id(app, client):
    with app.app_context():
        # Minimal municipality for scoping
        m = Municipality(name='Iba', slug='iba', psgc_code='000000000')
        db.session.add(m)
        db.session.commit()

        # Seller (fully verified resident)
        seller = User(
            username='seller', email='seller@example.com',
            password_hash=bcrypt.hashpw(b'PassWord1', bcrypt.gensalt()).decode('utf-8'),
            first_name='Sell', last_name='Er', role='resident',
            email_verified=True, admin_verified=True,
            municipality_id=m.id,
        )
        db.session.add(seller)
        db.session.commit()

        # Item owned by seller
        item = Item(
            user_id=seller.id,
            title='Chair', description='Nice chair', category='furniture',
            condition='good', transaction_type='sell', price=100.0,
            municipality_id=m.id, status='available'
        )
        db.session.add(item)
        db.session.commit()

        # Seller tries to create a transaction for own item (should be blocked)
        hdrs = auth_header_for_user(seller.id)  # identity is a string in token
        resp = client.post('/api/marketplace/transactions', json={
            'item_id': item.id,
            'notes': 'attempt'
        }, headers=hdrs)
        assert resp.status_code == 400
        assert 'You cannot transact with your own item' in (resp.json or {}).get('error', '')


def test_uploads_allowlist_blocks_private(app, client):
    # Access to a blocked private path should be forbidden (403)
    resp = client.get('/uploads/verification/user_1/file.jpg')
    assert resp.status_code == 403


def test_owner_status_edit_is_ignored(app, client):
    with app.app_context():
        m = Municipality(name='Iba', slug='iba2', psgc_code='000000001')
        db.session.add(m)
        db.session.commit()

        owner = User(
            username='owner', email='owner@example.com',
            password_hash=bcrypt.hashpw(b'PassWord1', bcrypt.gensalt()).decode('utf-8'),
            first_name='Own', last_name='Er', role='resident',
            email_verified=True, admin_verified=True,
            municipality_id=m.id,
        )
        db.session.add(owner)
        db.session.commit()

        item = Item(
            user_id=owner.id,
            title='Lamp', description='Desk lamp', category='electronics',
            condition='good', transaction_type='donate', price=None,
            municipality_id=m.id, status='available'
        )
        db.session.add(item)
        db.session.commit()

        hdrs = auth_header_for_user(owner.id)
        resp = client.put(f'/api/marketplace/items/{item.id}', json={
            'status': 'completed',
        }, headers=hdrs)
        assert resp.status_code == 200
        body = resp.json or {}
        returned = (body.get('item') or {})
        assert returned.get('status') == 'available'


def test_request_transfer_flow(app, client):
    with app.app_context():
        origin = Municipality(name='Masinloc', slug='masinloc', psgc_code='000000002')
        target = Municipality(name='Iba', slug='iba-city', psgc_code='000000003')
        db.session.add_all([origin, target])
        db.session.commit()

        resident = User(
            username='mover',
            email='mover@example.com',
            password_hash=bcrypt.hashpw(b'Secure12', bcrypt.gensalt()).decode('utf-8'),
            first_name='Move', last_name='Resident', role='resident',
            email_verified=True, admin_verified=True,
            municipality_id=origin.id,
        )
        db.session.add(resident)
        db.session.commit()

        headers = auth_header_for_user(resident.id)
        resp = client.post('/api/auth/transfer', json={
            'to_municipality_id': target.id,
            'notes': 'Relocating for work',
        }, headers=headers)

        assert resp.status_code == 201
        payload = resp.json or {}
        transfer = payload.get('transfer') or {}
        assert transfer.get('status') == 'pending'
        assert transfer.get('from_municipality_id') == origin.id
        assert transfer.get('to_municipality_id') == target.id

        saved = TransferRequest.query.filter_by(user_id=resident.id).first()
        assert saved is not None
        assert saved.status == 'pending'

        # Duplicate request should be blocked while pending
        resp_dup = client.post('/api/auth/transfer', json={
            'to_municipality_id': target.id,
            'notes': 'Duplicate request',
        }, headers=headers)
        assert resp_dup.status_code == 400
        body_dup = resp_dup.json or {}
        assert 'active transfer request' in (body_dup.get('error') or '')

