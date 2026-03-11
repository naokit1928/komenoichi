from __future__ import annotations

from dataclasses import dataclass

from app_v2.farmer.dtos import OwnerDTO, FarmPickupDTO
from app_v2.farmer.repository.registration_repo import RegistrationRepository
from app_v2.farmer.services.location_service import (
    geocode_address,
    GeocodeResult,
)


# ============================================================
# Exceptions
# ============================================================

class RegistrationError(Exception):
    """Base registration error"""


# ============================================================
# Result DTO
# ============================================================

@dataclass
class RegistrationResult:
    farm_id: int
    settings_url_hint: str
    note: str = "registration successful"


# ============================================================
# Service
# ============================================================

class RegistrationService:
    def __init__(self) -> None:
        self.repo = RegistrationRepository()

    # --------------------------------------------------------
    # Internal helpers
    # --------------------------------------------------------

    def _geocode_owner_address(
        self,
        *,
        owner_pref: str,
        owner_city: str,
        owner_addr_line: str,
    ) -> tuple[float, float]:
        address = f"{owner_pref}{owner_city}{owner_addr_line}".strip()
        if not address:
            raise RegistrationError("owner address is empty")

        result: GeocodeResult = geocode_address(address=address, region="jp")

        if not result.ok or result.lat is None or result.lng is None:
            raise RegistrationError("failed to geocode owner address")

        return float(result.lat), float(result.lng)

    # --------------------------------------------------------
    # Public API
    # --------------------------------------------------------

    def complete_registration(
        self,
        *,
        session_farm_id: int,
        owner_last_name: str,
        owner_first_name: str,
        owner_last_kana: str,
        owner_first_kana: str,
        owner_postcode: str,
        owner_pref: str,
        owner_city: str,
        owner_addr_line: str,
        owner_phone: str,
        pickup_lat: float,
        pickup_lng: float,
        pickup_place_name: str,
        pickup_notes: str | None,
        pickup_time: str,
    ) -> RegistrationResult:
        # 1. farm existence check
        farm_id = session_farm_id
        existing = self.repo.get_farm_by_id(farm_id)
        if existing is None:
            raise RegistrationError("farm not found")

        # 2. pickup 座標の妥当性チェック
        if not (-90 <= pickup_lat <= 90) or not (-180 <= pickup_lng <= 180):
            raise RegistrationError("invalid pickup coordinates")

        # 3. build DTOs
        owner_dto = OwnerDTO(
            owner_last_name=owner_last_name,
            owner_first_name=owner_first_name,
            owner_last_kana=owner_last_kana,
            owner_first_kana=owner_first_kana,
            owner_postcode=owner_postcode,
            owner_pref=owner_pref,
            owner_city=owner_city,
            owner_addr_line=owner_addr_line,
            owner_phone=owner_phone,
        )

        pickup_dto = FarmPickupDTO(
            farm_id=farm_id,
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            pickup_place_name=pickup_place_name,
            pickup_notes=pickup_notes,
            pickup_time=pickup_time,
        )

        # 4. geocode owner address
        owner_lat, owner_lng = self._geocode_owner_address(
            owner_pref=owner_pref,
            owner_city=owner_city,
            owner_addr_line=owner_addr_line,
        )

        # 5. initial state
        active_flag = 1
        is_public = 0
        is_accepting_reservations = 0

        # 6. persist
        try:
            self.repo.update_farm_registration(
                farm_id=farm_id,
                owner=owner_dto,
                pickup=pickup_dto,
                owner_lat=owner_lat,
                owner_lng=owner_lng,
                active_flag=active_flag,
                is_public=is_public,
                is_accepting_reservations=is_accepting_reservations,
            )

            # owner_farmer_id を自身に設定
            # NOTE: 現状 farm = farmer の 1:1 対応。将来分離する場合は要変更。
            self.repo.set_owner_farmer_id(
                farm_id=farm_id,
                owner_farmer_id=farm_id,
            )

            # registration_status を1段階進める
            self.repo.set_registration_status(
                farm_id=farm_id,
                registration_status="PROFILE_COMPLETED",
            )

            self.repo.commit()

        except Exception:
            self.repo.rollback()
            raise
        finally:
            self.repo.close()

        return RegistrationResult(
            farm_id=farm_id,
            settings_url_hint=f"/farmer/settings?farm_id={farm_id}",
        )
