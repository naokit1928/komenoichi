from __future__ import annotations

from typing import Optional, Any
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

    # -------------------------------------------------
    # farms only
    # -------------------------------------------------
    def get_existing_farm_id_by_line_id(self, farmer_line_id: str) -> Optional[int]:
        cur = self.conn.execute(
            """
            SELECT farm_id
            FROM farms
            WHERE farmer_line_id = ?
            LIMIT 1
            """,
            (farmer_line_id,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        return int(row["farm_id"])

    def create_farm_for_registration(
        self,
        *,
        farmer_line_id: str,
        is_friend: int,
        owner: OwnerDTO,
        pickup: FarmPickupDTO,
        owner_lat: float,
        owner_lng: float,
    ) -> int:
        full_name = f"{owner.owner_last_name}{owner.owner_first_name}"
        full_address = f"{owner.owner_pref}{owner.owner_city}{owner.owner_addr_line}"

        cur = self.conn.execute(
            """
            INSERT INTO farms (
                name,
                last_name,
                first_name,
                last_kana,
                first_kana,
                phone,
                postal_code,
                address,
                lat,
                lng,

                farmer_line_id,
                is_friend,

                pickup_lat,
                pickup_lng,
                pickup_place_name,
                pickup_notes,
                pickup_time,

                active_flag,
                is_public,
                is_accepting_reservations
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?,
                ?, ?, ?, ?, ?,
                1, 0, 0
            )
            """,
            (
                full_name,
                owner.owner_last_name,
                owner.owner_first_name,
                owner.owner_last_kana,
                owner.owner_first_kana,
                owner.owner_phone,
                owner.owner_postcode,
                full_address,
                owner_lat,
                owner_lng,
                farmer_line_id,
                is_friend,
                pickup.pickup_lat,
                pickup.pickup_lng,
                pickup.pickup_place_name,
                pickup.pickup_notes,
                pickup.pickup_time,
            ),
        )

        farm_id = cur.lastrowid
        if farm_id is None:
            cur2 = self.conn.execute("SELECT last_insert_rowid() AS id")
            row = cur2.fetchone()
            if row is None:
                raise RuntimeError("failed to obtain farm_id after INSERT")
            farm_id = int(row["id"])

        return int(farm_id)

    # -------------------------------------------------
    # transaction
    # -------------------------------------------------
    def commit(self) -> None:
        self.conn.commit()

    def rollback(self) -> None:
        self.conn.rollback()
