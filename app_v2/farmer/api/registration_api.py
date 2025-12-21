from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app_v2.farmer.services.registration_service import (
    RegistrationService,
    RegistrationError,
    FarmAlreadyExistsError,
    FarmerNotFriendError,
)

router = APIRouter(
    prefix="/farmer/registration",
    tags=["farmer-registration"],
)


class RegistrationRequest(BaseModel):
    line_user_id: str

    owner_last_name: str
    owner_first_name: str
    owner_last_kana: str
    owner_first_kana: str
    owner_postcode: str
    owner_pref: str
    owner_city: str
    owner_addr_line: str
    owner_phone: str

    pickup_lat: float
    pickup_lng: float
    pickup_place_name: str
    pickup_notes: str | None = None
    pickup_time: str


class RegistrationResponse(BaseModel):
    ok: bool = True
    farm_id: int
    settings_url_hint: str
    note: str


@router.post(
    "/finish_registration",
    response_model=RegistrationResponse,
)
def finish_registration(payload: RegistrationRequest) -> RegistrationResponse:
    service = RegistrationService()

    try:
        result = service.register_new_farm(
            farmer_line_id=payload.line_user_id,
            is_friend=1,
            owner_last_name=payload.owner_last_name,
            owner_first_name=payload.owner_first_name,
            owner_last_kana=payload.owner_last_kana,
            owner_first_kana=payload.owner_first_kana,
            owner_postcode=payload.owner_postcode,
            owner_pref=payload.owner_pref,
            owner_city=payload.owner_city,
            owner_addr_line=payload.owner_addr_line,
            owner_phone=payload.owner_phone,
            pickup_lat=payload.pickup_lat,
            pickup_lng=payload.pickup_lng,
            pickup_place_name=payload.pickup_place_name,
            pickup_notes=payload.pickup_notes,
            pickup_time=payload.pickup_time,
        )

    except FarmerNotFriendError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="friendship required",
        )

    except FarmAlreadyExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"farm already exists (farm_id={e.farm_id})",
        )

    except RegistrationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return RegistrationResponse(
        ok=True,
        farm_id=result.farm_id,
        settings_url_hint=result.settings_url_hint,
        note=result.note,
    )
