from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
import sqlite3

from app_v2.db.core import resolve_db_path


# ============================================================
# Row 定義（FarmDetail 専用）
# ============================================================

@dataclass
class PublicFarmDetailRow:
    farm_id: int

    owner_last_name: str
    owner_first_name: str
    owner_address: str

    rice_variety_label: str

    price_5kg: int
    price_10kg: int
    price_25kg: int

    face_image_url: Optional[str]
    cover_image_url: Optional[str]
    pr_images_raw: Optional[str]
    pr_title: str
    pr_text: str

    pickup_slot_code: str
    pickup_place_name: str
    pickup_notes: str
    pickup_lat: float
    pickup_lng: float


# ============================================================
# Repository
# ============================================================

class PublicFarmDetailRepository:
    """
    FarmDetailPage 用 Repository（read-only）

    方針:
    - farms テーブルのみ参照
    - public_farms 一覧とは完全に独立
    - 公開中 & 予約受付中 farm のみ取得
    - 値は加工しない（決定責務は service にない）
    """

    def __init__(self) -> None:
        db_path = resolve_db_path()
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row

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

        # ---------- 数値だけ安全変換（既存仕様維持） ----------
        def to_int(v: object) -> int:
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

            price_5kg=to_int(row["price_5kg"]),
            price_10kg=to_int(row["price_10kg"]),
            price_25kg=to_int(row["price_25kg"]),

            # ★ 重要：空文字に変換しない（service 側判断に委ねる）
            face_image_url=row["face_image_url"],
            cover_image_url=row["cover_image_url"],

            pr_images_raw=row["pr_images_raw"],
            pr_title=str(row["pr_title"] or ""),
            pr_text=str(row["pr_text"] or ""),

            pickup_slot_code=str(row["pickup_slot_code"] or ""),
            pickup_place_name=str(row["pickup_place_name"] or ""),
            pickup_notes=str(row["pickup_notes"] or ""),
            pickup_lat=float(row["pickup_lat"]),
            pickup_lng=float(row["pickup_lng"]),
        )
