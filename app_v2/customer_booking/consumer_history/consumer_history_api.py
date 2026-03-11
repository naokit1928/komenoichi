# app_v2/customer_booking/consumer_history/consumer_history_api.py
from __future__ import annotations

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone

from app_v2.customer_booking.dtos import (
    LastConfirmedFarmResponse,
)
from app_v2.customer_booking.consumer_history.consumer_history_repo import (
    ConsumerHistoryRepository,
)

# ── 履歴用の新しいDTO ──
class ReservationHistoryItem(BaseModel):
    reservation_id: int
    farm_id: int
    farm_name: str
    last_name: Optional[str] = None
    pickup_display: str
    total_amount: int
    status_category: str  # "upcoming" | "completed" | "canceled"

# ------------------------------------------------------------
# Router
# ------------------------------------------------------------

router = APIRouter(
    prefix="/api/public",
    tags=["consumer_history"],
)

# ------------------------------------------------------------
# GET /api/public/last-confirmed-farm
# ------------------------------------------------------------

@router.get(
    "/last-confirmed-farm",
    response_model=LastConfirmedFarmResponse,
)
def get_last_confirmed_farm(
    request: Request,
) -> LastConfirmedFarmResponse:
    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        return LastConfirmedFarmResponse(farm_id=None)

    repo = ConsumerHistoryRepository()
    farm_id = repo.get_last_confirmed_farm_id(int(consumer_id))
    return LastConfirmedFarmResponse(farm_id=farm_id)


# ------------------------------------------------------------
# GET /api/public/reservations/history
# ------------------------------------------------------------
@router.get(
    "/reservations/history",
    response_model=List[ReservationHistoryItem],
)
def get_consumer_reservation_history(request: Request):
    """
    ログイン中のユーザーの予約履歴一覧（現在＋過去）を返す
    """
    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Not authenticated"})

    repo = ConsumerHistoryRepository()
    rows = repo.get_consumer_reservations_with_farm_info(int(consumer_id))

    now_utc = datetime.now(timezone.utc)
    results = []

    for row in rows:
        # ★ DBの値を強制的に小文字にする（CANCELED対策）
        db_status = (row["status"] or "").lower()
        event_end_str = row["event_end_at"]

        # 状態の判定ロジック (upcoming / completed / canceled)
        cat = "completed"
        if db_status in ("canceled", "cancelled"):
            cat = "canceled"
        elif db_status == "confirmed":
            if event_end_str:
                # タイムゾーン付きでパースして現在時刻と比較
                end_dt = datetime.fromisoformat(event_end_str.replace("Z", "+00:00"))
                if now_utc < end_dt:
                    cat = "upcoming"

        results.append(ReservationHistoryItem(
            reservation_id=row["reservation_id"],
            farm_id=row["farm_id"],
            farm_name=row["farm_name"] or "",
            last_name=row["last_name"],
            pickup_display=row["pickup_display"] or "",
            total_amount=row["rice_subtotal"] or 0,
            status_category=cat
        ))

    return results