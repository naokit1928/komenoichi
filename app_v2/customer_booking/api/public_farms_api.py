from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app_v2.customer_booking.dtos import (
    PublicFarmListResponse,
    PublicFarmDetailDTO,
    PublicFarmCardDTO,
)
from app_v2.customer_booking.repository.public_farms_repo import PublicFarmsRepository
from app_v2.customer_booking.repository.public_farm_detail_repo import (
    PublicFarmDetailRepository,
)
from app_v2.customer_booking.services.public_farms_service import PublicFarmsService
from app_v2.customer_booking.services.public_farm_detail_service import (
    PublicFarmDetailService,
)

router = APIRouter(prefix="/api/public", tags=["public_farms_v2"])


# ============================================================
# ① まず /farms/map を定義する（ルーティング衝突防止のため最優先）
# ============================================================
@router.get("/farms/map", response_model=list[PublicFarmCardDTO])
def list_public_farms_for_map(
    min_lat: float = Query(...),
    max_lat: float = Query(...),
    min_lng: float = Query(...),
    max_lng: float = Query(...),
    limit: int = Query(200, ge=1, le=500),
) -> list[PublicFarmCardDTO]:
    """
    地図表示用の公開農家一覧を返すエンドポイント。

    - min_lat/max_lat/min_lng/max_lng: 地図のバウンディングボックス
    - limit: 最大件数（デフォルト 200, 最大 500）
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
# ② public farms list（ページング）
# ============================================================
@router.get("/farms", response_model=PublicFarmListResponse)
def list_public_farms(
    page: int = Query(1, ge=1),
    lat: float | None = Query(None),
    lng: float | None = Query(None),
) -> PublicFarmListResponse:
    """
    顧客向けの公開農家一覧を返すエンドポイント。

    - page: 1始まりのページ番号（1ページ8件固定）
    - lat/lng: ユーザー位置（任意）。省略時は徳島中心にフォールバック。
    """
    repo = PublicFarmsRepository()
    service = PublicFarmsService(repo=repo)
    return service.get_public_farms(page=page, lat=lat, lng=lng)


# ============================================================
# ③ farm detail（FarmDetailPage 用）
# ============================================================
class PublicFarmDetailResponse(BaseModel):
    ok: bool = True
    farm: PublicFarmDetailDTO | None = None
    error_code: str | None = None
    message: str | None = None


@router.get("/farms/{farm_id}", response_model=PublicFarmDetailResponse)
def get_public_farm_detail(
    farm_id: int,
) -> PublicFarmDetailResponse:
    """
    顧客向けの農家詳細（FarmDetailPage 用）を返すエンドポイント。
    """
    repo = PublicFarmDetailRepository()
    service = PublicFarmDetailService(repo=repo)

    dto = service.get_public_farm_detail(farm_id=farm_id)
    if dto is None:
        return PublicFarmDetailResponse(
            ok=False,
            farm=None,
            error_code="FARM_NOT_FOUND",
            message="指定された農家は見つからないか、現在は公開されていません。",
        )

    return PublicFarmDetailResponse(ok=True, farm=dto)
