# app_v2/customer_booking/repository/reservation_status_repo.py
from __future__ import annotations

import sqlite3
from typing import Optional

from app_v2.db.core import resolve_db_path


class ReservationStatusRepository:
    """
    Reservation status 専用 Repository

    責務:
    - status の取得
    - status の更新
    - トランザクション管理

    業務判断（どの遷移が正しいか）は Service に委ねる。
    """

    def __init__(self) -> None:
        self.db_path = resolve_db_path()

    # -----------------------------
    # READ
    # -----------------------------
    def get_current_status(self, reservation_id: int) -> Optional[str]:
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT status
                FROM reservations
                WHERE reservation_id = ?
                """,
                (reservation_id,),
            )
            row = cur.fetchone()
            if row is None:
                return None
            return row[0]
        finally:
            conn.close()

    # -----------------------------
    # WRITE
    # -----------------------------
    def update_status_cancelled(self, reservation_id: int) -> None:
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE reservations
                SET status = 'cancelled'
                WHERE reservation_id = ?
                """,
                (reservation_id,),
            )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def update_status_confirmed(self, reservation_id: int) -> None:
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE reservations
                SET status = 'confirmed',
                    payment_succeeded_at = CURRENT_TIMESTAMP
                WHERE reservation_id = ?
                """,
                (reservation_id,),
            )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
