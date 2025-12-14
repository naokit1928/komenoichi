# app_v2/farmer/services/pickup_settings_service.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Dict, Any
from datetime import datetime

from app_v2.farmer.repository.pickup_settings_repo import PickupSettingsRepository
from app_v2.customer_booking.utils.pickup_time_utils import JST

# reservation_expanded と同じロジックを再利用する
from app_v2.customer_booking.repository.reservation_expanded_repo import (
    ReservationExpandedRepository,
)
from app_v2.customer_booking.services.reservation_expanded_service import (
    _calc_event_for_export,
    _calc_event_for_booking,
    _parse_db_datetime,
)


# ============================================================
# 例外クラス
# ============================================================


class PickupSettingsError(Exception):
    pass


class FarmNotFoundError(PickupSettingsError):
    def __init__(self, farm_id: int) -> None:
        self.farm_id = farm_id
        super().__init__(f"farm not found for farm_id={farm_id}")


class PickupLockedError(PickupSettingsError):
    def __init__(self, farm_id: int, active_reservations_count: int) -> None:
        self.farm_id = farm_id
        self.active_reservations_count = active_reservations_count
        super().__init__(
            f"pickup settings locked for farm_id={farm_id} "
            f"(active_reservations_count={active_reservations_count})"
        )


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


@dataclass
class PickupStatusDTO:
    active_reservations_count: int
    can_edit_pickup: bool


@dataclass
class PickupSettingsResult:
    farm: PickupFarmDTO
    status: PickupStatusDTO

    def to_dict(self) -> Dict[str, Any]:
        return {
            "farm": {
                "farm_id": self.farm.farm_id,
                "owner_lat": self.farm.owner_lat,
                "owner_lng": self.farm.owner_lng,
                "pickup_lat": self.farm.pickup_lat,
                "pickup_lng": self.farm.pickup_lng,
                "pickup_place_name": self.farm.pickup_place_name,
                "pickup_notes": self.farm.pickup_notes,
                "pickup_time": self.farm.pickup_time,
            },
            "status": {
                "active_reservations_count": self.status.active_reservations_count,
                "can_edit_pickup": self.status.can_edit_pickup,
            },
        }


# ============================================================
# Service 本体
# ============================================================


class PickupSettingsService:
    """
    Farmer Pickup Settings 用サービス。
    PublicFarmDetail と同期させた「予約がある間はロック、イベントが過ぎればリセット」
    のロジックを持つが、GET では決して例外を外に投げない安定版。
    """

    def __init__(self) -> None:
        self.repo = PickupSettingsRepository()
        # reservation_expanded 用のリポジトリ（confirmed 予約を取得するために使う）
        self.reservation_repo = ReservationExpandedRepository()

    # --------------------------------------------------------
    # active 用の「現在イベントの confirmed 件数」を計算
    # --------------------------------------------------------

    def _count_confirmed_for_current_event(
        self,
        farm_id: int,
        farm_pickup_time: Optional[str],
    ) -> int:
        """
        reservation_expanded と同じロジックで、
        「今の時刻から見た 1 つのイベント」に属する confirmed 予約だけを数える。

        - farms.pickup_time が未設定なら 0
        - reservations.status = 'confirmed' のみ対象
        - created_at から _calc_event_for_booking() で属する週を判定し、
          _calc_event_for_export() が選んだ event_start と同じ週のものだけカウント
        """
        if not farm_pickup_time:
            return 0

        pickup_slot_code = farm_pickup_time

        # 該当 farm / スロットの confirmed 予約をすべて取得
        reservation_records = self.reservation_repo.get_confirmed_reservations_for_farm(
            farm_id=farm_id,
            pickup_slot_code=pickup_slot_code,
        )

        if not reservation_records:
            return 0

        now = datetime.now(JST)
        export_event_start, _export_event_end = _calc_event_for_export(
            now, pickup_slot_code
        )

        count = 0
        for rec in reservation_records:
            if not rec.created_at:
                continue

            try:
                created_at_dt = _parse_db_datetime(rec.created_at)
            except Exception:
                # created_at が壊れている場合はスキップ
                continue

            booking_event_start, _booking_event_end = _calc_event_for_booking(
                created_at_dt, pickup_slot_code
            )

            # 「今表示対象のイベント」と同じ週に属する予約だけをカウント
            if booking_event_start.date() == export_event_start.date():
                count += 1

        return count

    # --------------------------------------------------------
    # active フラグ計算（0 or 1）
    # --------------------------------------------------------

    def _compute_active_flag(
        self,
        farm_id: int,
        farm_pickup_time: Optional[str],
    ) -> int:
        """
        reservation_expanded のロジックと揃えて active を判定する。

        - pickup_time 未設定 → active=0
        - 今の時刻から見た「1つのイベント」に属する confirmed が 1件以上あれば active=1
        - そのイベントが過ぎて、次のイベントに confirmed が無ければ active=0
        """
        if not farm_pickup_time:
            return 0

        current_event_count = self._count_confirmed_for_current_event(
            farm_id=farm_id,
            farm_pickup_time=farm_pickup_time,
        )

        return 1 if current_event_count > 0 else 0

    # --------------------------------------------------------
    # GET
    # --------------------------------------------------------

    def get_pickup_settings(self, farm_id: int) -> PickupSettingsResult:
        farm_row = self.repo.fetch_farm_pickup(farm_id)
        if farm_row is None:
            # これは本当に致命的な場合だけ 500 / 404 にしたいのでそのまま投げる
            raise FarmNotFoundError(farm_id)

        # ここで計算中に何かあっても、フロントが壊れないように必ず active=0 にフォールバック
        try:
            active_count = self._compute_active_flag(
                farm_id=farm_id,
                farm_pickup_time=farm_row.get("pickup_time"),
            )
        except Exception:
            # ログは API 側で出るので、ここでは「編集可能だが count=0」として返す
            active_count = 0

        can_edit_pickup = active_count == 0

        farm_dto = PickupFarmDTO(
            farm_id=farm_row["farm_id"],
            owner_lat=farm_row.get("owner_lat"),
            owner_lng=farm_row.get("owner_lng"),
            pickup_lat=farm_row.get("pickup_lat") or 0.0,
            pickup_lng=farm_row.get("pickup_lng") or 0.0,
            pickup_place_name=farm_row.get("pickup_place_name") or "",
            pickup_notes=farm_row.get("pickup_notes"),
            pickup_time=farm_row.get("pickup_time") or "",
        )

        status_dto = PickupStatusDTO(
            active_reservations_count=active_count,
            can_edit_pickup=can_edit_pickup,
        )

        return PickupSettingsResult(farm=farm_dto, status=status_dto)

    # --------------------------------------------------------
    # UPDATE
    # --------------------------------------------------------

    def update_pickup_settings(
        self,
        farm_id: int,
        *,
        pickup_lat: float,
        pickup_lng: float,
        pickup_place_name: str,
        pickup_notes: Optional[str],
        pickup_time: str,
    ) -> PickupSettingsResult:

        farm_row = self.repo.fetch_farm_pickup(farm_id)
        if farm_row is None:
            raise FarmNotFoundError(farm_id)

        # 更新時は「ロック中なら例外を投げる」挙動は維持
        active_count = self._compute_active_flag(
            farm_id=farm_id,
            farm_pickup_time=farm_row.get("pickup_time"),
        )

        if active_count > 0:
            orig_lat = farm_row["pickup_lat"]
            orig_lng = farm_row["pickup_lng"]
            orig_time = farm_row.get("pickup_time") or ""
            orig_place_name = farm_row["pickup_place_name"]
            orig_notes = farm_row.get("pickup_notes") or ""

            lat_changed = float(orig_lat) != float(pickup_lat)
            lng_changed = float(orig_lng) != float(pickup_lng)
            time_changed = str(orig_time) != str(pickup_time)
            place_changed = str(orig_place_name or "") != str(pickup_place_name or "")
            notes_changed = str(orig_notes or "") != str(pickup_notes or "")

            if (
                lat_changed
                or lng_changed
                or time_changed
                or place_changed
                or notes_changed
            ):
                raise PickupLockedError(farm_id, active_count)

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

        return self.get_pickup_settings(farm_id)
