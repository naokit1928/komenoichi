"""add order_id to reservations (nullable, indexed)

Revision ID: 5b2c2a9a9a3a
Revises: beb3104bfba5
Create Date: 2025-10-21 23:59:00
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "5b2c2a9a9a3a"
down_revision = "a1b2c3d4e5f6"  # 最新のリビジョンに合わせて
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQLiteでも安全に列追加できるよう batch_alter_table を使用
    with op.batch_alter_table("reservations", schema=None) as batch_op:
        batch_op.add_column(sa.Column("order_id", sa.Text(), nullable=True))

    op.create_index(
        "ix_reservations_order_id", "reservations", ["order_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_reservations_order_id", table_name="reservations")
    with op.batch_alter_table("reservations", schema=None) as batch_op:
        batch_op.drop_column("order_id")
