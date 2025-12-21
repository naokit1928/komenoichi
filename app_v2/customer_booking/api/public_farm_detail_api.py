from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app_v2.customer_booking.dtos import PublicFarmDetailDTO
from app_v2.customer_booking.repository.public_farm_detail_repo import (
    PublicFarmDetailRepository,
)
from app_v2.customer_booking.services.public_farm_detail_service import (
    PublicFarmDetailService,
)


router = APIRouter(
    prefix="/api/public",
    tags=["public_farm_detail"],
)


# ============================================================
# Response Model
# ============================================================

class PublicFarmDetailResponse(BaseModel):
    ok: bool
    farm: PublicFarmDetailDTO | None = None
    error_code: str | None = None
    message: str | None = None


# ============================================================
# Farm Detail API
# ============================================================

@router.get(
    "/farms/{farm_id}",
    response_model=PublicFarmDetailResponse,
)
def get_public_farm_detail(
    farm_id: int,
) -> PublicFarmDetailResponse:
    """
    顧客向け 農家詳細ページ（FarmDetailPage）用 API。

    - 公開中 & 予約受付中の farm のみ取得
    - 存在しない / 非公開の場合は ok=false を返す
    """

    repo = PublicFarmDetailRepository()
    service = PublicFarmDetailService(repo=repo)

    farm = service.get_public_farm_detail(farm_id=farm_id)

    if farm is None:
        return PublicFarmDetailResponse(
            ok=False,
            farm=None,
            error_code="FARM_NOT_FOUND",
            message="指定された農家は存在しないか、現在は公開されていません。",
        )

    return PublicFarmDetailResponse(
        ok=True,
        farm=farm,
    )
