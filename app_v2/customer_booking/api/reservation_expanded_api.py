from fastapi import APIRouter, Request, HTTPException, status, Query

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
    offset: int = Query(0, description="週のオフセット（0=今週, -1=先週, 1=来週）")
) -> ExportReservationsResponseDTO:
    """
    Export ページ V2 用の ViewModel API（ME 前提）。

    - farm_id は URL / Query / Body からは一切受け取らない
    - request.session["farm_id"] を唯一の正とする
    - offset（週の移動）を加味してイベントを判定し
    - そのイベントに属する confirmed 予約だけを集め
    - ExportBluePrint.md どおりの DTO を返す
    """

    farm_id = request.session.get("farm_id")
    if not farm_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    # offset を Service に渡す
    return _service.build_export_view(farm_id=farm_id, offset=offset)