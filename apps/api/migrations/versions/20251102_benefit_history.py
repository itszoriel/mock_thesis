"""add benefit application completed_at

Revision ID: 20251102_benefit_history
Revises: 20251102_add_password_reset_tokens
Create Date: 2025-11-02
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251102_benefit_history'
down_revision = '20251102_add_password_reset_tokens'
branch_labels = None
depends_on = None


def upgrade():
    # Add completed_at column to benefit_applications if it does not exist
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col['name'] for col in inspector.get_columns('benefit_applications')]
    if 'completed_at' not in columns:
        op.add_column('benefit_applications', sa.Column('completed_at', sa.DateTime(), nullable=True))
        # Prefill completed_at for already approved applications for better history context
        op.execute(
            """
            UPDATE benefit_applications
            SET completed_at = approved_at
            WHERE completed_at IS NULL AND status IN ('approved', 'completed')
            """
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col['name'] for col in inspector.get_columns('benefit_applications')]
    if 'completed_at' in columns:
        op.drop_column('benefit_applications', 'completed_at')


