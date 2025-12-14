# app_v2/farmer/repository/pickup_settings_repo.py
from __future__ import annotations

from typing import Optional, Dict, Any
import sqlite3
import os
from datetime import datetime  # ← 追加


def _get_db_path() -> str:
    """
    DB ファイルパスを返す。
    APP_DB_PATH 環境変数があればそれを優先。
    """
    env_path = os.getenv("APP_DB_PATH")
    return env_path if env_path else "app.db"


class PickupSettingsRepository:
    """
    Pickup Settings（受け渡し場所・受け渡し時間）専用の DB アクセス層（sqlite3版）。

    すべて sqlite3 直叩きに変更し、
    SQLAlchemy Session への依存を完全に排除した。
    """

    def __init__(self, db: Any = None) -> None:
        # db 引数は互換性のためだけに受け取るが使わない
        self.conn = sqlite3.connect(_get_db_path())
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
    # 予約数カウント
    # ---------------------------------------------------------

    def count_active_reservations(self, farm_id: int) -> int:
        """
        旧仕様：farm 全体の confirmed 件数（今はほぼ未使用）
        """
        cur = self.conn.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM reservations
            WHERE farm_id = ?
              AND status = 'confirmed'
            """,
            (farm_id,),
        )
        row = cur.fetchone()
        return int(row["cnt"]) if row else 0

    def count_confirmed_for_slot(
        self,
        farm_id: int,
        pickup_slot: str,
        this_week_start: datetime,
    ) -> int:
        """
        今週のスロットに属する confirmed のみをカウント。
        - pickup_slot_code が一致
        - created_at >= this_week_start（今週扱い）
        """
        # sqlite3 は datetime をそのまま受け取れないので文字列に変換する
        if isinstance(this_week_start, datetime):
            this_week_start_str = this_week_start.strftime("%Y-%m-%d %H:%M:%S")
        else:
            this_week_start_str = str(this_week_start)

        cur = self.conn.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM reservations
            WHERE farm_id = ?
              AND status = 'confirmed'
              AND pickup_slot_code = ?
              AND created_at >= ?
            """,
            (farm_id, pickup_slot, this_week_start_str),
        )
        row = cur.fetchone()
        return int(row["cnt"]) if row else 0

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
