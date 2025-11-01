"""add audit_logs table

Revision ID: 20251029_add_audit_logs
Revises: 2bc95540bb7b
Create Date: 2025-10-29
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
revision = '20251029_add_audit_logs'
down_revision = '2bc95540bb7b'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    if not _table_exists(bind, 'audit_logs'):
        op.create_table(
            'audit_logs',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), nullable=True),
            sa.Column('municipality_id', sa.Integer(), nullable=False),
            sa.Column('entity_type', sa.String(length=50), nullable=False),
            sa.Column('entity_id', sa.Integer(), nullable=True),
            sa.Column('action', sa.String(length=50), nullable=False),
            sa.Column('actor_role', sa.String(length=20), nullable=True),
            sa.Column('old_values', sa.JSON(), nullable=True),
            sa.Column('new_values', sa.JSON(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )

    if not _index_exists(bind, 'audit_logs', 'idx_audit_muni'):
        op.create_index('idx_audit_muni', 'audit_logs', ['municipality_id'])
    if not _index_exists(bind, 'audit_logs', 'idx_audit_entity'):
        op.create_index('idx_audit_entity', 'audit_logs', ['entity_type', 'entity_id'])
    if not _index_exists(bind, 'audit_logs', 'idx_audit_created_at'):
        op.create_index('idx_audit_created_at', 'audit_logs', ['created_at'])


def downgrade():
    op.drop_index('idx_audit_created_at', table_name='audit_logs')
    op.drop_index('idx_audit_entity', table_name='audit_logs')
    op.drop_index('idx_audit_muni', table_name='audit_logs')
    op.drop_table('audit_logs')


