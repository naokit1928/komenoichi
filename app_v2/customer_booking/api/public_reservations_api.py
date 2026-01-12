from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from app_v2.customer_booking.repository.latest_reservation_repo import (
    LatestReservationRepository,
)

router = APIRouter(
    prefix="/api/public/reservations",
    tags=["public-reservations"],
)


@router.get("/latest")
def get_latest_reservation(request: Request):
    """
    ログイン中の consumer が持つ最新の confirmed reservation_id を返す。

    仕様:
    - Session に consumer_id があれば、その consumer の最新予約を返す
    - 未ログインの場合は 404（= 予約なし扱い）
    """

    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        # ログアウト状態 → 予約なし扱い
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NO_ACTIVE_RESERVATION",
        )

    repo = LatestReservationRepository()
    reservation_id = repo.get_latest_confirmed_reservation_id(
        consumer_id=consumer_id
    )

    if reservation_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NO_ACTIVE_RESERVATION",
        )

    return {"reservation_id": reservation_id}
