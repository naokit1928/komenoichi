from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Any
import os
import sqlite3


def _get_db_path() -> str:
    env_path = os.getenv("APP_DB_PATH")
    return env_path if env_path else "app.db"


@dataclass
class PublicFarmDetailRow:
    farm_id: int

    owner_last_name: str
    owner_first_name: str
    owner_address: str

    rice_variety_label: str
    harvest_year: Optional[str]

    price_5kg: int
    price_10kg: int
    price_25kg: int

    face_image_url: str
    cover_image_url: str
    pr_images_raw: Optional[str]
    pr_title: str
    pr_text: str

    pickup_slot_code: str
    pickup_place_name: str
    pickup_notes: str
    pickup_lat: float
    pickup_lng: float


class PublicFarmDetailRepository:
    """
    FarmDetailPage 用 Repository（Phase2 / 新DB完全対応）

    - users / owner_user_id 完全排除
    - farms 単体取得
    - farm_id 主キー固定
    """

    def __init__(self, db: Any | None = None) -> None:
        conn = sqlite3.connect(_get_db_path())
        conn.row_factory = sqlite3.Row
        self.conn = conn

    def fetch_publishable_farm_detail(
        self,
        farm_id: int,
    ) -> Optional[PublicFarmDetailRow]:

        sql = """
            SELECT
                f.farm_id               AS farm_id,

                f.last_name             AS owner_last_name,
                f.first_name            AS owner_first_name,
                f.address               AS owner_address,

                f.rice_variety_label    AS rice_variety_label,
                f.harvest_year          AS harvest_year,

                f.price_5kg             AS price_5kg,
                f.price_10kg            AS price_10kg,
                f.price_25kg            AS price_25kg,

                f.face_image_url        AS face_image_url,
                f.cover_image_url       AS cover_image_url,
                f.pr_images_json        AS pr_images_raw,
                f.pr_title              AS pr_title,
                f.pr_text               AS pr_text,

                f.pickup_time           AS pickup_slot_code,
                f.pickup_place_name     AS pickup_place_name,
                f.pickup_notes          AS pickup_notes,
                f.pickup_lat            AS pickup_lat,
                f.pickup_lng            AS pickup_lng
            FROM farms AS f
            WHERE
                f.farm_id = ?
                AND f.active_flag = 1
                AND f.is_accepting_reservations = 1
        """

        cur = self.conn.execute(sql, (farm_id,))
        row = cur.fetchone()
        if row is None:
            return None

        # ---- NULL → 0 fallback ----
        def to_int_or_zero(v: object) -> int:
            if v is None:
                return 0
            try:
                return int(v)
            except Exception:
                return 0

        return PublicFarmDetailRow(
            farm_id=int(row["farm_id"]),

            owner_last_name=str(row["owner_last_name"] or ""),
            owner_first_name=str(row["owner_first_name"] or ""),
            owner_address=str(row["owner_address"] or ""),

            rice_variety_label=str(row["rice_variety_label"] or ""),
            harvest_year=row["harvest_year"],

            price_5kg=to_int_or_zero(row["price_5kg"]),
            price_10kg=to_int_or_zero(row["price_10kg"]),
            price_25kg=to_int_or_zero(row["price_25kg"]),

            face_image_url=str(row["face_image_url"] or ""),
            cover_image_url=str(row["cover_image_url"] or ""),
            pr_images_raw=row["pr_images_raw"],
            pr_title=str(row["pr_title"] or ""),
            pr_text=str(row["pr_text"] or ""),

            pickup_slot_code=str(row["pickup_slot_code"] or ""),
            pickup_place_name=str(row["pickup_place_name"] or ""),
            pickup_notes=str(row["pickup_notes"] or ""),
            pickup_lat=float(row["pickup_lat"]),
            pickup_lng=float(row["pickup_lng"]),
        )
