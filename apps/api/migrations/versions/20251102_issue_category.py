"""add category label to issues

Revision ID: 20251102_issue_category
Revises: 20251102_benefit_history
Create Date: 2025-11-02
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251102_issue_category'
down_revision = '20251102_benefit_history'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('issues', sa.Column('category_label', sa.String(length=120), nullable=True))

    conn = op.get_bind()
    try:
        conn.execute(
            sa.text(
                """
                UPDATE issues
                SET category_label = ic.name
                FROM issue_categories ic
                WHERE issues.category_id = ic.id
                """
            )
        )
    except Exception:
        # Best-effort backfill; skip if tables missing during bootstrap
        pass


def downgrade():
    op.drop_column('issues', 'category_label')



