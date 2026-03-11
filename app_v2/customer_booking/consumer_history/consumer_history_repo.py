# app_v2/customer_booking/consumer_history/consumer_history_repo.py
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
        """

        cur = self.conn.execute(
            """
            SELECT
                farm_id
            FROM reservations
            WHERE consumer_id = ?
              AND LOWER(status) = 'confirmed'
            ORDER BY
                payment_succeeded_at DESC,
                reservation_id DESC
            LIMIT 1
            """,
            (consumer_id,),
        )
        row = cur.fetchone()
        return row["farm_id"] if row else None

    def get_consumer_reservations_with_farm_info(
        self,
        consumer_id: int,
    ) -> list[sqlite3.Row]:
        """
        consumer_id に紐づく全予約履歴（農家名つき）を取得する。
        - 支払いが完了（confirmed）またはキャンセル（canceled）されたものを対象とする。
        """
        cur = self.conn.execute(
            """
            SELECT
                r.reservation_id,
                r.status,
                r.pickup_display,
                r.rice_subtotal,
                r.event_end_at,
                f.farm_id,
                f.name AS farm_name,
                f.last_name
            FROM reservations r
            JOIN farms f ON r.farm_id = f.farm_id
            WHERE r.consumer_id = ?
              AND LOWER(r.status) IN ('confirmed', 'canceled', 'cancelled') -- ★ 大文字/小文字や綴り揺れに対応
            ORDER BY r.reservation_id DESC
            """,
            (consumer_id,)
        )
        return cur.fetchall()