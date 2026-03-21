from __future__ import annotations

import sqlite3
from typing import Optional

from app_v2.db.core import resolve_db_path


class LatestReservationRepository:
    """
    最新の ACTIVE reservation（Stripe 二重予約ガード用）を取得する READ 専用 Repo

    定義:
    - status = 'confirmed'
    - かつ event_end_at が現在時刻より未来のものだけを active とみなす
    """

    def __init__(self) -> None:
        self.db_path = resolve_db_path()

    def get_latest_confirmed_reservation_id(
        self,
        *,
        consumer_id: int,
    ) -> Optional[int]:
        """
        最新のシステム照会IDを返す（reservation_booked_api 等で使用）
        """
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT reservation_id
                FROM reservations
                WHERE consumer_id = ?
                  AND status = 'confirmed'
                  AND event_end_at > CURRENT_TIMESTAMP
                ORDER BY event_end_at ASC
                LIMIT 1
                """,
                (consumer_id,),
            )
            row = cur.fetchone()
            return int(row[0]) if row else None
        finally:
            conn.close()

    def get_latest_confirmed_farm_id(
        self,
        *,
        consumer_id: int,
    ) -> Optional[int]:
        """
        最新の農家IDを返す（public_reservations_api 経由で一覧ページで使用）
        """
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT farm_id
                FROM reservations
                WHERE consumer_id = ?
                  AND status = 'confirmed'
                  AND event_end_at > CURRENT_TIMESTAMP
                ORDER BY event_end_at ASC
                LIMIT 1
                """,
                (consumer_id,),
            )
            row = cur.fetchone()
            return int(row[0]) if row else None
        finally:
            conn.close()