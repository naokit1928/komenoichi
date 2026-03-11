from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
import sqlite3

from app_v2.farmer.services.pickup.pickup_settings_service import (
    PickupSettingsService,
    PickupFarmDTO,
)
from app_v2.farmer.services.pickup.pickup_lock_service import (
    PickupLockService,
)
# ★ 追加: 距離計算ロジックと定数
from app_v2.farmer.services.location_service import (
    haversine_distance_m,
    DEFAULT_PICKUP_RADIUS_METERS,
)


# ============================================================
# 例外
# ============================================================


class PickupSettingsFacadeError(Exception):
    """Facade レイヤーの基底例外"""


class PickupLockedError(PickupSettingsFacadeError):
    def __init__(self, farm_id: int, active_reservations_count: int) -> None:
        self.farm_id = farm_id
        self.active_reservations_count = active_reservations_count
        super().__init__(
            f"pickup settings locked for farm_id={farm_id} "
            f"(active_reservations_count={active_reservations_count})"
        )


class PickupDistanceError(PickupSettingsFacadeError):
    """★ 追加: 距離制限エラー"""
    def __init__(self, distance: float, limit: float) -> None:
        self.distance = distance
        self.limit = limit
        super().__init__(
            f"Pickup location is too far from owner address "
            f"({distance:.1f}m > {limit}m)"
        )


# ============================================================
# DTO
# ============================================================


@dataclass
class PickupStatusDTO:
    active_reservations_count: int
    can_edit_pickup: bool


@dataclass
class PickupSettingsFacadeResult:
    farm: PickupFarmDTO
    status: PickupStatusDTO


# ============================================================
# Facade 本体
# ============================================================


class PickupSettingsFacade:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self.settings_service = PickupSettingsService(conn)
        self.lock_service = PickupLockService()

    # ---------------------------------------------------------
    # GET
    # ---------------------------------------------------------

    def get_settings(self, farm_id: int) -> PickupSettingsFacadeResult:
        farm = self.settings_service.get_settings(farm_id)

        try:
            active_count = self.lock_service.get_active_reservations_count(
                farm_id=farm.farm_id,
                pickup_time=farm.pickup_time,
            )
        except Exception:
            active_count = 0

        return PickupSettingsFacadeResult(
            farm=farm,
            status=PickupStatusDTO(
                active_reservations_count=active_count,
                can_edit_pickup=(active_count == 0),
            ),
        )

    # ---------------------------------------------------------
    # UPDATE
    # ---------------------------------------------------------

    def update_settings(
        self,
        farm_id: int,
        pickup_lat: Optional[float] = None,
        pickup_lng: Optional[float] = None,
        pickup_place_name: Optional[str] = None,
        pickup_notes: Optional[str] = None,
        pickup_time: Optional[str] = None,
    ) -> PickupSettingsFacadeResult:
        
        # 1. 現状取得
        current_farm = self.settings_service.get_settings(farm_id)

        # 2. ロック判定 (予約がある場合は変更不可)
        active_count = self.lock_service.get_active_reservations_count(
            farm_id=current_farm.farm_id,
            pickup_time=current_farm.pickup_time,
        )

        if active_count > 0:
            raise PickupLockedError(
                farm_id=current_farm.farm_id,
                active_reservations_count=active_count,
            )

        # 3. ★ 距離制限チェック (座標変更時のみ)
        #    新しい座標を確定させる（送られてこなければ現在の値）
        new_lat = pickup_lat if pickup_lat is not None else current_farm.pickup_lat
        new_lng = pickup_lng if pickup_lng is not None else current_farm.pickup_lng

        # オーナー住所(基準点)があり、かつ座標が有効な場合のみ計算
        if (
            current_farm.owner_lat is not None
            and current_farm.owner_lng is not None
            and new_lat != 0.0
            and new_lng != 0.0
        ):
            dist = haversine_distance_m(
                current_farm.owner_lat,
                current_farm.owner_lng,
                new_lat,
                new_lng,
            )
            # 制限を超えていたらエラー
            if dist > DEFAULT_PICKUP_RADIUS_METERS:
                raise PickupDistanceError(dist, DEFAULT_PICKUP_RADIUS_METERS)

        # 4. 部分更新の実行
        self.settings_service.update_settings_partial(
            farm_id=farm_id,
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            pickup_place_name=pickup_place_name,
            pickup_notes=pickup_notes,
            pickup_time=pickup_time,
        )

        # 5. 更新後の最新状態を返す
        return self.get_settings(farm_id)