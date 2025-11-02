"""add user verification status

Revision ID: 20251102_user_verification_status
Revises: 20251102_benefit_history
Create Date: 2025-11-02
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251102_user_verification_status'
down_revision = '20251102_benefit_history'
branch_labels = None
depends_on = None


def _column_exists(inspector, table_name: str, column_name: str) -> bool:
    try:
        return column_name in {col['name'] for col in inspector.get_columns(table_name)}
    except Exception:
        return False


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _column_exists(inspector, 'users', 'verification_status'):
        op.add_column('users', sa.Column('verification_status', sa.String(length=30), nullable=False, server_default='pending'))
        # Align existing rows with legacy flags
        op.execute(
            """
            UPDATE users
            SET verification_status = CASE
                WHEN admin_verified = 1 THEN 'verified'
                ELSE 'pending'
            END
            """
        )
        op.alter_column('users', 'verification_status', server_default=None)

    if not _column_exists(inspector, 'users', 'verification_notes'):
        op.add_column('users', sa.Column('verification_notes', sa.Text(), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _column_exists(inspector, 'users', 'verification_notes'):
        op.drop_column('users', 'verification_notes')

    if _column_exists(inspector, 'users', 'verification_status'):
        op.drop_column('users', 'verification_status')


