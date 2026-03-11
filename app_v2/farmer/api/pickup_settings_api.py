from __future__ import annotations

from typing import Optional
import sqlite3

from fastapi import APIRouter, HTTPException, status, Request, Depends
from pydantic import BaseModel, Field

from app_v2.db.core import get_db_conn

from app_v2.farmer.services.pickup.pickup_settings_facade import (
    PickupSettingsFacade,
    PickupLockedError,
    PickupDistanceError,
)
from app_v2.farmer.services.pickup.pickup_settings_service import (
    FarmNotFoundError,
)

router = APIRouter(
    prefix="/farmer/pickup-settings",
    tags=["farmer-pickup-settings-v2"],
)

# ============================================================
# Schemas
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


class PickupSettingsUpdateMeRequest(BaseModel):
    pickup_lat: Optional[float] = Field(None, description="緯度")
    pickup_lng: Optional[float] = Field(None, description="経度")

    # ★ 追加: 文字数制限 (Frontendと合わせる)
    pickup_place_name: Optional[str] = Field(
        None, 
        max_length=12, 
        description="場所名（最大12文字）"
    )
    pickup_notes: Optional[str] = Field(
        None, 
        max_length=100, 
        description="メモ（最大100文字）"
    )

    pickup_time: Optional[str] = Field(None, description="時間スロット")


# ============================================================
# GET /me
# ============================================================


@router.get(
    "/me",
    response_model=PickupSettingsResponse,
)
def get_pickup_settings_me(
    request: Request,
    conn: sqlite3.Connection = Depends(get_db_conn),
) -> PickupSettingsResponse:
    farm_id = request.session.get("farm_id")
    if not farm_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="not authenticated",
        )

    facade = PickupSettingsFacade(conn)

    try:
        result = facade.get_settings(farm_id)
    except FarmNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="failed to load settings")

    return PickupSettingsResponse(
        farm=PickupFarmResponse(**result.farm.__dict__),
        status=PickupStatusResponse(
            active_reservations_count=result.status.active_reservations_count,
            can_edit_pickup=result.status.can_edit_pickup,
        ),
    )


# ============================================================
# POST /me (PATCH動作)
# ============================================================


@router.post(
    "/me",
    response_model=PickupSettingsResponse,
)
def update_pickup_settings_me(
    request: Request,
    payload: PickupSettingsUpdateMeRequest,
    conn: sqlite3.Connection = Depends(get_db_conn),
) -> PickupSettingsResponse:
    farm_id = request.session.get("farm_id")
    if not farm_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="not authenticated",
        )

    facade = PickupSettingsFacade(conn)

    try:
        # exclude_unset=True で、送信されなかった項目を除外して渡す
        result = facade.update_settings(
            farm_id=farm_id,
            **payload.dict(exclude_unset=True)
        )

    except FarmNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    except PickupLockedError as e:
        # 予約があるためロック中
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"locked: {e.active_reservations_count} reservations active",
        )

    except PickupDistanceError as e:
        # ★ 追加: 距離制限エラー (400 Bad Request)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except Exception:
        raise HTTPException(status_code=500, detail="failed to update settings")

    return PickupSettingsResponse(
        farm=PickupFarmResponse(**result.farm.__dict__),
        status=PickupStatusResponse(
            active_reservations_count=result.status.active_reservations_count,
            can_edit_pickup=result.status.can_edit_pickup,
        ),
    )