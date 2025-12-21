from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

from app_v2.db.core import resolve_db_path


class FarmerSettingsRepository:
    """
    Farmer Settings 用 Repository。

    - sqlite3 直叩き
    - DB パスは resolve_db_path に一本化
    - 業務ロジックは一切持たない
    """

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(resolve_db_path())
        conn.row_factory = sqlite3.Row
        return conn

    # ============================================================
    # Farm / Profile
    # ============================================================

    def get_farm(self, farm_id: int) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cur = conn.execute(
                "SELECT * FROM farms WHERE farm_id = ?",
                (farm_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    def get_profile(self, farm_id: int) -> Optional[Dict[str, Any]]:
        return self.get_farm(farm_id)

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
                       monthly_upload_limit = 50000000,
                       next_reset_at = NULL
                 WHERE farm_id = ?
                """,
                (farm_id,),
            )

        farm = self.get_farm(farm_id)
        if not farm:
            raise RuntimeError("failed to create initial profile")
        return farm

    # ============================================================
    # Update helpers
    # ============================================================

    def update_farm_fields(self, farm_id: int, **fields: Any) -> None:
        if not fields:
            return

        columns = ", ".join(f"{k} = ?" for k in fields.keys())
        values = list(fields.values()) + [farm_id]

        with self._get_conn() as conn:
            conn.execute(
                f"UPDATE farms SET {columns} WHERE farm_id = ?",
                values,
            )

    def update_profile_fields(self, farm_id: int, **fields: Any) -> None:
        self.update_farm_fields(farm_id, **fields)

    # ============================================================
    # PR images
    # ============================================================

    def load_pr_images_list(self, farm_id: int) -> List[Dict[str, Any]]:
        farm = self.get_farm(farm_id)
        if not farm:
            return []

        raw = farm.get("pr_images_json") or "[]"
        try:
            data = json.loads(raw)
        except Exception:
            return []

        if not isinstance(data, list):
            return []

        return [x for x in data if isinstance(x, dict)]

    def save_pr_images_list(
        self,
        farm_id: int,
        pr_list: List[Dict[str, Any]],
    ) -> None:
        payload = json.dumps(pr_list, ensure_ascii=False)
        self.update_farm_fields(farm_id, pr_images_json=payload)

    # ============================================================
    # Monthly upload state
    # ============================================================

    def get_monthly_upload_state(self, farm_id: int) -> Dict[str, Any]:
        farm = self.get_farm(farm_id)
        if not farm:
            raise RuntimeError("farm not found")

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
        fields: Dict[str, Any] = {}

        if monthly_upload_bytes is not None:
            fields["monthly_upload_bytes"] = int(monthly_upload_bytes)
        if next_reset_at is not None:
            fields["next_reset_at"] = next_reset_at.isoformat()
        if monthly_upload_limit is not None:
            fields["monthly_upload_limit"] = int(monthly_upload_limit)

        if fields:
            self.update_farm_fields(farm_id, **fields)

    # ============================================================
    # Reservation
    # ============================================================

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
