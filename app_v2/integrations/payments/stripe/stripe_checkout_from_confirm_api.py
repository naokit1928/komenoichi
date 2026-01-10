from __future__ import annotations

import os
import sqlite3

from fastapi import APIRouter, HTTPException, Request, status

from app_v2.db.core import resolve_db_path
from app_v2.customer_booking.dtos import ReservationFormDTO
from app_v2.customer_booking.services.confirm_service import ConfirmService
from app_v2.integrations.payments.stripe.reservation_payment_repo import (
    ReservationPaymentRepository,
)

from app_v2.integrations.payments.stripe.stripe_checkout_service import (
    StripeCheckoutService,
)

router = APIRouter(
    prefix="/stripe/checkout",
    tags=["stripe-checkout"],
)


from fastapi import Body

@router.post("/from-confirm")
def checkout_from_confirm(
    payload: dict = Body(...),
    request: Request = None,
):


    """
    【ログイン済み consumer 専用】
    Confirm から直接 Stripe Checkout へ進むための入口。

    前提:
    - consumer_id は session に入っている
    - confirm_context は ConfirmPage 由来（magic link と同型）
    """

    # --------------------------------------------------
    # 0) consumer session 確認
    # --------------------------------------------------
    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="consumer session is required",
        )

    try:
        consumer_id_int = int(consumer_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid consumer session",
        )

    # --------------------------------------------------
    # 1) payload 検証
    # --------------------------------------------------
    confirm_context = payload.get("confirm_context")
    agreed = bool(payload.get("agreed", False))

    if not agreed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agreement is required",
        )

    if not isinstance(confirm_context, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="confirm_context is required",
        )

    # --------------------------------------------------
    # 2) consumer email を DB から取得（人格ID）
    # --------------------------------------------------
    db_path = resolve_db_path()
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT email
            FROM consumers
            WHERE consumer_id = ?
            LIMIT 1
            """,
            (consumer_id_int,),
        )
        row = cur.fetchone()
        consumer_email = row[0] if row else None
    finally:
        conn.close()

    if not consumer_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="consumer email is missing",
        )

    # --------------------------------------------------
    # 3) confirm_context → ReservationFormDTO 変換
    #    ★ DTO 定義と完全一致させる
    # --------------------------------------------------


    try:
        form = ReservationFormDTO(
            farm_id=confirm_context["farm_id"],
            pickup_slot_code=confirm_context["pickup_slot_code"],
            items=[
                {
                    "size_kg": item["size_kg"],
                    "quantity": item["quantity"],
                }
                for item in confirm_context.get("items", [])
            ],
            client_next_pickup_deadline_iso=confirm_context.get(
                "client_next_pickup_deadline_iso"
            ),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid confirm_context: {e}",
        )

    # --------------------------------------------------
    # 4) pending reservation 作成
    # --------------------------------------------------
    try:
        confirm_service = ConfirmService()
        result = confirm_service.create_pending_reservation(form)
        reservation_id = int(result.reservation_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create reservation: {e}",
        )

    # --------------------------------------------------
    # 5) reservation.consumer_id を更新
    # --------------------------------------------------
    try:
        reservation_repo = ReservationPaymentRepository()
        rconn = reservation_repo.open_connection()
        try:
            reservation_repo.attach_consumer(
                rconn,
                reservation_id=reservation_id,
                consumer_id=consumer_id_int,
            )
        finally:
            rconn.close()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"failed to update reservation.consumer_id: {e}",
        )


    # --------------------------------------------------
    # 6) Stripe Checkout
    # --------------------------------------------------
    frontend_origin = os.getenv("FRONTEND_BASE_URL")
    if not frontend_origin:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="FRONTEND_BASE_URL is not set",
        )

    stripe_service = StripeCheckoutService()
    session = stripe_service.create_checkout_session(
        reservation_id=reservation_id,
        frontend_origin=frontend_origin,
        consumer_email=str(consumer_email),
    )

    checkout_url = session.get("checkout_url")
    if not isinstance(checkout_url, str) or not checkout_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe checkout_url is missing",
        )

    return {
        "ok": True,
        "reservation_id": reservation_id,
        "checkout_url": checkout_url,
    }
