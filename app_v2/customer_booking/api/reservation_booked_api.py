from __future__ import annotations

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    status,
)

from app_v2.customer_booking.services.reservation_booked_service import (
    ReservationBookedService,
    ReservationBookedViewDTO,
)

from app_v2.customer_booking.repository.latest_reservation_repo import (
    LatestReservationRepository,
)

router = APIRouter(
    prefix="/reservations/booked",
    tags=["customer_reservations_booked"],
)

# ============================================================
# Dependencies
# ============================================================

def get_reservation_booked_service() -> ReservationBookedService:
    return ReservationBookedService()


def get_latest_reservation_repo() -> LatestReservationRepository:
    return LatestReservationRepository()


# ============================================================
# 既存互換 API
# GET /api/reservations/booked?reservation_id=xx
# ============================================================

@router.get(
    "",
    response_model=ReservationBookedViewDTO,
)
def get_booked_reservation(
    reservation_id: int = Query(..., gt=0),
    service: ReservationBookedService = Depends(get_reservation_booked_service),
) -> ReservationBookedViewDTO:
    """
    【既存互換用】
    reservation_id を直接指定して ReservationBooked を取得する。
    （将来 deprecated 想定）
    """

    result = service.get_view_for_reservation(reservation_id)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="予約が見つかりません。",
        )

    return result


# ============================================================
# 新 正式 API
# GET /api/reservations/booked/me
# ============================================================

@router.get(
    "/me",
    response_model=ReservationBookedViewDTO,
)
def get_my_booked_reservation(
    request: Request,
    service: ReservationBookedService = Depends(get_reservation_booked_service),
    latest_repo: LatestReservationRepository = Depends(
        get_latest_reservation_repo
    ),
) -> ReservationBookedViewDTO:
    """
    【正式版】
    consumer セッションを基点に、直近の confirmed reservation を返す。

    仕様（確定）:
    - consumer_id は session からのみ取得
    - URL から reservation_id は一切受け取らない
    - 表示対象の予約は API 側で決定する
    """

    # --------------------------------------------------
    # 1) consumer セッション確認
    # --------------------------------------------------
    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="consumer session is required",
        )

    try:
        consumer_id_int = int(consumer_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="invalid consumer_id in session",
        )

    # --------------------------------------------------
    # 2) 最新 confirmed reservation_id を取得
    # --------------------------------------------------
    reservation_id = latest_repo.get_latest_confirmed_reservation_id(
        consumer_id=consumer_id_int
    )

    if reservation_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NO_CONFIRMED_RESERVATION",
        )

    # --------------------------------------------------
    # 3) 既存 ReservationBookedService に完全委譲
    # --------------------------------------------------
    result = service.get_view_for_reservation(reservation_id)

    if result is None:
        # 理論上ここには来ないが、防御的に
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="予約が見つかりません。",
        )

    return result
