from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app_v2.customer_booking.repository.latest_reservation_repo import (
    LatestReservationRepository,
)

router = APIRouter(
    prefix="/api/public/reservations",
    tags=["public-reservations"],
)


@router.get("/latest")
def get_latest_reservation():
    """
    最新の confirmed reservation_id を返す。

    NOTE:
    - 現在は consumer_id を固定（consumer_history_api と同じ前提）
    - LINE / Session 導入後に Depends 化する
    """

    consumer_id = 1  # ← 現状仕様に合わせる（重要）

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
