import sqlite3
from typing import List
from app_v2.db.core import resolve_db_path

class FavoriteRepository:
    def __init__(self) -> None:
        self.db_path = resolve_db_path()

    def get_favorite_farm_ids(self, consumer_id: int) -> List[int]:
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT farm_id FROM consumer_favorites WHERE consumer_id = ?",
                (consumer_id,)
            )
            return [row[0] for row in cur.fetchall()]
        finally:
            conn.close()

    def add_favorite(self, consumer_id: int, farm_id: int) -> None:
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT OR IGNORE INTO consumer_favorites (consumer_id, farm_id)
                VALUES (?, ?)
                """,
                (consumer_id, farm_id)
            )
            conn.commit()
        finally:
            conn.close()

    def remove_favorite(self, consumer_id: int, farm_id: int) -> None:
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.cursor()
            cur.execute(
                """
                DELETE FROM consumer_favorites
                WHERE consumer_id = ? AND farm_id = ?
                """,
                (consumer_id, farm_id)
            )
            conn.commit()
        finally:
            conn.close()

    def get_favorite_farms_full(self, consumer_id: int) -> List[sqlite3.Row]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            cur = conn.cursor()
            # ★ 農家一覧（public_farms_repo.py）と完全に同じカラム構成で取得する
            cur.execute(
                """
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
                JOIN consumer_favorites cf ON f.farm_id = cf.farm_id
                WHERE cf.consumer_id = ?
                ORDER BY cf.created_at DESC
                """,
                (consumer_id,)
            )
            return cur.fetchall()
        finally:
            conn.close()