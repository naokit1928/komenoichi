from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app_v2.customer_booking.dtos import (
    PublicFarmListResponse,
    PublicFarmDetailDTO,
    PublicFarmCardDTO,
)
from app_v2.customer_booking.services.public_farms_service import (
    PublicFarmsService,
)
from app_v2.customer_booking.services.public_farm_detail_service import (
    PublicFarmDetailService,
)
from app_v2.customer_booking.repository.public_farms_repo import (
    PublicFarmsRepository,
)
from app_v2.customer_booking.repository.public_farm_detail_repo import (
    PublicFarmDetailRepository,
)

router = APIRouter(
    prefix="/api/public",
    tags=["public_farms"],
)

# ============================================================
# 地図表示用（最優先定義：ルーティング衝突防止）
# ============================================================
@router.get(
    "/farms/map",
    response_model=list[PublicFarmCardDTO],
)
def list_public_farms_for_map(
    min_lat: float = Query(...),
    max_lat: float = Query(...),
    min_lng: float = Query(...),
    max_lng: float = Query(...),
    limit: int = Query(200, ge=1, le=500),
) -> list[PublicFarmCardDTO]:
    """
    地図モーダル用の公開農家一覧。
    バウンディングボックス内の農家を最大 limit 件返す。
    """
    repo = PublicFarmsRepository()
    service = PublicFarmsService(repo=repo)

    return service.get_public_farms_for_map(
        min_lat=min_lat,
        max_lat=max_lat,
        min_lng=min_lng,
        max_lng=max_lng,
        limit=limit,
    )


# ============================================================
# 公開農家一覧（ページング）
# ============================================================
@router.get(
    "/farms",
    response_model=PublicFarmListResponse,
)
def list_public_farms(
    page: int = Query(1, ge=1),
    lat: float | None = Query(None),
    lng: float | None = Query(None),
) -> PublicFarmListResponse:
    """
    Public Page 用の農家一覧。
    - page: 1始まり
    - lat/lng: ユーザー位置（任意）
    """
    repo = PublicFarmsRepository()
    service = PublicFarmsService(repo=repo)

    return service.get_public_farms(
        page=page,
        lat=lat,
        lng=lng,
    )


# ============================================================
# 農家詳細（Detail Page）
# ============================================================
class PublicFarmDetailResponse(BaseModel):
    ok: bool
    farm: PublicFarmDetailDTO | None = None
    error_code: str | None = None
    message: str | None = None


@router.get(
    "/farms/{farm_id}",
    response_model=PublicFarmDetailResponse,
)
def get_public_farm_detail(
    farm_id: int,
) -> PublicFarmDetailResponse:
    """
    Public Detail Page 用の農家詳細。
    """
    repo = PublicFarmDetailRepository()
    service = PublicFarmDetailService(repo=repo)

    dto = service.get_public_farm_detail(farm_id=farm_id)

    if dto is None:
        return PublicFarmDetailResponse(
            ok=False,
            farm=None,
            error_code="FARM_NOT_FOUND",
            message="指定された農家は存在しないか、現在は公開されていません。",
        )

    return PublicFarmDetailResponse(
        ok=True,
        farm=dto,
    )
