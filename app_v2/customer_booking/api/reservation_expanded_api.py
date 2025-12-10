from fastapi import APIRouter, Query

from app_v2.customer_booking.dtos import ExportReservationsResponseDTO
from app_v2.customer_booking.services.reservation_expanded_service import (
    ReservationExpandedService,
)

router = APIRouter(tags=["reservations-export"])

_service = ReservationExpandedService()


@router.get(
    "/reservations/expanded",
    response_model=ExportReservationsResponseDTO,
)
def get_reservations_expanded(
    farm_id: int = Query(..., ge=1, description="対象となる農家ID"),
) -> ExportReservationsResponseDTO:
    """
    Export ページ V2 用の ViewModel API。

    - 今週の受け渡しイベント（1回分）を判定し
    - そのイベントに属する confirmed 予約だけを集め
    - ExportBluePrint.md どおりの DTO を返す。
    """
    return _service.build_export_view(farm_id=farm_id)

from fastapi import APIRouter, Query, Request
from app_v2.customer_booking.repository import reservation_repo
from app_v2.customer_booking.dtos import LastConfirmedFarmResponse

router = APIRouter(tags=["reservations-export"])

_service = ReservationExpandedService()


@router.get(
    "/reservations/expanded",
    response_model=ExportReservationsResponseDTO,
)
def get_reservations_expanded(
    farm_id: int = Query(..., ge=1, description="対象となる農家ID"),
) -> ExportReservationsResponseDTO:
    return _service.build_export_view(farm_id=farm_id)


# ============================================================
# ★ 新規追加：最後に confirmed した farm_id を返す API
# ============================================================

@router.get("/public/last-confirmed-farm", response_model=LastConfirmedFarmResponse)
def get_last_confirmed_farm(request: Request) -> LastConfirmedFarmResponse:
    # ★ 現在は user_id が固定 or セッションから取り出す設計
    user_id = 1   # ← 後で LINE ログイン実装時に置き換える

    farm_id = reservation_repo.get_last_confirmed_farm_id(user_id)
    return LastConfirmedFarmResponse(farm_id=farm_id)

