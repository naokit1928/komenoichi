from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

DB_PATH = "app.db"


class FarmerSettingsRepository:
    """
    Farmer Settings v2 用の DB アクセス層（sqlite3 版）。
    farms テーブルのみを正とする。
    """

    def __init__(self, db_path: str = DB_PATH) -> None:
        self.db_path = db_path

    # -----------------------------------------------------
    # 内部ヘルパ
    # -----------------------------------------------------

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # -----------------------------------------------------
    # Farm 取得
    # -----------------------------------------------------

    def get_farm(self, farm_id: int) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cur = conn.execute(
                "SELECT * FROM farms WHERE farm_id = ?",
                (farm_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    # 互換用（service 側を壊さないため残す）
    def get_profile(self, farm_id: int) -> Optional[Dict[str, Any]]:
        return self.get_farm(farm_id)

    # -----------------------------------------------------
    # 初期 PR 情報作成
    # -----------------------------------------------------

    def create_initial_profile(self, farm_id: int) -> Dict[str, Any]:
        with self._get_conn() as conn:
            conn.execute(
                """
                UPDATE farms
                   SET pr_title = NULL,
                       pr_text = NULL,
                       cover_image_url = NULL,
                       face_image_url = NULL,
                       pr_images_json = '[]',
                       monthly_upload_bytes = 0,
                       monthly_upload_limit = 150000000,
                       next_reset_at = NULL
                 WHERE farm_id = ?
                """,
                (farm_id,),
            )

        farm = self.get_farm(farm_id)
        if not farm:
            raise RuntimeError("failed to create initial profile")
        return farm

    # -----------------------------------------------------
    # Farm 更新
    # -----------------------------------------------------

    def update_farm_fields(self, farm_id: int, **fields: Any) -> None:
        if not fields:
            return

        columns = ", ".join(f"{k} = ?" for k in fields.keys())
        values = list(fields.values())
        values.append(farm_id)

        with self._get_conn() as conn:
            conn.execute(
                f"UPDATE farms SET {columns} WHERE farm_id = ?",
                values,
            )

    def update_profile_fields(self, farm_id: int, **fields: Any) -> None:
        self.update_farm_fields(farm_id, **fields)

    # -----------------------------------------------------
    # PR 画像
    # -----------------------------------------------------

    def load_pr_images_list(self, farm_id: int) -> List[Dict[str, Any]]:
        farm = self.get_farm(farm_id)
        if not farm:
            return []

        raw = farm.get("pr_images_json") or "[]"
        try:
            loaded = json.loads(raw)
        except Exception:
            return []

        return [x for x in loaded if isinstance(x, dict)] if isinstance(loaded, list) else []

    def save_pr_images_list(
        self,
        farm_id: int,
        pr_list: List[Dict[str, Any]],
    ) -> None:
        payload = json.dumps(pr_list, ensure_ascii=False)
        self.update_farm_fields(farm_id, pr_images_json=payload)

    # -----------------------------------------------------
    # 月間アップロード
    # -----------------------------------------------------

    def get_monthly_upload_state(self, farm_id: int) -> Dict[str, Any]:
        farm = self.get_farm(farm_id)
        if not farm:
            raise RuntimeError("Farm not found")

        if (
            farm.get("monthly_upload_bytes") is None
            or farm.get("monthly_upload_limit") is None
            or farm.get("pr_images_json") is None
        ):
            farm = self.create_initial_profile(farm_id)

        return farm

    def set_monthly_upload_state(
        self,
        farm_id: int,
        *,
        monthly_upload_bytes: Optional[int] = None,
        next_reset_at: Optional[datetime] = None,
        monthly_upload_limit: Optional[int] = None,
    ) -> None:
        update_fields: Dict[str, Any] = {}

        if monthly_upload_bytes is not None:
            update_fields["monthly_upload_bytes"] = int(monthly_upload_bytes)

        if next_reset_at is not None:
            update_fields["next_reset_at"] = next_reset_at.isoformat()

        if monthly_upload_limit is not None:
            update_fields["monthly_upload_limit"] = int(monthly_upload_limit)

        if update_fields:
            self.update_farm_fields(farm_id, **update_fields)

    # -----------------------------------------------------
    # 予約カウント
    # -----------------------------------------------------

    def count_active_reservations(self, farm_id: int) -> int:
        with self._get_conn() as conn:
            try:
                cur = conn.execute(
                    """
                    SELECT COUNT(*) AS cnt
                      FROM reservations
                     WHERE farm_id = ?
                       AND status = 'confirmed'
                       AND is_deleted = 0
                    """,
                    (farm_id,),
                )
            except sqlite3.OperationalError:
                cur = conn.execute(
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
