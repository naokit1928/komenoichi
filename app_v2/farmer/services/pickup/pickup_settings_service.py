from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

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
# DTO（farm 単体）
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
# Service 本体（純粋化）
# ============================================================


class PickupSettingsService:
    """
    Pickup Settings（farm 単体）専用 Service。

    責務:
    - pickup 設定の取得
    - pickup 設定の更新
    - farm の存在確認

    非責務:
    - reservation 判定
    - lock / active / event
    - 差分チェック
    - HTTP / API 文脈
    """

    def __init__(self) -> None:
        self.repo = PickupSettingsRepository()

    # ---------------------------------------------------------
    # GET
    # ---------------------------------------------------------

    def get_settings(self, farm_id: int) -> PickupFarmDTO:
        """
        farm の pickup 設定を取得する。
        """
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

    # ---------------------------------------------------------
    # UPDATE
    # ---------------------------------------------------------

    def update_settings(
        self,
        farm_id: int,
        *,
        pickup_lat: float,
        pickup_lng: float,
        pickup_place_name: str,
        pickup_notes: Optional[str],
        pickup_time: str,
    ) -> None:
        """
        pickup 設定を保存する。

        ※ lock 判定・差分判定は一切行わない
        """
        farm_row = self.repo.fetch_farm_pickup(farm_id)
        if farm_row is None:
            raise FarmNotFoundError(farm_id)

        try:
            self.repo.update_pickup_settings(
                farm_id=farm_id,
                pickup_lat=pickup_lat,
                pickup_lng=pickup_lng,
                pickup_place_name=pickup_place_name,
                pickup_notes=pickup_notes,
                pickup_time=pickup_time,
            )
            self.repo.commit()
        except Exception:
            self.repo.rollback()
            raise
