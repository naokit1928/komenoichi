# app_v2/customer_booking/repository/public_farm_detail_repo.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Any

import os
import sqlite3


def _get_db_path() -> str:
    """
    DB ファイルパスを返す。
    APP_DB_PATH 環境変数があればそれを優先し、
    なければ "app.db" を使う。
    """
    env_path = os.getenv("APP_DB_PATH")
    return env_path if env_path else "app.db"


@dataclass
class PublicFarmDetailRow:
    """
    DB から取得した「公開対象 farm 詳細 1件分」の生データ。
    Service 層で PublicFarmDetailDTO に詰め替える前段階。
    """

    farm_id: int
    owner_user_id: int

    owner_last_name: str
    owner_first_name: str
    owner_address: str  # users.address（フル住所）

    rice_variety_label: str
    harvest_year: Optional[int]   # NULL を許容

    price_5kg: int
    price_10kg: int
    price_25kg: int

    face_image_url: str
    cover_image_url: str
    pr_images_raw: Optional[str]  # JSON 文字列 or None
    pr_title: str
    pr_text: str

    pickup_slot_code: str      # f.pickup_time をここに詰める
    pickup_place_name: str
    pickup_notes: str
    pickup_lat: float
    pickup_lng: float


class PublicFarmDetailRepository:
    """
    PublicFarmDetail 用の純粋な DB アクセス層（sqlite3版）。

    - farms テーブル … 受け渡し場所 / 価格 / flags / 品種・収穫年
    - farmer_profiles テーブル … PR画像 / 顔写真 / PRタイトル / PR本文
    - users テーブル … オーナー氏名・住所
    """

    def __init__(self, db: Any | None = None) -> None:
        """
        互換性のために db 引数は受け取るが、ここでは使用しない。
        （旧 SQLAlchemy 版からの呼び出しを壊さないため）
        """
        conn = sqlite3.connect(_get_db_path())
        conn.row_factory = sqlite3.Row
        self.conn = conn

    def fetch_publishable_farm_detail(
        self,
        farm_id: int,
    ) -> Optional[PublicFarmDetailRow]:
        """
        公開可能な farm 詳細を 1件取得する。

        いまの段階では PublicFarmList と同様に
          - active_flag = 1
          - is_accepting_reservations = 1
        の2条件で絞り込む。
        （is_ready_to_publish は将来ここに追加する）
        """

        sql = """
            SELECT
                f.id                    AS farm_id,
                f.owner_user_id         AS owner_user_id,

                u.last_name             AS owner_last_name,
                u.first_name            AS owner_first_name,
                u.address               AS owner_address,

                f.rice_variety_label    AS rice_variety_label,
                f.harvest_year          AS harvest_year,

                f.price_5kg             AS price_5kg,
                f.price_10kg            AS price_10kg,
                f.price_25kg            AS price_25kg,

                fp.face_image_url       AS face_image_url,
                fp.cover_image_url      AS cover_image_url,
                fp.pr_images_json       AS pr_images_raw,
                fp.pr_title             AS pr_title,
                fp.pr_text              AS pr_text,

                f.pickup_time           AS pickup_slot_code,
                f.pickup_place_name     AS pickup_place_name,
                f.pickup_notes          AS pickup_notes,
                f.pickup_lat            AS pickup_lat,
                f.pickup_lng            AS pickup_lng
            FROM farms AS f
            JOIN users AS u
              ON u.id = f.owner_user_id
            LEFT JOIN farmer_profiles AS fp
              ON fp.farm_id = f.id
            WHERE
              f.id = ?
              AND f.active_flag = 1
              AND f.is_accepting_reservations = 1
        """

        cur = self.conn.execute(sql, (farm_id,))
        row = cur.fetchone()
        if row is None:
            return None

        # ---- harvest_year（NULL許容） ----
        raw_hy = row["harvest_year"]
        if raw_hy is None:
            harvest_year: Optional[int] = None
        else:
            try:
                harvest_year = int(raw_hy)
            except (TypeError, ValueError):
                harvest_year = None

        # ---- 価格（NULL が来ても 0 にしておく）----
        def to_int_or_zero(v: object) -> int:
            if v is None:
                return 0
            try:
                return int(v)
            except (TypeError, ValueError):
                return 0

        price_5kg = to_int_or_zero(row["price_5kg"])
        price_10kg = to_int_or_zero(row["price_10kg"])
        price_25kg = to_int_or_zero(row["price_25kg"])

        return PublicFarmDetailRow(
            farm_id=int(row["farm_id"]),
            owner_user_id=int(row["owner_user_id"]),
            owner_last_name=str(row["owner_last_name"] or ""),
            owner_first_name=str(row["owner_first_name"] or ""),
            owner_address=str(row["owner_address"] or ""),
            rice_variety_label=str(row["rice_variety_label"] or ""),
            harvest_year=harvest_year,
            price_5kg=price_5kg,
            price_10kg=price_10kg,
            price_25kg=price_25kg,
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
