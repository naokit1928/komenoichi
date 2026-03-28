from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException

from app_v2.customer_booking.services.state_service import StateService

router = APIRouter(
    prefix="/api/consumer",
    tags=["consumer_state"],
)

@router.get("/state")
def get_consumer_state(request: Request):
    """
    Consumer の現在の予約状態＋ペナルティ状態を返す
    """
    consumer_id = request.session.get("consumer_id")

    try:
        consumer_id_int = int(consumer_id) if consumer_id is not None else None
    except Exception:
        consumer_id_int = None

    service = StateService()
    return service.get_state(consumer_id=consumer_id_int)

# ==========================================
# ★ 追加: 一時ロックの自己解除 (Pardon)
# ==========================================
@router.post("/pardon")
def self_pardon_penalty(request: Request):
    """
    無断キャンセル2回目の一時ロックを、ユーザーが自身で解除するためのAPI
    """
    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        consumer_id_int = int(consumer_id)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid session")

    service = StateService()
    service.pardon_penalty(consumer_id_int)
    
    return {"ok": True}