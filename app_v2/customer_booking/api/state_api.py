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
    Consumer の現在の予約状態を返す（長期安定版）

    仕様:
      - session["consumer_id"] を唯一の入力とする
      - 未ログイン時も 200 OK で is_logged_in=false を返す
      - 予約の生成・更新は一切行わない
      - active/pending の判定は "既存の正" に委譲する
    """
    consumer_id = request.session.get("consumer_id")

    try:
        consumer_id_int = int(consumer_id) if consumer_id is not None else None
    except Exception:
        consumer_id_int = None

    service = StateService()
    return service.get_state(consumer_id=consumer_id_int)
