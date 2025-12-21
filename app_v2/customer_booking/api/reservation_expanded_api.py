from fastapi import APIRouter, Query

from app_v2.customer_booking.dtos import ExportReservationsResponseDTO
from app_v2.customer_booking.services.reservation_expanded_service import (
    ReservationExpandedService,
)

# ============================================================
# Router
# ============================================================

router = APIRouter(tags=["reservations-export"])

_service = ReservationExpandedService()


# ============================================================
# GET /reservations/expanded
# ============================================================

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

    注意:
    - reservations 系の API / Service / Repo は参照しない
    - confirmed_v2 を正とする
    """
    return _service.build_export_view(farm_id=farm_id)
