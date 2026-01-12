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
    ログイン中 consumer が「直近に予約した farm_id」を返す。

    責務:
    - consumer 履歴の read-only 参照
    - UI 表示補助用（Public Farms List）
      （LISTING ページでのハイライト・並び替え用）

    仕様:
    - Session に consumer_id がある場合のみ有効
    - 未ログイン時は farm_id=None を返す
    - ACTIVE / 受け取り日時は考慮しない
      （あくまで「前回予約した農家」）
    """

    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        # 未ログイン時はハイライトなし
        return LastConfirmedFarmResponse(
            farm_id=None,
        )

    repo = ConsumerHistoryRepository()
    farm_id = repo.get_last_confirmed_farm_id(
        consumer_id=int(consumer_id)
    )

    return LastConfirmedFarmResponse(
        farm_id=farm_id,
    )
