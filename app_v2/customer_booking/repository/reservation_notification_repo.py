# app_v2/customer_booking/repository/reservation_notification_repo.py
from __future__ import annotations

import sqlite3
from typing import Any, Dict, Optional

from app_v2.db.core import resolve_db_path


class ReservationNotificationRepository:
    """
    予約通知（消費者・農家）に必要なデータのみを取得する参照専用リポジトリ
    """
    def open_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(resolve_db_path())
        conn.row_factory = sqlite3.Row
        return conn

    def fetch_notification_context(
        self,
        conn: sqlite3.Connection,
        reservation_id: int,
    ) -> Optional[Dict[str, Any]]:
        query = """
            SELECT 
                -- 消費者向けデータ
                c.email AS consumer_email,
                r.consumer_id,
                r.reservation_id,
                r.pickup_display,
                r.rice_subtotal,
                r.items_json,
                f.pickup_place_name,
                f.pickup_lat,
                f.pickup_lng,
                
                -- 農家向けデータ
                f.email AS farm_email
            FROM reservations r
            JOIN consumers c ON r.consumer_id = c.consumer_id
            JOIN farms f ON r.farm_id = f.farm_id
            WHERE r.reservation_id = ?
        """
        row = conn.execute(query, (reservation_id,)).fetchone()
        return dict(row) if row else None