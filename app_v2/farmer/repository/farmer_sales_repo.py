import sqlite3
from dataclasses import dataclass
from typing import List, Optional
from app_v2.db.core import resolve_db_path

DB_PATH = str(resolve_db_path())

@dataclass
class SalesReservationRecord:
    id: int
    farm_id: int
    pickup_slot_code: Optional[str]
    created_at: Optional[str]
    items_json: Optional[str]
    rice_subtotal: Optional[int]

class FarmerSalesRepository:
    def __init__(self, db_path: str = DB_PATH) -> None:
        self.db_path = db_path

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def get_confirmed_reservations_around_month(
        self, farm_id: int, target_year: int, target_month: int
    ) -> List[SalesReservationRecord]:
        """
        指定された月の予約を確実に取得するため、作成日(created_at)ベースで
        前月〜翌月の少し広めの期間の confirmed 予約を取得する。
        """
        # SQLiteの文字列比較で大まかに絞るため、YYYY-MM の文字列を作る
        # (厳密な絞り込みはService側のUTC/JST変換後に行う)
        prev_month = target_month - 1 if target_month > 1 else 12
        prev_year = target_year if target_month > 1 else target_year - 1
        
        next_month = target_month + 1 if target_month < 12 else 1
        next_year = target_year if target_month < 12 else target_year + 1

        start_str = f"{prev_year:04d}-{prev_month:02d}-01"
        end_str = f"{next_year:04d}-{next_month:02d}-31"

        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT
                    reservation_id,
                    farm_id,
                    pickup_slot_code,
                    created_at,
                    items_json,
                    rice_subtotal
                FROM reservations
                WHERE farm_id = ?
                  AND status = 'confirmed'
                  AND created_at >= ?
                  AND created_at <= ?
                ORDER BY created_at ASC
                """,
                (farm_id, start_str, end_str),
            )
            rows = cur.fetchall()

        results = []
        for row in rows:
            results.append(
                SalesReservationRecord(
                    id=int(row["reservation_id"]),
                    farm_id=int(row["farm_id"]),
                    pickup_slot_code=row["pickup_slot_code"],
                    created_at=row["created_at"],
                    items_json=row["items_json"],
                    rice_subtotal=row["rice_subtotal"]
                )
            )
        return results