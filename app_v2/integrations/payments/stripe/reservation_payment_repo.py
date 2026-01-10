from __future__ import annotations

import sqlite3
from typing import Any, Dict, Optional

from app_v2.db.core import resolve_db_path


class ReservationPaymentRepository:

    """

    責務：
      - reservations / consumers テーブルへの CRUD
      - DB接続と commit 管理
      - 状態遷移ロジックは一切持たない
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
        self,
        conn: sqlite3.Connection,
        reservation_id: int,
    ) -> Optional[Dict[str, Any]]:
        row = conn.execute(
            "SELECT * FROM reservations WHERE reservation_id = ?",
            (reservation_id,),
        ).fetchone()
        return dict(row) if row else None

    def fetch_reservation_by_payment_intent(
        self,
        conn: sqlite3.Connection,
        payment_intent_id: str,
    ) -> Optional[Dict[str, Any]]:
        row = conn.execute(
            "SELECT * FROM reservations WHERE payment_intent_id = ?",
            (payment_intent_id,),
        ).fetchone()
        return dict(row) if row else None

    def fetch_consumer_by_line_id(
        self,
        conn: sqlite3.Connection,
        line_consumer_id: str,
    ) -> Optional[Dict[str, Any]]:
        row = conn.execute(
            """
            SELECT *
            FROM consumers
            WHERE line_consumer_id = ?
            LIMIT 1
            """,
            (line_consumer_id,),
        ).fetchone()
        return dict(row) if row else None

    # ==================================================
    # Update
    # ==================================================
    def update_reservation_fields(
        self,
        conn: sqlite3.Connection,
        *,
        reservation_id: int,
        **fields: Any,
    ) -> None:
        if not fields:
            return

        cols = ", ".join(f"{k} = ?" for k in fields.keys())
        values = list(fields.values()) + [reservation_id]

        conn.execute(
            f"UPDATE reservations SET {cols} WHERE reservation_id = ?",
            values,
        )
        conn.commit()

    def attach_consumer(
        self,
        conn: sqlite3.Connection,
        *,
        reservation_id: int,
        consumer_id: int,
    ) -> None:
        """
        reservation を consumer に紐づける（正式）
        """
        conn.execute(
            """
            UPDATE reservations
            SET consumer_id = ?
            WHERE reservation_id = ?
            """,
            (consumer_id, reservation_id),
        )
        conn.commit()
