import sqlite3
from typing import List, Dict, Any
from app_v2.db.core import resolve_db_path

DB_PATH = str(resolve_db_path())

class ConsumerDeleteRepository:
    def __init__(self, db_path: str = DB_PATH) -> None:
        self.db_path = db_path

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def get_confirmed_reservations(self, consumer_id: int) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT r.created_at, f.pickup_time
                FROM reservations r
                JOIN farms f ON r.farm_id = f.farm_id
                WHERE r.consumer_id = ? AND r.status = 'confirmed'
                """,
                (consumer_id,)
            )
            return [dict(row) for row in cur.fetchall()]

    def anonymize_consumer(self, consumer_id: int) -> None:
        with self._get_connection() as conn:
            cur = conn.cursor()
            fake_email = f"deleted_consumer_{consumer_id}@example.com"
            # スキーマ通り consumer_id で更新
            cur.execute(
                "UPDATE consumers SET email = ? WHERE consumer_id = ?",
                (fake_email, consumer_id)
            )
            conn.commit()