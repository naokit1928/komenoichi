from __future__ import annotations

import sqlite3
from typing import Optional, Tuple

from app_v2.db.core import resolve_db_path


class ReservationBookedRepository:
    """
    ReservationBookedPage 用 Repository（最終形）

    方針:
    - DB 取得のみ
    - 加工・整形は一切しない
    - sqlite3.Row をそのまま返す
    """

    def open_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(resolve_db_path())
        conn.row_factory = sqlite3.Row
        return conn

    def fetch_reservation_and_consumer(
        self,
        conn: sqlite3.Connection,
        reservation_id: int,
    ) -> Tuple[Optional[sqlite3.Row], Optional[sqlite3.Row]]:
        cur = conn.execute(
            """
            SELECT
                r.*,
                c.consumer_id AS consumer_id,
                c.email       AS consumer_email,
                c.registration_status AS consumer_registration_status
            FROM reservations r
            JOIN consumers c
              ON r.consumer_id = c.consumer_id
            WHERE r.reservation_id = ?
            """,
            (reservation_id,),
        )
        row = cur.fetchone()
        if not row:
            return None, None

        # 同一 row を reservation / consumer 両用途で使う（既存設計踏襲）
        return row, row

    def fetch_farm(
        self,
        conn: sqlite3.Connection,
        farm_id: int,
    ) -> Optional[sqlite3.Row]:
        cur = conn.execute(
            "SELECT * FROM farms WHERE farm_id = ?",
            (farm_id,),
        )
        return cur.fetchone()
