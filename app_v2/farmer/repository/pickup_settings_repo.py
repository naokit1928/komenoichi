from __future__ import annotations

from typing import Optional, Dict, Any
import sqlite3
from datetime import datetime

from app_v2.db.core import resolve_db_path


class PickupSettingsRepository:
    """
    Pickup Settings（受け渡し場所・受け渡し時間）専用の DB アクセス層（sqlite3版）。

    原則:
    - DB パスは resolve_db_path() のみを使用
    - sqlite3 / SQL / commit / rollback はここに閉じ込める
    """

    def __init__(self, db: Any = None) -> None:
        # db 引数は互換性のためだけに受け取るが使わない
        self.conn = sqlite3.connect(resolve_db_path())
        self.conn.row_factory = sqlite3.Row

    # ---------------------------------------------------------
    # Farm（pickup 設定）の取得
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
    # Pickup 情報の更新
    # ---------------------------------------------------------

    def update_pickup_settings(
        self,
        farm_id: int,
        *,
        pickup_lat: float,
        pickup_lng: float,
        pickup_place_name: str,
        pickup_notes: Optional[str],
        pickup_time: str,
    ) -> None:
        self.conn.execute(
            """
            UPDATE farms
            SET
                pickup_lat = ?,
                pickup_lng = ?,
                pickup_place_name = ?,
                pickup_notes = ?,
                pickup_time = ?
            WHERE farm_id = ?
            """,
            (
                pickup_lat,
                pickup_lng,
                pickup_place_name,
                pickup_notes,
                pickup_time,
                farm_id,
            ),
        )

    # ---------------------------------------------------------
    # トランザクション操作
    # ---------------------------------------------------------

    def commit(self) -> None:
        self.conn.commit()

    def rollback(self) -> None:
        self.conn.rollback()
