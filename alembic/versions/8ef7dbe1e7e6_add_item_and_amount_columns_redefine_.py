"""add item and amount columns, redefine quantity (SQLite-safe)"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "8ef7dbe1e7e6"
down_revision = "063e40cc63b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- farms.active_flag の NOT NULL 変更は SQLite では ALTER 不可のためスキップ ---
    # 代替として index の追加のみ行う（検索最適化）
    op.create_index("ix_farms_active_flag", "farms", ["active_flag"], unique=False)

    # --- reservations に item / amount を追加（まずは NULL 許可で追加） ---
    # SQLite は既存テーブルの列制約変更が苦手なため、NOT NULL はアプリ側で担保する
    with op.batch_alter_table("reservations", schema=None) as batch_op:
        batch_op.add_column(sa.Column("item", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("amount", sa.Float(), nullable=True))

    # 既存データの quantity(=旧:袋サイズラベル) から item を埋める
    # 10 -> "10kg", 25 -> "25kg", 5/30 も対応。その他は "<quantity>kg" として保存。
    conn = op.get_bind()
    # 5kg/10kg/25kg/30kg の既知値を先に更新
    conn.exec_driver_sql("""
        UPDATE reservations
           SET item = CASE quantity
                        WHEN 5  THEN '5kg'
                        WHEN 10 THEN '10kg'
                        WHEN 25 THEN '25kg'
                        WHEN 30 THEN '30kg'
                        ELSE item
                      END
         WHERE quantity IN (5,10,25,30)
            OR item IS NULL
    """)
    # 既知以外の値が残っていれば "<quantity>kg" として埋める
    conn.exec_driver_sql("""
        UPDATE reservations
           SET item = CAST(quantity AS TEXT) || 'kg'
         WHERE item IS NULL
    """)

    # ここで NOT NULL 制約を付けたいところだが、SQLite では ALTER できないため見送り。
    # 将来、RDBMS移行時や大規模変更時に付け直す。

    # ★ 重要：既存にある reservations のインデックスは削除しない（前リビジョンで作成済み）


def downgrade() -> None:
    # 逆操作：reservations から列を落とす
    with op.batch_alter_table("reservations", schema=None) as batch_op:
        batch_op.drop_column("amount")
        batch_op.drop_column("item")

    # farms 側 index を削除
    op.drop_index("ix_farms_active_flag", table_name="farms")
