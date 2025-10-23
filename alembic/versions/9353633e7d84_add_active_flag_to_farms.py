from alembic import op
import sqlalchemy as sa

revision = '9353633e7d84'  # ← 自動生成されたIDをそのまま残す
down_revision = '8d4e3ececba4'
branch_labels = None
depends_on = None

def upgrade():
    conn = op.get_bind()
    insp = sa.inspect(conn)
    columns = [col['name'] for col in insp.get_columns('farms')]

    # すでにactive_flagカラムが存在する場合はスキップ
    if 'active_flag' not in columns:
        op.add_column(
            "farms",
            sa.Column("active_flag", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        )
        op.create_index("ix_farms_active_flag", "farms", ["active_flag"])

def downgrade():
    op.drop_index("ix_farms_active_flag", table_name="farms")
    op.drop_column("farms", "active_flag")
