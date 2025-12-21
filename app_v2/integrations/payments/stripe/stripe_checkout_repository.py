from __future__ import annotations

import sqlite3
from typing import Any, Dict, Optional

from app_v2.db.core import resolve_db_path


class StripeCheckoutRepository:
    """
    Stripe Checkout 用 Repository（最終形）

    責務：
      - reservations テーブルの取得・更新のみ
      - 業務ロジックは一切持たない
    """

    # ==================================================
    # DB connection
    # ==================================================
    def open_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(resolve_db_path())
        conn.row_factory = sqlite3.Row
        return conn

    # ==================================================
    # Fetch
    # ==================================================
    def fetch_reservation_by_id(
        self, conn: sqlite3.Connection, reservation_id: int
    ) -> Optional[Dict[str, Any]]:
        row = conn.execute(
            "SELECT * FROM reservations WHERE reservation_id = ?",
            (reservation_id,),
        ).fetchone()
        return dict(row) if row else None

    # ==================================================
    # Update
    # ==================================================
    def update_checkout_created(
        self,
        conn: sqlite3.Connection,
        *,
        reservation_id: int,
        payment_intent_id: Optional[str],
    ) -> Dict[str, Any]:
        conn.execute(
            """
            UPDATE reservations
               SET payment_intent_id = ?,
                   payment_status = 'checkout_created'
             WHERE reservation_id = ?
            """,
            (payment_intent_id, reservation_id),
        )
        conn.commit()

        row = conn.execute(
            "SELECT * FROM reservations WHERE reservation_id = ?",
            (reservation_id,),
        ).fetchone()

        if not row:
            raise RuntimeError("Reservation disappeared after update")

        return dict(row)
