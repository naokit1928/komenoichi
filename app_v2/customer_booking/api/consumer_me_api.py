from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse

from app_v2.customer_booking.repository.latest_reservation_repo import (
    LatestReservationRepository,
)
from app_v2.customer_booking.services.reservation_booked_service import (
    ReservationBookedService,
)

router = APIRouter(
    prefix="/consumers",
    tags=["consumers"],
)


@router.get("/me")
def get_consumer_me(request: Request):
    """
    whoami API（最小構成・安定版）

    - session に consumer_id があればログイン済み
    - 有効な予約（confirmed & not expired）があるかを返す
    - identity（email 等）は扱わない
    """

    consumer_id = request.session.get("consumer_id")

    # 未ログイン
    if not consumer_id:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "consumer_id": None,
                "is_logged_in": False,
                "has_active_reservation": False,
            },
        )

    # 型安全
    try:
        consumer_id_int = int(consumer_id)
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "invalid consumer_id in session"},
        )

    # 最新 confirmed reservation_id を取得
    latest_repo = LatestReservationRepository()
    reservation_id = latest_repo.get_latest_confirmed_reservation_id(
        consumer_id=consumer_id_int
    )

    # confirmed reservation がない
    if reservation_id is None:
        return {
            "consumer_id": consumer_id_int,
            "is_logged_in": True,
            "has_active_reservation": False,
        }

    # expired 判定は既存 service に委譲
    service = ReservationBookedService()
    view = service.get_view_for_reservation(reservation_id)

    # 理論上 None にはならないが防御
    if view is None:
        return {
            "consumer_id": consumer_id_int,
            "is_logged_in": True,
            "has_active_reservation": False,
        }

    return {
        "consumer_id": consumer_id_int,
        "is_logged_in": True,
        "has_active_reservation": not view.is_expired_for_display,
    }
