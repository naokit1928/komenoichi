from __future__ import annotations

import sqlite3
from typing import Any, Dict, Optional

from app_v2.db.core import resolve_db_path


class StripeWebhookRepository:
    """
    Stripe Webhook 用 Repository（検索専用）

    責務：
      - reservations の検索のみ
      - 状態遷移・判断は一切持たない
    """

    def open_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(resolve_db_path())
        conn.row_factory = sqlite3.Row
        return conn

    # -------------------------
    # Fetch
    # -------------------------
    def fetch_reservation_by_id(
        self, conn: sqlite3.Connection, reservation_id: int
    ) -> Optional[Dict[str, Any]]:
        row = conn.execute(
            "SELECT * FROM reservations WHERE reservation_id = ?",
            (reservation_id,),
        ).fetchone()
        return dict(row) if row else None

    def fetch_reservation_by_payment_intent(
        self, conn: sqlite3.Connection, payment_intent_id: str
    ) -> Optional[Dict[str, Any]]:
        row = conn.execute(
            "SELECT * FROM reservations WHERE payment_intent_id = ?",
            (payment_intent_id,),
        ).fetchone()
        return dict(row) if row else None
