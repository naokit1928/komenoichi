from __future__ import annotations

from typing import Optional, Dict, Any
import sqlite3

class PickupSettingsRepository:
    """
    Pickup Settings 専用の DB アクセス層。
    コネクションは外部から注入される前提で動作する。
    """

    def __init__(self, conn: sqlite3.Connection) -> None:
        self.conn = conn

    # ---------------------------------------------------------
    # 取得
    # ---------------------------------------------------------

    def fetch_farm_pickup(self, farm_id: int) -> Optional[Dict[str, Any]]:
        cur = self.conn.execute(
            """
            SELECT
                farm_id,
                lat AS owner_lat,
                lng AS owner_lng,
                pickup_lat,
                pickup_lng,
                pickup_place_name,
                pickup_notes,
                pickup_time
            FROM farms
            WHERE farm_id = ?
            LIMIT 1
            """,
            (farm_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None

    # ---------------------------------------------------------
    # 部分更新 (PATCH対応)
    # ---------------------------------------------------------

    def update_pickup_settings_partial(
        self,
        farm_id: int,
        pickup_lat: Optional[float] = None,
        pickup_lng: Optional[float] = None,
        pickup_place_name: Optional[str] = None,
        pickup_notes: Optional[str] = None,
        pickup_time: Optional[str] = None,
    ) -> None:
        """
        渡された値(None以外)のみを更新する。
        """
        set_clauses = []
        params = []

        if pickup_lat is not None:
            set_clauses.append("pickup_lat = ?")
            params.append(pickup_lat)
        
        if pickup_lng is not None:
            set_clauses.append("pickup_lng = ?")
            params.append(pickup_lng)
            
        if pickup_place_name is not None:
            set_clauses.append("pickup_place_name = ?")
            params.append(pickup_place_name)
            
        if pickup_notes is not None:
            set_clauses.append("pickup_notes = ?")
            params.append(pickup_notes)
            
        if pickup_time is not None:
            set_clauses.append("pickup_time = ?")
            params.append(pickup_time)

        # 更新対象がなければ何もしない
        if not set_clauses:
            return

        sql = f"UPDATE farms SET {', '.join(set_clauses)} WHERE farm_id = ?"
        params.append(farm_id)

        self.conn.execute(sql, params)