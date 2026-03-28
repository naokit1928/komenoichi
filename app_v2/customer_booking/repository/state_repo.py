from __future__ import annotations

import sqlite3
from typing import Any, Dict, Optional

from app_v2.db.core import resolve_db_path


class StateRepository:
    """
    Consumer の予約状態（pending / active）を取得する Read-only Repository
    """

    def open_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(resolve_db_path())
        conn.row_factory = sqlite3.Row
        return conn

    # ==================================================
    # PENDING
    # ==================================================
    def fetch_pending_reservation(
        self,
        *,
        consumer_id: int,
    ) -> Optional[Dict[str, Any]]:
        conn = self.open_connection()
        try:
            row = conn.execute(
                """
                SELECT reservation_id, farm_id
                FROM reservations
                WHERE consumer_id = ?
                  AND status = 'PENDING'
                ORDER BY reservation_id DESC
                LIMIT 1
                """,
                (consumer_id,),
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    # ==================================================
    # BASIC FETCH
    # ==================================================
    def fetch_reservation_basic(
        self,
        *,
        reservation_id: int,
    ) -> Optional[Dict[str, Any]]:
        conn = self.open_connection()
        try:
            row = conn.execute(
                """
                SELECT reservation_id, farm_id, status, event_start_at, event_end_at
                FROM reservations
                WHERE reservation_id = ?
                LIMIT 1
                """,
                (reservation_id,),
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    # ==================================================
    # ペナルティ情報の取得（ローリング計算）
    # ==================================================
    def fetch_penalty_info(self, consumer_id: int) -> Dict[str, int]:
        conn = self.open_connection()
        try:
            # 1. pardon フラグの取得
            try:
                c_row = conn.execute("SELECT no_show_pardon FROM consumers WHERE consumer_id = ?", (consumer_id,)).fetchone()
                pardon = int(c_row["no_show_pardon"]) if c_row and "no_show_pardon" in c_row.keys() and c_row["no_show_pardon"] is not None else 0
            except sqlite3.OperationalError:
                pardon = 0

            # 2. 過去1年間の no_show 件数を取得
            cnt_ns_row = conn.execute(
                """
                SELECT COUNT(*) as cnt
                FROM reservations
                WHERE consumer_id = ?
                  AND status = 'no_show'
                  AND created_at >= datetime('now', '-1 year')
                """,
                (consumer_id,)
            ).fetchone()
            ns_count = int(cnt_ns_row["cnt"]) if cnt_ns_row else 0

            # 3. ★追加: 過去1年間の cancelled 件数を取得
            cnt_cancel_row = conn.execute(
                """
                SELECT COUNT(*) as cnt
                FROM reservations
                WHERE consumer_id = ?
                  AND status = 'cancelled'
                  AND created_at >= datetime('now', '-1 year')
                """,
                (consumer_id,)
            ).fetchone()
            cancel_count = int(cnt_cancel_row["cnt"]) if cnt_cancel_row else 0

            return {
                "no_show_count": ns_count, 
                "no_show_pardon": pardon,
                "cancel_count": cancel_count
            }
        finally:
            conn.close()

    # ==================================================
    # 自己解除（Pardon）フラグの更新
    # ==================================================
    def update_pardon_flag(self, consumer_id: int, pardon_value: int) -> None:
        conn = self.open_connection()
        try:
            conn.execute("UPDATE consumers SET no_show_pardon = ? WHERE consumer_id = ?", (pardon_value, consumer_id))
            conn.commit()
        finally:
            conn.close()