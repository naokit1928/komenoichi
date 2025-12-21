from __future__ import annotations

from dataclasses import dataclass

from app_v2.farmer.services.pickup.pickup_settings_service import (
    PickupSettingsService,
    FarmNotFoundError,
    PickupFarmDTO,
)
from app_v2.farmer.services.pickup.pickup_lock_service import (
    PickupLockService,
)


# ============================================================
# Facade 用例外
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


# ============================================================
# Facade DTO
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
    """
    Pickup Settings 用 Facade。

    責務:
    - PickupSettingsService（farm 単体）
    - PickupLockService（reservation 依存）
    を組み合わせて API 用の振る舞いを提供する。

    Service / LockService 単体では
    - 例外を握らない
    - API 契約を知らない

    すべての「判断」はここで行う。
    """

    def __init__(self) -> None:
        self.settings_service = PickupSettingsService()
        self.lock_service = PickupLockService()

    # ---------------------------------------------------------
    # GET
    # ---------------------------------------------------------

    def get_settings(self, farm_id: int) -> PickupSettingsFacadeResult:
        """
        Pickup Settings を取得する。

        - farm が存在しない → 例外
        - lock 判定中にエラー → 安全側（編集可能）に倒す
        """
        farm = self.settings_service.get_settings(farm_id)

        try:
            active_count = self.lock_service.get_active_reservations_count(
                farm_id=farm.farm_id,
                pickup_time=farm.pickup_time,
            )
        except Exception:
            # lock 判定に失敗した場合は「編集可能」にする
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
        *,
        farm_id: int,
        pickup_lat: float,
        pickup_lng: float,
        pickup_place_name: str,
        pickup_notes: str | None,
        pickup_time: str,
    ) -> PickupSettingsFacadeResult:
        """
        Pickup Settings を更新する。

        - 予約がある場合はロック
        - 差分がなくても「保存」は通す（Service 側の責務）
        """
        # farm existence check（Service に委譲）
        farm = self.settings_service.get_settings(farm_id)

        active_count = self.lock_service.get_active_reservations_count(
            farm_id=farm.farm_id,
            pickup_time=farm.pickup_time,
        )

        if active_count > 0:
            raise PickupLockedError(
                farm_id=farm.farm_id,
                active_reservations_count=active_count,
            )

        # 保存（純粋 Service）
        self.settings_service.update_settings(
            farm_id=farm_id,
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            pickup_place_name=pickup_place_name,
            pickup_notes=pickup_notes,
            pickup_time=pickup_time,
        )

        # 保存後の最新状態を返す
        return self.get_settings(farm_id)
