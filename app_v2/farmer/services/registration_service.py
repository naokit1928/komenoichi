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


class FarmerNotFriendError(RegistrationError):
    """LINE friendship is required"""


class FarmAlreadyExistsError(RegistrationError):
    def __init__(self, farm_id: int) -> None:
        self.farm_id = farm_id
        super().__init__(f"farm already exists (farm_id={farm_id})")


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
    """
    Farmer Registration Service

    Responsibilities:
    - Validate registration conditions
    - Control registration flow
    - Decide initial farm state
    - Delegate persistence to repository
    """

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
        """
        Convert owner address to lat/lng.
        """
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

    def register_new_farm(
        self,
        *,
        farmer_line_id: str,
        is_friend: int,
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
        """
        Register a new farm.
        """

        # 1. friendship check
        if int(is_friend) != 1:
            raise FarmerNotFriendError("friendship required")

        # 2. existing farm check
        existing_farm_id = self.repo.get_existing_farm_id_by_line_id(farmer_line_id)
        if existing_farm_id is not None:
            raise FarmAlreadyExistsError(existing_farm_id)

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
            farm_id=None,
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

        # 5. initial state (business rule)
        active_flag = 1
        is_public = 0
        is_accepting_reservations = 0

        # 6. persist
        try:
            farm_id = self.repo.create_farm(
                farmer_line_id=farmer_line_id,
                is_friend=is_friend,
                owner=owner_dto,
                pickup=pickup_dto,
                owner_lat=owner_lat,
                owner_lng=owner_lng,
                active_flag=active_flag,
                is_public=is_public,
                is_accepting_reservations=is_accepting_reservations,
            )
            self.repo.commit()
        except Exception:
            self.repo.rollback()
            raise

        return RegistrationResult(
            farm_id=farm_id,
            settings_url_hint=f"/farmer/settings?farm_id={farm_id}",
        )
