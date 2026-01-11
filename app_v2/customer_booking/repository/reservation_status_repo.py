from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Optional, Tuple

from app_v2.db.core import resolve_db_path


class ReservationStatusRepository:
    """
    Reservation status 専用 Repository

    責務:
    - status の取得
    - status の更新
    - reservation と consumer の紐づけ更新
    - confirm 時に必要な最小情報の取得
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

    def get_event_calc_source(
        self,
        *,
        reservation_id: int,
    ) -> Tuple[datetime, str]:
        """
        confirm 時に event_start_at / event_end_at を確定させるための
        最小限の source データを取得する。

        Returns:
            created_at (datetime): UTC 前提の datetime
            pickup_slot_code (str)
        """
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT created_at, pickup_slot_code
                FROM reservations
                WHERE reservation_id = ?
                """,
                (reservation_id,),
            )
            row = cur.fetchone()
            if row is None:
                raise ValueError("RESERVATION_NOT_FOUND")

            created_at_raw, pickup_slot_code = row

            # created_at は TEXT/DATETIME として保存されている前提
            # （既存仕様に合わせ、ここでは最小限の変換のみ行う）
            created_at = datetime.fromisoformat(
                created_at_raw.replace(" ", "T")
            )

            # tz-naive → UTC aware に正規化
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            return created_at, pickup_slot_code
        finally:
            conn.close()

    # -----------------------------
    # WRITE : status
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
        """
        既存互換用:
        status を confirmed にするだけの処理
        """
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

    def update_confirmed_with_event(
        self,
        *,
        reservation_id: int,
        event_start_at: datetime,
        event_end_at: datetime,
    ) -> None:
        """
        confirm 時に呼ばれる想定。

        - status を confirmed に更新
        - payment_succeeded_at をセット
        - event_start_at / event_end_at を確定保存

        ※ event_* は既存ロジックで計算済みの datetime をそのまま保存する
        """
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE reservations
                SET status = 'confirmed',
                    payment_succeeded_at = CURRENT_TIMESTAMP,
                    event_start_at = ?,
                    event_end_at   = ?
                WHERE reservation_id = ?
                """,
                (
                    event_start_at.isoformat(),
                    event_end_at.isoformat(),
                    reservation_id,
                ),
            )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    # -----------------------------
    # WRITE : consumer binding
    # -----------------------------
    def update_consumer_id(
        self,
        *,
        reservation_id: int,
        consumer_id: int,
    ) -> None:
        """
        reservation を consumer に正式に紐づける

        Magic Link consume 時など、
        「誰の予約か」を確定させるために使用する。
        """
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE reservations
                SET consumer_id = ?
                WHERE reservation_id = ?
                """,
                (consumer_id, reservation_id),
            )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
