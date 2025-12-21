from __future__ import annotations

import sqlite3
from typing import Any, Dict, Optional, Tuple

from app_v2.db.core import resolve_db_path


class NotificationContextRepository:
    """
    Notification 用 Context 取得専用 Repository

    責務:
    - job に紐づく reservation / consumer / farm を DB から取得
    - SQL / JOIN / sqlite3 を完全に隠蔽
    - Service には dict（意味のある構造）だけ返す

    非責務:
    - 通知種別の判断
    - メッセージ生成
    - LINE 送信
    """

    def __init__(self, db_path: Optional[str] = None) -> None:
        self._db_path = db_path or resolve_db_path()

    # -------------------------------------------------
    # Public API
    # -------------------------------------------------

    def fetch_context_sources(
        self, reservation_id: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """
        通知 Context 構築に必要な元データを取得する。

        Returns:
            (reservation, user, farm)
            いずれか欠けていれば (None, None, None)
        """
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        try:
            reservation, user = self._fetch_reservation_and_user(
                conn, reservation_id
            )
            if not reservation or not user:
                return None, None, None

            farm = self._fetch_farm(conn, reservation["farm_id"])
            if not farm:
                return None, None, None

            return reservation, user, farm
        finally:
            conn.close()

    # -------------------------------------------------
    # Internal DB helpers
    # -------------------------------------------------

    def _fetch_reservation_and_user(
        self, conn: sqlite3.Connection, reservation_id: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        sql = """
        SELECT r.*, c.consumer_id, c.line_consumer_id
        FROM reservations r
        JOIN consumers c ON r.consumer_id = c.consumer_id
        WHERE r.reservation_id = ?
        """
        row = conn.execute(sql, (reservation_id,)).fetchone()
        if not row:
            return None, None

        r = dict(row)

        reservation = {k: r[k] for k in r if k != "line_consumer_id"}
        user = {
            "consumer_id": r.get("consumer_id"),
            "line_consumer_id": r.get("line_consumer_id"),
        }
        return reservation, user

    def _fetch_farm(
        self, conn: sqlite3.Connection, farm_id: Any
    ) -> Optional[Dict[str, Any]]:
        try:
            fid = int(farm_id)
        except Exception:
            return None

        row = conn.execute(
            "SELECT * FROM farms WHERE farm_id = ?", (fid,)
        ).fetchone()
        return dict(row) if row else None
