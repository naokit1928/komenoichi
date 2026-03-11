from __future__ import annotations

from fastapi import APIRouter, Request

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
    ログイン中の consumer が持つ最新の confirmed 予約の farm_id を返す。
    未ログインや予約なしの場合は 404 ではなく farm_id: None を返す。
    """

    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        # ログアウト状態 → 予約なし扱い (200 OK)
        return {"farm_id": None}

    repo = LatestReservationRepository()
    farm_id = repo.get_latest_confirmed_farm_id(consumer_id=consumer_id)

    # 予約がなくても None が返る (200 OK)
    return {"farm_id": farm_id}