from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
import sqlite3

from app_v2.farmer.repository.pickup_settings_repo import (
    PickupSettingsRepository,
)

# ============================================================
# 例外
# ============================================================

class PickupSettingsError(Exception):
    """PickupSettingsService の基底例外"""

class FarmNotFoundError(PickupSettingsError):
    def __init__(self, farm_id: int) -> None:
        self.farm_id = farm_id
        super().__init__(f"farm not found for farm_id={farm_id}")

# ============================================================
# DTO
# ============================================================

@dataclass
class PickupFarmDTO:
    farm_id: int
    owner_lat: Optional[float]
    owner_lng: Optional[float]
    pickup_lat: float
    pickup_lng: float
    pickup_place_name: str
    pickup_notes: Optional[str]
    pickup_time: str

# ============================================================
# Service 本体
# ============================================================

class PickupSettingsService:
    def __init__(self, conn: sqlite3.Connection) -> None:
        # Repository に conn を渡す
        self.repo = PickupSettingsRepository(conn)

    def get_settings(self, farm_id: int) -> PickupFarmDTO:
        farm_row = self.repo.fetch_farm_pickup(farm_id)
        if farm_row is None:
            raise FarmNotFoundError(farm_id)

        return PickupFarmDTO(
            farm_id=farm_row["farm_id"],
            owner_lat=farm_row.get("owner_lat"),
            owner_lng=farm_row.get("owner_lng"),
            pickup_lat=farm_row.get("pickup_lat") or 0.0,
            pickup_lng=farm_row.get("pickup_lng") or 0.0,
            pickup_place_name=farm_row.get("pickup_place_name") or "",
            pickup_notes=farm_row.get("pickup_notes"),
            pickup_time=farm_row.get("pickup_time") or "",
        )

    def update_settings_partial(
        self,
        farm_id: int,
        pickup_lat: Optional[float] = None,
        pickup_lng: Optional[float] = None,
        pickup_place_name: Optional[str] = None,
        pickup_notes: Optional[str] = None,
        pickup_time: Optional[str] = None,
    ) -> None:
        # 存在確認
        if self.repo.fetch_farm_pickup(farm_id) is None:
            raise FarmNotFoundError(farm_id)

        # 部分更新実行 (commit/rollback は上位層の Depends が行う)
        self.repo.update_pickup_settings_partial(
            farm_id=farm_id,
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            pickup_place_name=pickup_place_name,
            pickup_notes=pickup_notes,
            pickup_time=pickup_time,
        )