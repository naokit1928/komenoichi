"""normalize reservations: move size into item and set quantity=1

Revision ID: edded43abf4d
Revises: 8ef7dbe1e7e6
Create Date: 2025-10-21 16:48:04.863299
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "edded43abf4d"
down_revision: Union[str, Sequence[str], None] = "8ef7dbe1e7e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    旧データを新仕様へ正規化する。
    - quantity(=旧:袋サイズ 10/25 等) -> item("10kg"/"25kg") へ移す（itemがNULLの行のみ）
    - 袋数 quantity は 1 に統一（新方式の行は触らない）
    - amount はここでは変更しない（確定時の自動計算は別ステップ）
    """
    conn = op.get_bind()

    # 1) 旧データ: quantity から item へ移す（既に item がある行は対象外）
    conn.exec_driver_sql(
        """
        UPDATE reservations
           SET item = CASE quantity
                        WHEN 5  THEN '5kg'
                        WHEN 10 THEN '10kg'
                        WHEN 25 THEN '25kg'
                        WHEN 30 THEN '30kg'
                        ELSE CAST(quantity AS TEXT) || 'kg'
                      END
         WHERE item IS NULL
        """
    )

    # 2) 旧データ: quantity（袋数）を 1 に正規化（新仕様で既に袋数が入っている行は触らない）
    conn.exec_driver_sql(
        """
        UPDATE reservations
           SET quantity = 1
         WHERE item IN ('5kg','10kg','25kg','30kg')
           AND (quantity IS NULL OR quantity IN (5,10,25,30))
        """
    )


def downgrade() -> None:
    """
    可能な範囲で巻き戻す（完全な復元は行わない）。
    - item から旧 quantity(=袋サイズ) へ戻す
    - item は NULL に戻す
    """
    conn = op.get_bind()

    # 1) 袋サイズへ戻す
    conn.exec_driver_sql(
        """
        UPDATE reservations
           SET quantity = CASE item
                            WHEN '5kg'  THEN 5
                            WHEN '10kg' THEN 10
                            WHEN '25kg' THEN 25
                            WHEN '30kg' THEN 30
                            ELSE quantity
                          END
         WHERE item IN ('5kg','10kg','25kg','30kg')
        """
    )

    # 2) item を NULL に戻す
    conn.exec_driver_sql(
        """
        UPDATE reservations
           SET item = NULL
         WHERE item IN ('5kg','10kg','25kg','30kg')
        """
    )
