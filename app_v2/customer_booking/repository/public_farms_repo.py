from __future__ import annotations

from dataclasses import dataclass
from typing import List
import sqlite3

from app_v2.db.core import resolve_db_path


# ============================================================
# Row DTO（DB → Service の境界）
# ============================================================

@dataclass
class PublicFarmRow:
    farm_id: int

    owner_last_name: str
    owner_first_name: str
    owner_address: str

    price_10kg: int

    face_image_url: str
    pr_title: str
    pr_images_raw: str | None

    pickup_slot_code: str
    pickup_lat: float
    pickup_lng: float


# ============================================================
# Repository
# ============================================================

class PublicFarmsRepository:
    """
    Public Page 用 Repository（read-only）

    - DB 接続は resolve_db_path() に一本化
    - SQL 以外のロジックを一切持たない
    """

    def __init__(self) -> None:
        db_path = resolve_db_path()
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row

    # --------------------------------------------------------
    # 公開 & 予約受付中の農家一覧（ページング前）
    # --------------------------------------------------------
    def fetch_publishable_farms(self) -> List[PublicFarmRow]:
        sql = """
            SELECT
                f.farm_id            AS farm_id,

                f.last_name          AS owner_last_name,
                f.first_name         AS owner_first_name,
                f.address            AS owner_address,

                f.price_10kg         AS price_10kg,
                f.pickup_time        AS pickup_slot_code,
                f.pickup_lat         AS pickup_lat,
                f.pickup_lng         AS pickup_lng,

                f.face_image_url     AS face_image_url,
                f.pr_title           AS pr_title,
                f.pr_images_json     AS pr_images_raw
            FROM farms AS f
            WHERE
                f.active_flag = 1
                AND f.is_accepting_reservations = 1
        """

        rows = self.conn.execute(sql).fetchall()
        return [_row_to_entity(r) for r in rows]

    # --------------------------------------------------------
    # 地図用：バウンディングボックス検索
    # --------------------------------------------------------
    def fetch_publishable_farms_in_bounds(
        self,
        min_lat: float,
        max_lat: float,
        min_lng: float,
        max_lng: float,
        limit: int,
    ) -> List[PublicFarmRow]:

        sql = """
            SELECT
                f.farm_id            AS farm_id,

                f.last_name          AS owner_last_name,
                f.first_name         AS owner_first_name,
                f.address            AS owner_address,

                f.price_10kg         AS price_10kg,
                f.pickup_time        AS pickup_slot_code,
                f.pickup_lat         AS pickup_lat,
                f.pickup_lng         AS pickup_lng,

                f.face_image_url     AS face_image_url,
                f.pr_title           AS pr_title,
                f.pr_images_json     AS pr_images_raw
            FROM farms AS f
            WHERE
                f.active_flag = 1
                AND f.is_accepting_reservations = 1
                AND f.pickup_lat IS NOT NULL
                AND f.pickup_lng IS NOT NULL
                AND f.pickup_lat BETWEEN ? AND ?
                AND f.pickup_lng BETWEEN ? AND ?
            ORDER BY f.farm_id
            LIMIT ?
        """

        rows = self.conn.execute(
            sql,
            (min_lat, max_lat, min_lng, max_lng, limit),
        ).fetchall()

        return [_row_to_entity(r) for r in rows]


# ============================================================
# 内部ヘルパー（repo 専用）
# ============================================================

def _row_to_entity(r: sqlite3.Row) -> PublicFarmRow:
    return PublicFarmRow(
        farm_id=int(r["farm_id"]),
        owner_last_name=str(r["owner_last_name"] or ""),
        owner_first_name=str(r["owner_first_name"] or ""),
        owner_address=str(r["owner_address"] or ""),
        price_10kg=int(r["price_10kg"]),
        pickup_slot_code=str(r["pickup_slot_code"]),
        pickup_lat=float(r["pickup_lat"]),
        pickup_lng=float(r["pickup_lng"]),
        face_image_url=str(r["face_image_url"] or ""),
        pr_title=str(r["pr_title"] or ""),
        pr_images_raw=r["pr_images_raw"],
    )
