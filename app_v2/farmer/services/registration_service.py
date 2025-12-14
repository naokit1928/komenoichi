from __future__ import annotations

from dataclasses import dataclass

from app_v2.farmer.dtos import OwnerDTO, FarmPickupDTO
from app_v2.farmer.repository.registration_repo import RegistrationRepository
from app_v2.farmer.services.location_service import (
    GeocodeResult,
    geocode_address,
)


# ============================================================
# 例外
# ============================================================

class RegistrationError(Exception):
    pass


class FarmerNotFriendError(RegistrationError):
    pass


class FarmAlreadyExistsError(RegistrationError):
    def __init__(self, farm_id: int) -> None:
        self.farm_id = farm_id
        super().__init__(f"farm already exists (farm_id={farm_id})")


# ============================================================
# 戻り値 DTO
# ============================================================

@dataclass
class RegistrationResult:
    farm_id: int
    settings_url_hint: str
    note: str = "Farmer registration completed"


# ============================================================
# Service
# ============================================================

class RegistrationService:
    """
    Phase1 後対応 Farmer Registration Service

    - users は一切参照しない
    - farmer_line_id を唯一の識別子とする
    """

    def __init__(self) -> None:
        self.repo = RegistrationRepository()

    # --------------------------------------------------------
    # geocode
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
    # main
    # --------------------------------------------------------
    def register_new_farm(
        self,
        *,
        farmer_line_id: str,
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
        is_friend: int,
    ) -> RegistrationResult:

        # 1. friend 判定（farms 基準）
        if int(is_friend) != 1:
            raise FarmerNotFriendError("friendship required")

        # 2. 既存 farm チェック（farmer_line_id）
        existing_farm_id = self.repo.get_existing_farm_id_by_line_id(farmer_line_id)
        if existing_farm_id is not None:
            raise FarmAlreadyExistsError(existing_farm_id)

        # 3. DTO
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

        # 4. geocode
        owner_lat, owner_lng = self._geocode_owner_address(
            owner_pref=owner_pref,
            owner_city=owner_city,
            owner_addr_line=owner_addr_line,
        )

        try:
            # 5. create farm
            farm_id = self.repo.create_farm_for_registration(
                farmer_line_id=farmer_line_id,
                is_friend=is_friend,
                owner=owner_dto,
                pickup=pickup_dto,
                owner_lat=owner_lat,
                owner_lng=owner_lng,
            )
            self.repo.commit()
        except Exception:
            self.repo.rollback()
            raise

        return RegistrationResult(
            farm_id=farm_id,
            settings_url_hint=f"/farmer/settings?farm_id={farm_id}",
        )
