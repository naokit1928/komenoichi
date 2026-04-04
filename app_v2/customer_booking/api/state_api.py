from __future__ import annotations

from fastapi import APIRouter, Request

from app_v2.customer_booking.services.state_service import StateService

router = APIRouter(
    prefix="/api/consumer",
    tags=["consumer_state"],
)


@router.get("/state")
def get_consumer_state(request: Request):
    """
    Consumer の現在の予約状態＋ペナルティ状態を返す

    penalty.status:
      "none"   → 正常
      "banned" → 3回（no_show + late_cancel 合算）でBAN
    """
    consumer_id = request.session.get("consumer_id")

    try:
        consumer_id_int = int(consumer_id) if consumer_id is not None else None
    except Exception:
        consumer_id_int = None

    service = StateService()
    return service.get_state(consumer_id=consumer_id_int)

# /pardon エンドポイントは pardon制度廃止により削除