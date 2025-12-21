import sqlite3
from dataclasses import dataclass
from typing import List, Optional


from app_v2.db.core import resolve_db_path

DB_PATH = str(resolve_db_path())



@dataclass
class FarmRecord:
    farm_id: int
    pickup_time: Optional[str]
    active_flag: int


@dataclass
class ReservationRecord:
    # 旧 id → 新 reservation_id をそのまま id として保持（意味は同一）
    id: int
    consumer_id: int
    farm_id: int
    pickup_slot_code: Optional[str]
    created_at: Optional[str]
    items_json: Optional[str]
    rice_subtotal: Optional[int]
    status: Optional[str]


class ReservationExpandedRepository:
    """
    ExportBluePrint.md に沿って、Export 用に必要な生データだけを DB から取得する層。

    - farms.pickup_time （例: "SAT_10_11"）
    - farms.active_flag （BAN 判定用）
    - reservations.*   （items_json / rice_subtotal / created_at / status など）

    Phase2:
    - 新 reservations テーブル（reservation_id / consumer_id 前提）に対応
    - ロジック・返却構造は一切変更しない
    """

    def __init__(self, db_path: str = DB_PATH) -> None:
        self.db_path = db_path

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def get_farm(self, farm_id: int) -> Optional[FarmRecord]:
        """
        対象農家の pickup_time / active_flag を取得。
        見つからなければ None。
        """
        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT
                    farm_id     AS farm_id,
                    pickup_time AS pickup_time,
                    active_flag AS active_flag
                FROM farms
                WHERE farm_id = ?
                """,
                (farm_id,),
            )
            row = cur.fetchone()
            if row is None:
                return None

            return FarmRecord(
                farm_id=int(row["farm_id"]),
                pickup_time=row["pickup_time"],
                active_flag=int(row["active_flag"])
                if row["active_flag"] is not None
                else 1,
            )

    def get_confirmed_reservations_for_farm(
        self,
        farm_id: int,
        pickup_slot_code: Optional[str],
    ) -> List[ReservationRecord]:
        """
        指定された farm_id / pickup_slot_code に紐づく confirmed 予約をすべて取得する。

        週の判定（今週か来週か）は Service 層で created_at から算出するため、
        ここでは日付フィルタは一切行わない。
        """
        if pickup_slot_code is None:
            return []

        with self._get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT
                    reservation_id,
                    consumer_id,
                    farm_id,
                    pickup_slot_code,
                    created_at,
                    items_json,
                    rice_subtotal,
                    status
                FROM reservations
                WHERE farm_id = ?
                  AND pickup_slot_code = ?
                  AND status = 'confirmed'
                ORDER BY reservation_id ASC
                """,
                (farm_id, pickup_slot_code),
            )
            rows = cur.fetchall()

        results: List[ReservationRecord] = []
        for row in rows:
            results.append(
                ReservationRecord(
                    id=int(row["reservation_id"]),
                    consumer_id=int(row["consumer_id"]),
                    farm_id=int(row["farm_id"]),
                    pickup_slot_code=row["pickup_slot_code"],
                    created_at=row["created_at"],
                    items_json=row["items_json"],
                    rice_subtotal=row["rice_subtotal"],
                    status=row["status"],
                )
            )
        return results
