from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, status, Request
from pydantic import BaseModel, Field

from app_v2.farmer.services.pickup.pickup_settings_facade import (
    PickupSettingsFacade,
    PickupLockedError,
)
from app_v2.farmer.services.pickup.pickup_settings_service import (
    FarmNotFoundError,
)

router = APIRouter(
    prefix="/farmer/pickup-settings",
    tags=["farmer-pickup-settings-v2"],
)

# ============================================================
# Pydantic Schemas (Request / Response)
# ============================================================


class PickupFarmResponse(BaseModel):
    farm_id: int
    owner_lat: Optional[float] = None
    owner_lng: Optional[float] = None

    pickup_lat: float
    pickup_lng: float
    pickup_place_name: str
    pickup_notes: Optional[str] = None
    pickup_time: str


class PickupStatusResponse(BaseModel):
    active_reservations_count: int
    can_edit_pickup: bool


class PickupSettingsResponse(BaseModel):
    farm: PickupFarmResponse
    status: PickupStatusResponse


# ※ 既存の farm_id 前提 POST 用（残す・互換維持）
class PickupSettingsUpdateRequest(BaseModel):
    farm_id: int = Field(..., description="対象の farm_id")
    pickup_lat: float = Field(..., description="受け渡し場所の緯度")
    pickup_lng: float = Field(..., description="受け渡し場所の経度")
    pickup_place_name: str = Field(..., description="受け渡し場所の名称")
    pickup_notes: Optional[str] = Field(None, description="補足メモ")
    pickup_time: str = Field(
        ..., description='受け渡し時間スロット（例: "WED_19_20"）'
    )


# ※ ME 用（farm_id を受け取らない）
class PickupSettingsUpdateMeRequest(BaseModel):
    pickup_lat: float = Field(..., description="受け渡し場所の緯度")
    pickup_lng: float = Field(..., description="受け渡し場所の経度")
    pickup_place_name: str = Field(..., description="受け渡し場所の名称")
    pickup_notes: Optional[str] = Field(None, description="補足メモ")
    pickup_time: str = Field(
        ..., description='受け渡し時間スロット（例: "WED_19_20"）'
    )


# ============================================================
# GET /me
# ============================================================


@router.get(
    "/me",
    response_model=PickupSettingsResponse,
    summary="Get Pickup Settings for current farmer (ME)",
)
def get_pickup_settings_me(request: Request) -> PickupSettingsResponse:
    farm_id = request.session.get("farm_id")
    if not farm_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="not authenticated",
        )

    facade = PickupSettingsFacade()

    try:
        result = facade.get_settings(farm_id)

    except FarmNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="failed to load pickup settings",
        )

    return PickupSettingsResponse(
        farm=PickupFarmResponse(**result.farm.__dict__),
        status=PickupStatusResponse(
            active_reservations_count=result.status.active_reservations_count,
            can_edit_pickup=result.status.can_edit_pickup,
        ),
    )


# ============================================================
# POST /me  ★追加（ここが今回の本命）
# ============================================================


@router.post(
    "/me",
    response_model=PickupSettingsResponse,
    summary="Update Pickup Settings for current farmer (ME)",
)
def update_pickup_settings_me(
    request: Request,
    payload: PickupSettingsUpdateMeRequest,
) -> PickupSettingsResponse:
    farm_id = request.session.get("farm_id")
    if not farm_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="not authenticated",
        )

    facade = PickupSettingsFacade()

    try:
        result = facade.update_settings(
            farm_id=farm_id,
            pickup_lat=payload.pickup_lat,
            pickup_lng=payload.pickup_lng,
            pickup_place_name=payload.pickup_place_name,
            pickup_notes=payload.pickup_notes,
            pickup_time=payload.pickup_time,
        )

    except FarmNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    except PickupLockedError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"pickup settings locked because there are "
                f"{e.active_reservations_count} active reservations this week"
            ),
        )

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="failed to update pickup settings",
        )

    return PickupSettingsResponse(
        farm=PickupFarmResponse(**result.farm.__dict__),
        status=PickupStatusResponse(
            active_reservations_count=result.status.active_reservations_count,
            can_edit_pickup=result.status.can_edit_pickup,
        ),
    )


# ============================================================
# POST / （旧・farm_id 指定）※互換用に残す
# ============================================================


@router.post(
    "",
    response_model=PickupSettingsResponse,
    summary="Update Pickup Settings for a farm (legacy)",
)
def update_pickup_settings(
    payload: PickupSettingsUpdateRequest,
) -> PickupSettingsResponse:
    facade = PickupSettingsFacade()

    try:
        result = facade.update_settings(
            farm_id=payload.farm_id,
            pickup_lat=payload.pickup_lat,
            pickup_lng=payload.pickup_lng,
            pickup_place_name=payload.pickup_place_name,
            pickup_notes=payload.pickup_notes,
            pickup_time=payload.pickup_time,
        )

    except FarmNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    except PickupLockedError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"pickup settings locked because there are "
                f"{e.active_reservations_count} active reservations this week"
            ),
        )

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="failed to update pickup settings",
        )

    return PickupSettingsResponse(
        farm=PickupFarmResponse(**result.farm.__dict__),
        status=PickupStatusResponse(
            active_reservations_count=result.status.active_reservations_count,
            can_edit_pickup=result.status.can_edit_pickup,
        ),
    )
