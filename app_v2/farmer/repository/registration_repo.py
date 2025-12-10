# app_v2/farmer/repository/registration_repo.py
from __future__ import annotations

from typing import Optional, Dict, Any

import os
import sqlite3

from app_v2.farmer.dtos import OwnerDTO, FarmPickupDTO


def _get_db_path(explicit: Optional[str] = None) -> str:
    if explicit:
        return explicit
    env_path = os.getenv("APP_DB_PATH")
    if env_path:
        return env_path
    return "app.db"


class RegistrationRepository:
    def __init__(self, db: Any | None = None, db_path: Optional[str] = None) -> None:
        path = _get_db_path(db_path)
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        self.conn = conn

    # -----------------------------
    # users
    # -----------------------------
    def get_user_by_line_user_id(self, line_user_id: str) -> Optional[Dict[str, Any]]:
        cur = self.conn.execute(
            """
            SELECT
                id,
                line_user_id,
                registration_status,
                is_friend,
                name,
                phone,
                postal_code,
                address,
                last_name,
                first_name,
                last_kana,
                first_kana
            FROM users
            WHERE line_user_id = ?
            LIMIT 1
            """,
            (line_user_id,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        return dict(row)

    def update_user_owner_info(self, owner: OwnerDTO) -> None:
        full_name = f"{owner.owner_last_name}{owner.owner_first_name}"
        full_address = f"{owner.owner_pref}{owner.owner_city}{owner.owner_addr_line}"

        self.conn.execute(
            """
            UPDATE users
            SET
                name = ?,
                phone = ?,
                postal_code = ?,
                address = ?,
                registration_status = 'registered',
                last_name = ?,
                first_name = ?,
                last_kana = ?,
                first_kana = ?
            WHERE id = ?
            """,
            (
                full_name,
                owner.owner_phone,
                owner.owner_postcode,
                full_address,
                owner.owner_last_name,
                owner.owner_first_name,
                owner.owner_last_kana,
                owner.owner_first_kana,
                owner.owner_user_id,
            ),
        )

    # -----------------------------
    # farms
    # -----------------------------
    def get_existing_farm_id_for_owner(self, owner_user_id: int) -> Optional[int]:
        cur = self.conn.execute(
            """
            SELECT id
            FROM farms
            WHERE owner_user_id = ?
               OR user_id = ?
            LIMIT 1
            """,
            (owner_user_id, owner_user_id),
        )
        row = cur.fetchone()
        if row is None:
            return None
        try:
            return int(row["id"])
        except Exception:
            return int(row[0])

    def create_farm_for_registration(
        self,
        owner: OwnerDTO,
        pickup: FarmPickupDTO,
        *,
        owner_lat: float,
        owner_lng: float,
    ) -> int:
        """
        Registration Page → farms へ 1 レコード作成（最小拡張版）
        """
        full_name = f"{owner.owner_last_name}{owner.owner_first_name}"
        full_address = f"{owner.owner_pref}{owner.owner_city}{owner.owner_addr_line}"

        cur = self.conn.execute(
            """
            INSERT INTO farms
                (
                    name,
                    user_id,
                    owner_user_id,
                    postal_code,
                    address,
                    lat,             -- ★ 新規追加
                    lng,             -- ★ 新規追加
                    pickup_lat,
                    pickup_lng,
                    pickup_place_name,
                    pickup_time,
                    active_flag,
                    is_public,
                    is_accepting_reservations,
                    location_status
                )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, 'pending')
            """,
            (
                full_name,
                owner.owner_user_id,
                owner.owner_user_id,
                owner.owner_postcode,
                full_address,
                owner_lat,          # ★ 追加
                owner_lng,          # ★ 追加
                pickup.pickup_lat,
                pickup.pickup_lng,
                pickup.pickup_place_name,
                pickup.pickup_time,
            ),
        )

        farm_id = cur.lastrowid
        if farm_id is None:
            cur2 = self.conn.execute("SELECT last_insert_rowid() AS id")
            row = cur2.fetchone()
            if row is None:
                raise RuntimeError("failed to obtain farm_id after INSERT")
            try:
                farm_id = int(row["id"])
            except Exception:
                farm_id = int(row[0])

        return int(farm_id)

    # -----------------------------
    # transaction
    # -----------------------------
    def commit(self) -> None:
        self.conn.commit()

    def rollback(self) -> None:
        self.conn.rollback()
