# app_v2/farmer/api/pickup_settings_api.py
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app_v2.farmer.services.pickup_settings_service import (
    PickupSettingsService,
    PickupSettingsError,
    FarmNotFoundError,
    PickupLockedError,
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
    """
    organize_data.md / Farmer Domain V2 の

      {
        "farm": { ... },
        "status": { ... }
      }

    構造に対応するレスポンス。
    """
    farm: PickupFarmResponse
    status: PickupStatusResponse


class PickupSettingsUpdateRequest(BaseModel):
    """
    Pickup Settings Page からの更新リクエスト。
    """
    farm_id: int = Field(
        ...,
        description="対象の farm_id",
    )
    pickup_lat: float = Field(
        ...,
        description="受け渡し場所の緯度",
    )
    pickup_lng: float = Field(
        ...,
        description="受け渡し場所の経度",
    )
    pickup_place_name: str = Field(
        ...,
        description="受け渡し場所の名称",
    )
    pickup_notes: Optional[str] = Field(
        None,
        description="補足メモ（任意。空文字でも可）",
    )
    pickup_time: str = Field(
        ...,
        description='受け渡し時間スロット（例: "WED_19_20" など）',
    )


# ============================================================
# GET: 現在の設定を取得
# ============================================================


@router.get(
    "",
    response_model=PickupSettingsResponse,
    summary="Get Pickup Settings for a farm",
)
def get_pickup_settings(
    farm_id: int,
) -> PickupSettingsResponse:
    """
    Pickup Settings Page 初期表示用のデータを取得する。

    フロントからの想定呼び出し:
      GET /api/farmer/pickup-settings?farm_id=63
    """
    service = PickupSettingsService()

    try:
        result = service.get_pickup_settings(farm_id)
    except FarmNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except PickupSettingsError as e:
        # その他のドメインエラー
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="failed to load pickup settings",
        )

    return PickupSettingsResponse(**result.to_dict())


# ============================================================
# POST: 設定を更新
# ============================================================


@router.post(
    "",
    response_model=PickupSettingsResponse,
    summary="Update Pickup Settings for a farm",
)
def update_pickup_settings(
    payload: PickupSettingsUpdateRequest,
) -> PickupSettingsResponse:
    """
    Pickup Settings Page の「保存」ボタンから呼ばれる更新エンドポイント。
    """
    service = PickupSettingsService()

    try:
        result = service.update_pickup_settings(
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
        # 今週予約ありのためロック
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"pickup settings locked because there are "
                f"{e.active_reservations_count} active reservations this week"
            ),
        )

    except PickupSettingsError as e:
        # その他ドメインエラー
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="failed to update pickup settings",
        )

    return PickupSettingsResponse(**result.to_dict())
