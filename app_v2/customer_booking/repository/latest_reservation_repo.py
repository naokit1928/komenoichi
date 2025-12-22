from __future__ import annotations

import sqlite3
from typing import Optional

from app_v2.db.core import resolve_db_path


class LatestReservationRepository:
    """
    最新の confirmed reservation を取得する READ 専用 Repo
    """

    def __init__(self) -> None:
        self.db_path = resolve_db_path()

    def get_latest_confirmed_reservation_id(
        self,
        *,
        consumer_id: int,
    ) -> Optional[int]:
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT reservation_id
                FROM reservations
                WHERE consumer_id = ?
                  AND status = 'confirmed'
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (consumer_id,),
            )
            row = cur.fetchone()
            return int(row[0]) if row else None
        finally:
            conn.close()
