# app_v2/farmer/repository/farmer_settings_repo.py
from __future__ import annotations
import json
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional
from app_v2.farmer.constants import FarmConfig

ALLOWED_FARM_COLUMNS: frozenset[str] = frozenset({
    "is_accepting_reservations", "rice_variety_label",
    "price_10kg", "price_5kg", "price_25kg",
    "active_flag", "is_public",
    "pr_title", "pr_text", "face_image_url", "cover_image_url", "pr_images_json",
    "monthly_upload_bytes", "monthly_upload_limit", "next_reset_at",
    "registration_status",
})

class FarmerSettingsRepository:
    """
    Farmer Settings 用 Repository (Transaction対応版)
    コネクションは Service 層から注入される。
    """

    # --- Farm / Profile ---

    def get_farm(self, conn: sqlite3.Connection, farm_id: int) -> Optional[Dict[str, Any]]:
        cur = conn.execute("SELECT * FROM farms WHERE farm_id = ?", (farm_id,))
        row = cur.fetchone()
        return dict(row) if row else None

    def get_profile(self, conn: sqlite3.Connection, farm_id: int) -> Optional[Dict[str, Any]]:
        return self.get_farm(conn, farm_id)

    def create_initial_profile(self, conn: sqlite3.Connection, farm_id: int) -> Dict[str, Any]:
        conn.execute(
            """
            UPDATE farms
               SET pr_title = NULL,
                   pr_text = NULL,
                   cover_image_url = NULL,
                   face_image_url = NULL,
                   pr_images_json = '[]',
                   monthly_upload_bytes = 0,
                   monthly_upload_limit = ?,
                   next_reset_at = NULL
             WHERE farm_id = ?
            """,
            (FarmConfig.DEFAULT_MONTHLY_UPLOAD_LIMIT, farm_id),
        )
        farm = self.get_farm(conn, farm_id)
        if not farm:
            raise RuntimeError("failed to create initial profile")
        return farm

    # --- Update helpers ---

    def update_farm_fields(self, conn: sqlite3.Connection, farm_id: int, **fields: Any) -> None:
        if not fields:
            return
        disallowed = set(fields.keys()) - ALLOWED_FARM_COLUMNS
        if disallowed:
            raise ValueError(f"disallowed columns: {disallowed}")

        columns = ", ".join(f"{k} = ?" for k in fields.keys())
        values = list(fields.values()) + [farm_id]
        
        # コミットはしない
        conn.execute(f"UPDATE farms SET {columns} WHERE farm_id = ?", values)

    def update_profile_fields(self, conn: sqlite3.Connection, farm_id: int, **fields: Any) -> None:
        self.update_farm_fields(conn, farm_id, **fields)

    def set_registration_status(self, conn: sqlite3.Connection, *, farm_id: int, registration_status: str) -> None:
        conn.execute(
            "UPDATE farms SET registration_status = ? WHERE farm_id = ?",
            (registration_status, farm_id),
        )

    # --- PR images ---

    def load_pr_images_list(self, conn: sqlite3.Connection, farm_id: int) -> List[Dict[str, Any]]:
        farm = self.get_farm(conn, farm_id)
        if not farm:
            return []
        raw = farm.get("pr_images_json") or "[]"
        try:
            data = json.loads(raw)
            return [x for x in data if isinstance(x, dict)]
        except Exception:
            return []

    def save_pr_images_list(self, conn: sqlite3.Connection, farm_id: int, pr_list: List[Dict[str, Any]]) -> None:
        payload = json.dumps(pr_list, ensure_ascii=False)
        self.update_farm_fields(conn, farm_id, pr_images_json=payload)

    # --- Monthly upload state ---

    def get_monthly_upload_state(self, conn: sqlite3.Connection, farm_id: int) -> Dict[str, Any]:
        farm = self.get_farm(conn, farm_id)
        if not farm:
            raise RuntimeError("farm not found")
        
        # 初期化が必要かチェック
        if (farm.get("monthly_upload_bytes") is None or 
            farm.get("monthly_upload_limit") is None):
            return self.create_initial_profile(conn, farm_id)
            
        return farm

    def set_monthly_upload_state(self, conn: sqlite3.Connection, farm_id: int, *,
                                 monthly_upload_bytes: Optional[int] = None,
                                 next_reset_at: Optional[datetime] = None) -> None:
        fields: Dict[str, Any] = {}
        if monthly_upload_bytes is not None:
            fields["monthly_upload_bytes"] = int(monthly_upload_bytes)
        if next_reset_at is not None:
            fields["next_reset_at"] = next_reset_at.isoformat()
        
        if fields:
            self.update_farm_fields(conn, farm_id, **fields)

    # --- Reservation ---
    
    def count_active_reservations(self, conn: sqlite3.Connection, farm_id: int) -> int:
        # シンプル化: deletedフラグがある場合のみ除外するロジックなどは維持
        query = "SELECT COUNT(*) AS cnt FROM reservations WHERE farm_id = ? AND status = 'confirmed'"
        # カラムが存在するかどうかのチェックは省略（スキーマが安定している前提）
        # 必要なら try-except で囲む
        cur = conn.execute(query, (farm_id,))
        row = cur.fetchone()
        return int(row["cnt"]) if row else 0