from __future__ import annotations

import sqlite3
from typing import Optional

from app_v2.db.core import resolve_db_path
from app_v2.farmer.dtos import OwnerDTO, FarmPickupDTO


class RegistrationRepository:
    def __init__(self) -> None:
        db_path = resolve_db_path()
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row

    # -------------------------------------------------
    # Query
    # -------------------------------------------------

    def get_farm_by_id(self, farm_id: int) -> Optional[int]:
        cur = self.conn.execute(
            """
            SELECT farm_id
            FROM farms
            WHERE farm_id = ?
            LIMIT 1
            """,
            (farm_id,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        return int(row["farm_id"])

    # -------------------------------------------------
    # Command
    # -------------------------------------------------

    def update_farm_registration(
        self,
        *,
        farm_id: int,
        owner: OwnerDTO,
        pickup: FarmPickupDTO,
        owner_lat: float,
        owner_lng: float,
        active_flag: int,
        is_public: int,
        is_accepting_reservations: int,
    ) -> None:
        full_name = f"{owner.owner_last_name}{owner.owner_first_name}"
        full_address = f"{owner.owner_pref}{owner.owner_city}{owner.owner_addr_line}"

        self.conn.execute(
            """
            UPDATE farms
            SET
                name = ?,
                last_name = ?,
                first_name = ?,
                last_kana = ?,
                first_kana = ?,
                phone = ?,
                postal_code = ?,
                address = ?,
                lat = ?,
                lng = ?,

                pickup_lat = ?,
                pickup_lng = ?,
                pickup_place_name = ?,
                pickup_notes = ?,
                pickup_time = ?,

                active_flag = ?,
                is_public = ?,
                is_accepting_reservations = ?
            WHERE farm_id = ?
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
                pickup.pickup_lat,
                pickup.pickup_lng,
                pickup.pickup_place_name,
                pickup.pickup_notes,
                pickup.pickup_time,
                active_flag,
                is_public,
                is_accepting_reservations,
                farm_id,
            ),
        )

    def set_owner_farmer_id(
        self,
        *,
        farm_id: int,
        owner_farmer_id: int,
    ) -> None:
        self.conn.execute(
            """
            UPDATE farms
            SET owner_farmer_id = ?
            WHERE farm_id = ?
            """,
            (owner_farmer_id, farm_id),
        )

    # ★★★ 追加：registration_status 更新（ここだけが変更点） ★★★
    def set_registration_status(
        self,
        *,
        farm_id: int,
        registration_status: str,
    ) -> None:
        self.conn.execute(
            """
            UPDATE farms
            SET registration_status = ?
            WHERE farm_id = ?
            """,
            (registration_status, farm_id),
        )

    # -------------------------------------------------
    # Transaction
    # -------------------------------------------------

    def commit(self) -> None:
        self.conn.commit()

    def rollback(self) -> None:
        self.conn.rollback()
