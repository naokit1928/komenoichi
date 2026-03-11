import sqlite3
from typing import List, Dict, Any
from app_v2.db.core import resolve_db_path

DB_PATH = str(resolve_db_path())

class FarmerDeleteRepository:
    def __init__(self, db_path: str = DB_PATH) -> None:
        self.db_path = db_path

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def get_confirmed_reservations(self, farm_id: int) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT r.created_at, f.pickup_time
                FROM reservations r
                JOIN farms f ON r.farm_id = f.farm_id
                WHERE r.farm_id = ? AND r.status = 'confirmed'
                """,
                (farm_id,)
            )
            return [dict(row) for row in cur.fetchall()]

    def deactivate_farm_and_anonymize_farmer(self, farm_id: int) -> None:
        with self._get_connection() as conn:
            cur = conn.cursor()
            fake_email = f"deleted_farm_{farm_id}@example.com"
            # スキーマ通り farms テーブルの farm_id を対象に、非公開化と匿名化を同時に実行
            cur.execute(
                """
                UPDATE farms 
                SET active_flag = 0, email = ? 
                WHERE farm_id = ?
                """,
                (fake_email, farm_id)
            )
            conn.commit()