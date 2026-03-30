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
            # 大文字小文字や空白の揺れを吸収して検索
            row = conn.execute("SELECT * FROM consumers WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))", (email,)).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def find_consumer_by_reservation_id(self, reservation_id: int) -> Dict[str, Any]:
        conn = self.open_connection()
        try:
            # 1. まず予約データが存在するか確認
            r_row = conn.execute("SELECT consumer_id FROM reservations WHERE reservation_id = ?", (reservation_id,)).fetchone()
            if not r_row:
                return {"_error": "RESERVATION_NOT_FOUND"}
            
            consumer_id = r_row["consumer_id"]
            if not consumer_id:
                return {"_error": "NO_CONSUMER_LINKED"}

            # 2. 消費者データを引く
            c_row = conn.execute("SELECT * FROM consumers WHERE consumer_id = ?", (consumer_id,)).fetchone()
            if not c_row:
                return {"_error": "CONSUMER_NOT_FOUND"}
                
            return dict(c_row)
        finally:
            conn.close()

    def get_penalty_history(self, consumer_id: int) -> List[Dict[str, Any]]:
        conn = self.open_connection()
        try:
            rows = conn.execute(
                """
                SELECT r.reservation_id, r.status, r.created_at, f.last_name || ' ' || f.first_name as farm_name
                FROM reservations r
                JOIN farms f ON r.farm_id = f.farm_id
                WHERE r.consumer_id = ?
                  AND r.status IN ('no_show', 'cancelled')
                  AND r.created_at >= datetime('now', '-1 year')
                ORDER BY r.created_at DESC
                """, (consumer_id,)
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def reset_pardon(self, consumer_id: int) -> None:
        conn = self.open_connection()
        try:
            conn.execute("UPDATE consumers SET no_show_pardon = 0 WHERE consumer_id = ?", (consumer_id,))
            conn.commit()
        finally:
            conn.close()

    def update_reservation_status(self, reservation_id: int, new_status: str) -> None:
        conn = self.open_connection()
        try:
            conn.execute("UPDATE reservations SET status = ? WHERE reservation_id = ?", (new_status, reservation_id))
            conn.commit()
        finally:
            conn.close()