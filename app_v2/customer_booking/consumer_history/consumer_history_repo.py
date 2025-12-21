from __future__ import annotations

import sqlite3
from typing import Optional

from app_v2.db.core import resolve_db_path


class ConsumerHistoryRepository:
    """
    Consumer 履歴参照専用 Repository（read-only）

    責務:
    - consumer_id に紐づく予約履歴の参照
    - UI / confirm / public などの文脈は一切持たない

    注意:
    - 状態遷移は扱わない
    - write / update は一切行わない
    """

    def __init__(self) -> None:
        db_path = resolve_db_path()
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row

    def get_last_confirmed_farm_id(
        self,
        consumer_id: int,
    ) -> Optional[int]:
        """
        consumer_id に紐づく、直近で confirmed 状態の farm_id を返す。

        - confirmed の定義は reservations.status = 'confirmed'
        - 並び順は payment_succeeded_at → reservation_id
        - 該当なしの場合は None を返す
        """

        cur = self.conn.execute(
            """
            SELECT
                farm_id
            FROM reservations
            WHERE consumer_id = ?
              AND status = 'confirmed'
            ORDER BY
                payment_succeeded_at DESC,
                reservation_id DESC
            LIMIT 1
            """,
            (consumer_id,),
        )

        row = cur.fetchone()
        return int(row["farm_id"]) if row else None
