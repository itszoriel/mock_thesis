"""add password reset tokens table

Revision ID: 20251102_reset_tokens
Revises: 7e00b3f22e71
Create Date: 2025-11-02
"""

from alembic import op
import sqlalchemy as sa


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _index_exists(bind, table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(idx.get('name') == index_name for idx in inspector.get_indexes(table_name))


# revision identifiers, used by Alembic.
revision = '20251102_reset_tokens'
down_revision = '7e00b3f22e71'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    if not _table_exists(bind, 'password_reset_tokens'):
        op.create_table(
            'password_reset_tokens',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('token_hash', sa.String(length=128), nullable=False),
            sa.Column('expires_at', sa.DateTime(), nullable=False),
            sa.Column('used_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('last_ip', sa.String(length=64), nullable=True),
            sa.Column('user_agent', sa.String(length=255), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id']),
            sa.UniqueConstraint('token_hash'),
        )

    if not _index_exists(bind, 'password_reset_tokens', 'idx_password_reset_user'):
        op.create_index('idx_password_reset_user', 'password_reset_tokens', ['user_id'])

    if not _index_exists(bind, 'password_reset_tokens', 'idx_password_reset_expires'):
        op.create_index('idx_password_reset_expires', 'password_reset_tokens', ['expires_at'])


def downgrade():
    bind = op.get_bind()

    if _index_exists(bind, 'password_reset_tokens', 'idx_password_reset_expires'):
        op.drop_index('idx_password_reset_expires', table_name='password_reset_tokens')
    if _index_exists(bind, 'password_reset_tokens', 'idx_password_reset_user'):
        op.drop_index('idx_password_reset_user', table_name='password_reset_tokens')
    if _table_exists(bind, 'password_reset_tokens'):
        op.drop_table('password_reset_tokens')


