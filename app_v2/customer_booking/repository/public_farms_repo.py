from __future__ import annotations

from dataclasses import dataclass
from typing import List, Any
import sqlite3
import os


def _get_db_path() -> str:
    env_path = os.getenv("APP_DB_PATH")
    return env_path if env_path else "app.db"


@dataclass
class PublicFarmRow:
    farm_id: int
    owner_user_id: int

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


class PublicFarmsRepository:
    """
    公開農家一覧を取得する Repository（sqlite3版）
    """

    def __init__(self, db: Any = None) -> None:
        # db 引数は互換性のためだけに受け取るが無視する
        self.conn = sqlite3.connect(_get_db_path())
        self.conn.row_factory = sqlite3.Row

    def fetch_publishable_farms(self) -> List[PublicFarmRow]:
        """
        一覧・距離ソート用に「公開中かつ予約受付中」の農家をすべて取得する。
        """
        sql = """
            SELECT
                f.id                   AS farm_id,
                f.owner_user_id        AS owner_user_id,

                u.last_name            AS owner_last_name,
                u.first_name           AS owner_first_name,
                u.address              AS owner_address,

                f.price_10kg           AS price_10kg,
                f.pickup_time          AS pickup_slot_code,
                f.pickup_lat           AS pickup_lat,
                f.pickup_lng           AS pickup_lng,

                fp.face_image_url      AS face_image_url,
                fp.pr_title            AS pr_title,
                fp.pr_images_json      AS pr_images_raw
            FROM farms AS f
            JOIN users AS u
              ON u.id = f.owner_user_id
            LEFT JOIN farmer_profiles AS fp
              ON fp.farm_id = f.id
            WHERE
              f.active_flag = 1
              AND f.is_accepting_reservations = 1
        """

        cur = self.conn.execute(sql)
        rows = cur.fetchall()

        result: List[PublicFarmRow] = []
        for r in rows:
            result.append(
                PublicFarmRow(
                    farm_id=int(r["farm_id"]),
                    owner_user_id=int(r["owner_user_id"]),
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
            )

        return result

    def fetch_publishable_farms_in_bounds(
        self,
        min_lat: float,
        max_lat: float,
        min_lng: float,
        max_lng: float,
        limit: int,
    ) -> List[PublicFarmRow]:
        """
        地図表示用:
        - 公開中かつ予約受付中
        - pickup_lat/lng が指定バウンディングボックス内
        - 最大 limit 件
        """
        sql = """
            SELECT
                f.id                   AS farm_id,
                f.owner_user_id        AS owner_user_id,

                u.last_name            AS owner_last_name,
                u.first_name           AS owner_first_name,
                u.address              AS owner_address,

                f.price_10kg           AS price_10kg,
                f.pickup_time          AS pickup_slot_code,
                f.pickup_lat           AS pickup_lat,
                f.pickup_lng           AS pickup_lng,

                fp.face_image_url      AS face_image_url,
                fp.pr_title            AS pr_title,
                fp.pr_images_json      AS pr_images_raw
            FROM farms AS f
            JOIN users AS u
              ON u.id = f.owner_user_id
            LEFT JOIN farmer_profiles AS fp
              ON fp.farm_id = f.id
            WHERE
              f.active_flag = 1
              AND f.is_accepting_reservations = 1
              AND f.pickup_lat IS NOT NULL
              AND f.pickup_lng IS NOT NULL
              AND f.pickup_lat BETWEEN ? AND ?
              AND f.pickup_lng BETWEEN ? AND ?
            ORDER BY f.id
            LIMIT ?
        """
        cur = self.conn.execute(
            sql,
            (min_lat, max_lat, min_lng, max_lng, limit),
        )
        rows = cur.fetchall()

        result: List[PublicFarmRow] = []
        for r in rows:
            result.append(
                PublicFarmRow(
                    farm_id=int(r["farm_id"]),
                    owner_user_id=int(r["owner_user_id"]),
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
            )

        return result
