from __future__ import annotations

import sqlite3
from typing import Any, Dict, Optional, Tuple

from app_v2.db.core import resolve_db_path


class NotificationDataRepository:
    """
    NotificationScheduler 専用の読み取り Repository（V2 完成形）

    責務：
      - reservation + consumer（LINE ID 含む）の取得
      - farm の取得
      - DB 接続は resolve_db_path() に一本化

    制約：
      - 書き込みは一切行わない
      - notification_jobs には触らない
    """

    # ==================================================
    # DB connection
    # ==================================================
    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(resolve_db_path())
        conn.row_factory = sqlite3.Row
        return conn

    # ==================================================
    # Fetch
    # ==================================================
    def fetch_reservation_and_consumer(
        self, reservation_id: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """
        reservation + consumer をまとめて取得する。
        """
        sql = """
        SELECT
            r.*,
            c.consumer_id AS consumer_id,
            c.line_consumer_id AS line_consumer_id
        FROM reservations r
        JOIN consumers c ON r.consumer_id = c.consumer_id
        WHERE r.reservation_id = ?
        """

        with self._get_conn() as conn:
            row = conn.execute(sql, (reservation_id,)).fetchone()
            if not row:
                return None, None

            data = dict(row)

            reservation = {k: v for k, v in data.items() if k not in ("line_consumer_id",)}
            consumer = {
                "consumer_id": data.get("consumer_id"),
                "line_consumer_id": data.get("line_consumer_id"),
            }
            return reservation, consumer

    def fetch_farm(self, farm_id: Any) -> Optional[Dict[str, Any]]:
        """
        farm を取得する。
        """
        try:
            fid = int(farm_id)
        except Exception:
            return None

        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM farms WHERE farm_id = ?",
                (fid,),
            ).fetchone()
            return dict(row) if row else None
