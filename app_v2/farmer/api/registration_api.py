from __future__ import annotations

from fastapi import APIRouter, HTTPException, status, Request
from pydantic import BaseModel

from app_v2.farmer.services.registration_service import (
    RegistrationService,
    RegistrationError,
)

router = APIRouter(
    prefix="/farmer/registration",
    tags=["farmer-registration"],
)


class RegistrationRequest(BaseModel):
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
def finish_registration(
    payload: RegistrationRequest,
    request: Request,
) -> RegistrationResponse:
    farm_id = request.session.get("farm_id")
    if not farm_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="farm session not found",
        )

    service = RegistrationService()

    try:
        result = service.complete_registration(
            session_farm_id=farm_id,
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
