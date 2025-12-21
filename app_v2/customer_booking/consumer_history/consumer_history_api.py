from __future__ import annotations

from fastapi import APIRouter, Request

from app_v2.customer_booking.dtos import (
    LastConfirmedFarmResponse,
)
from app_v2.customer_booking.consumer_history.consumer_history_repo import (
    ConsumerHistoryRepository,
)

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
    """
    consumer（user）が最後に confirmed した farm_id を返す。

    責務:
    - consumer 履歴の read-only 参照
    - UI 表示補助用（Public Farms List）

    注意:
    - 現在は user_id 固定
    - LINE ログイン / セッション導入後に差し替える前提
    """

    # ★ 現在は user_id が固定
    consumer_id = 1  # ← 将来 LINE / Session から解決する

    repo = ConsumerHistoryRepository()
    farm_id = repo.get_last_confirmed_farm_id(consumer_id)

    return LastConfirmedFarmResponse(
        farm_id=farm_id,
    )
