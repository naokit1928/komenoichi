"""add indexes on reservations (farm_id, user_id, created_at)"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "063e40cc63b4"
down_revision = "9353633e7d84"  # 直前の正常リビジョンIDに修正
branch_labels = None
depends_on = None


def upgrade():
    # 軽量インデックス（検索/フィルタ向け）
    op.create_index(
        "ix_reservations_farm_id",
        "reservations",
        ["farm_id"],
        unique=False,
    )
    op.create_index(
        "ix_reservations_user_id",
        "reservations",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_reservations_created_at",
        "reservations",
        ["created_at"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_reservations_created_at", table_name="reservations")
    op.drop_index("ix_reservations_user_id", table_name="reservations")
    op.drop_index("ix_reservations_farm_id", table_name="reservations")
