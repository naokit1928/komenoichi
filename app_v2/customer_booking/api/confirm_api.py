from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app_v2.customer_booking.dtos import (
    ReservationFormDTO,
    ReservationResultDTO,
)

from app_v2.customer_booking.services.confirm_service import (
    ConfirmService,
)

# ★ 追加：注文量バリデーション（三重防御の最後）
from app_v2.domain.order_quantity import (
    OrderItem,
    validate_order_quantity,
)

# ------------------------------------------------------------
# Router
# ------------------------------------------------------------

router = APIRouter(
    prefix="/api",
    tags=["confirm"],
)

# ------------------------------------------------------------
# POST /api/confirm
# ------------------------------------------------------------

@router.post(
    "/confirm",
    response_model=ReservationResultDTO,
)
def confirm_reservation(
    payload: ReservationFormDTO,
) -> ReservationResultDTO:
    """
    ConfirmPage 用 API（正式版）

    役割:
    - 入力バリデーション
    - 注文量ルールの検証（0kg / 最大kg）
    - ConfirmService に処理委譲
    - pending reservation を1件作成して返す

    注意:
    - Stripe 決済は行わない
    - LINE 連携も行わない
    """

    # --- 最低限の入力チェック（API責務） ---
    if not payload.items:
        raise HTTPException(
            status_code=400,
            detail="No items specified",
        )

    if not payload.pickup_slot_code or not payload.pickup_slot_code.strip():
        raise HTTPException(
            status_code=400,
            detail="pickup_slot_code is required",
        )

    # --- ★ 注文量バリデーション（ドメイン責務） ---
    try:
        order_items = [
            OrderItem(
                size_kg=item.size_kg,
                quantity=item.quantity,
            )
            for item in payload.items
        ]

        validate_order_quantity(order_items)

    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )

    # --- Service に完全委譲 ---
    service = ConfirmService()
    result = service.create_pending_reservation(payload)

    return result
