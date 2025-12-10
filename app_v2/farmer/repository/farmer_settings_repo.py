# app_v2/farmer/repository/farmer_settings_repo.py
from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

DB_PATH = "app.db"


class FarmerSettingsRepository:
    """
    Farmer Settings v2 用の DB アクセス層（sqlite3 版）。

    - SQLAlchemy Session / models には一切依存しない。
    - すべて app.db に対する素の SQL で実装する。
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
    # Farm / Profile 基本操作
    # -----------------------------------------------------

    def get_farm(self, farm_id: int) -> Optional[Dict[str, Any]]:
        """
        farms テーブルから 1件取得。
        見つからなければ None。
        """
        with self._get_conn() as conn:
            cur = conn.execute(
                "SELECT * FROM farms WHERE id = ?",
                (farm_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    def get_profile(self, farm_id: int) -> Optional[Dict[str, Any]]:
        """
        farmer_profiles テーブルから farm_id 行を取得。
        見つからなければ None。
        """
        with self._get_conn() as conn:
            cur = conn.execute(
                "SELECT * FROM farmer_profiles WHERE farm_id = ?",
                (farm_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    def create_initial_profile(self, farm_id: int) -> Dict[str, Any]:
        """
        FarmerProfile の初期行を作成して返す。
        旧 ORM 実装が作っていたデフォルト値に合わせる。
        """
        with self._get_conn() as conn:
            conn.execute(
                """
                INSERT INTO farmer_profiles (
                    farm_id,
                    pr_title,
                    pr_text,
                    cover_image_url,
                    face_image_url,
                    pr_images_json,
                    monthly_upload_bytes,
                    monthly_upload_limit,
                    next_reset_at
                )
                VALUES (?, NULL, NULL, NULL, NULL, '[]', 0, 50000000, NULL)
                """,
                (farm_id,),
            )
            cur = conn.execute(
                "SELECT * FROM farmer_profiles WHERE farm_id = ?",
                (farm_id,),
            )
            row = cur.fetchone()
            if not row:
                raise RuntimeError("failed to create farmer_profiles row")
            return dict(row)

    # -----------------------------------------------------
    # Farm / Profile 更新
    # -----------------------------------------------------

    def update_farm_fields(self, farm_id: int, **fields: Any) -> None:
        """
        farms テーブルの指定カラムだけ部分更新する。
        """
        if not fields:
            return

        columns = ", ".join(f"{k} = ?" for k in fields.keys())
        values = list(fields.values())
        values.append(farm_id)

        with self._get_conn() as conn:
            conn.execute(
                f"UPDATE farms SET {columns} WHERE id = ?",
                values,
            )

    def update_profile_fields(self, farm_id: int, **fields: Any) -> None:
        """
        farmer_profiles テーブルの指定カラムだけ部分更新する。
        """
        if not fields:
            return

        columns = ", ".join(f"{k} = ?" for k in fields.keys())
        values = list(fields.values())
        values.append(farm_id)

        with self._get_conn() as conn:
            conn.execute(
                f"UPDATE farmer_profiles SET {columns} WHERE farm_id = ?",
                values,
            )

    # -----------------------------------------------------
    # PR 画像 JSON
    # -----------------------------------------------------

    def load_pr_images_list(self, farm_id: int) -> List[Dict[str, Any]]:
        """
        farmer_profiles.pr_images_json を list[dict] に展開して返す。
        """
        profile = self.get_profile(farm_id)
        if not profile:
            return []

        raw = profile.get("pr_images_json")
        if not raw:
            return []

        # TEXT で保存されているケース
        if isinstance(raw, str):
            try:
                loaded = json.loads(raw)
            except json.JSONDecodeError:
                return []
        else:
            loaded = raw

        if not isinstance(loaded, list):
            return []

        return [item for item in loaded if isinstance(item, dict)]

    def save_pr_images_list(
        self,
        farm_id: int,
        pr_list: List[Dict[str, Any]],
    ) -> None:
        """
        PR 画像リストを JSON 文字列として farmer_profiles に保存。
        """
        payload = json.dumps(pr_list, ensure_ascii=False)
        self.update_profile_fields(farm_id, pr_images_json=payload)

    # -----------------------------------------------------
    # 月間アップロード関連
    # -----------------------------------------------------

    def get_monthly_upload_state(self, farm_id: int) -> Dict[str, Any]:
        """
        monthly_upload_bytes / monthly_upload_limit / next_reset_at を含む
        profile 行を返す（存在しなければ初期行を作成）。
        """
        profile = self.get_profile(farm_id)
        if not profile:
            profile = self.create_initial_profile(farm_id)
        return profile

    def set_monthly_upload_state(
        self,
        farm_id: int,
        *,
        monthly_upload_bytes: Optional[int] = None,
        next_reset_at: Optional[datetime] = None,
        monthly_upload_limit: Optional[int] = None,
    ) -> None:
        """
        月間アップロード関連のフィールドを部分更新。
        """
        update_fields: Dict[str, Any] = {}
        if monthly_upload_bytes is not None:
            update_fields["monthly_upload_bytes"] = int(monthly_upload_bytes)
        if next_reset_at is not None:
            # SQLite には TEXT として保存（Pydantic 側で datetime に変換）
            update_fields["next_reset_at"] = next_reset_at.isoformat()
        if monthly_upload_limit is not None:
            update_fields["monthly_upload_limit"] = int(monthly_upload_limit)

        if update_fields:
            self.update_profile_fields(farm_id, **update_fields)

    # -----------------------------------------------------
    # 予約数カウント
    # -----------------------------------------------------

    def count_active_reservations(self, farm_id: int) -> int:
        """
        reservations から「現在有効な confirmed 予約数」をカウント。
        is_deleted カラムが存在する・しない両方に対応。
        """
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
                row = cur.fetchone()
                if row:
                    return int(row["cnt"])
            except sqlite3.OperationalError:
                # is_deleted カラムがない場合のフォールバック
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
                if row:
                    return int(row["cnt"])

        return 0
