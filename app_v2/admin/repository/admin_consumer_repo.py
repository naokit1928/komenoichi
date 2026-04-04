from __future__ import annotations

import sqlite3
from typing import Any, Dict, List, Optional

from app_v2.db.core import resolve_db_path


class AdminConsumerRepository:
    def open_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(resolve_db_path())
        conn.row_factory = sqlite3.Row
        return conn

    def find_consumer_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        conn = self.open_connection()
        try:
            row = conn.execute(
                "SELECT * FROM consumers WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))",
                (email,)
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def find_consumer_by_reservation_id(self, reservation_id: int) -> Dict[str, Any]:
        conn = self.open_connection()
        try:
            r_row = conn.execute(
                "SELECT consumer_id FROM reservations WHERE reservation_id = ?",
                (reservation_id,)
            ).fetchone()
            if not r_row:
                return {"_error": "RESERVATION_NOT_FOUND"}

            consumer_id = r_row["consumer_id"]
            if not consumer_id:
                return {"_error": "NO_CONSUMER_LINKED"}

            c_row = conn.execute(
                "SELECT * FROM consumers WHERE consumer_id = ?",
                (consumer_id,)
            ).fetchone()
            if not c_row:
                return {"_error": "CONSUMER_NOT_FOUND"}

            return dict(c_row)
        finally:
            conn.close()

    def get_penalty_history(self, consumer_id: int) -> List[Dict[str, Any]]:
        """
        ペナルティ対象の記録のみを返す（過去1年間）。

        対象:
          - status = 'no_show'（農家からのノーショー報告）
          - status = 'cancelled' AND is_late_cancel = 1（受け渡し3時間以内のキャンセル）

        通常キャンセル（is_late_cancel = 0）は表示しない。
        """
        conn = self.open_connection()
        try:
            rows = conn.execute(
                """
                SELECT
                    r.reservation_id,
                    r.status,
                    r.is_late_cancel,
                    r.created_at,
                    f.last_name || ' ' || f.first_name AS farm_name
                FROM reservations r
                JOIN farms f ON r.farm_id = f.farm_id
                WHERE r.consumer_id = ?
                  AND r.created_at >= datetime('now', '-1 year')
                  AND (
                    r.status = 'no_show'
                    OR (r.status = 'cancelled' AND r.is_late_cancel = 1)
                  )
                ORDER BY r.created_at DESC
                """,
                (consumer_id,)
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def update_reservation_status(self, reservation_id: int, new_status: str) -> None:
        """no_show → confirmed / cancelled などのステータス強制変更（案A: 記録を書き換える）"""
        conn = self.open_connection()
        try:
            conn.execute(
                "UPDATE reservations SET status = ? WHERE reservation_id = ?",
                (new_status, reservation_id)
            )
            conn.commit()
        finally:
            conn.close()

    def clear_late_cancel_flag(self, reservation_id: int) -> None:
        """
        is_late_cancel フラグを 0 に戻す（案A: 遅延キャンセルの記録を解除）

        status は cancelled のまま残す。
        ペナルティカウントから外れるだけ（記録自体は残る）。
        """
        conn = self.open_connection()
        try:
            conn.execute(
                "UPDATE reservations SET is_late_cancel = 0 WHERE reservation_id = ?",
                (reservation_id,)
            )
            conn.commit()
        finally:
            conn.close()