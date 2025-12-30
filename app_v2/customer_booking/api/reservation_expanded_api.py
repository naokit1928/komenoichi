from fastapi import APIRouter, Request, HTTPException, status

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
    request: Request,
) -> ExportReservationsResponseDTO:
    """
    Export ページ V2 用の ViewModel API（ME 前提）。

    - farm_id は URL / Query / Body からは一切受け取らない
    - request.session["farm_id"] を唯一の正とする
    - 今週の受け渡しイベント（1回分）を判定し
    - そのイベントに属する confirmed 予約だけを集め
    - ExportBluePrint.md どおりの DTO を返す

    注意:
    - reservations 系の API / Service / Repo は参照しない
    - confirmed_v2 を正とする
    """

    farm_id = request.session.get("farm_id")
    if not farm_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    return _service.build_export_view(farm_id=farm_id)
