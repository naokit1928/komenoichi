from __future__ import annotations

import os
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse

from app_v2.auth_consumer.magic.schemas import (
    MagicLinkSendRequest,
    MagicLinkSendResponse,
    MagicLinkLoginSendRequest,   # ★ 追加
)
from app_v2.auth_consumer.magic.service import MagicLinkService

from app_v2.customer_booking.services.confirm_service import ConfirmService
from app_v2.customer_booking.dtos import ReservationFormDTO

from app_v2.integrations.payments.stripe.stripe_checkout_service import (
    StripeCheckoutService,
)
from app_v2.integrations.payments.stripe.reservation_payment_repo import (
    ReservationPaymentRepository,
)

from app_v2.customer_booking.repository.consumer_repo import (
    ConsumerRepository,
)

# ============================================================
# Router
# ============================================================

router = APIRouter(
    prefix="/auth/consumer/magic",
    tags=["auth-consumer-magic"],
)

_service = MagicLinkService()

# ============================================================
# POST /auth/consumer/magic/send  (Confirm 用)
# ============================================================

@router.post(
    "/send",
    response_model=MagicLinkSendResponse,
)
def send_magic_link(
    payload: MagicLinkSendRequest,
) -> MagicLinkSendResponse:
    """
    Consumer 用 Magic Link 認証開始 API（ConfirmService 連携版）
    """

    if not payload.agreed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agreement is required",
        )

    try:
        form = ReservationFormDTO(**payload.confirm_context)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid confirm_context: {e}",
        )

    try:
        confirm_service = ConfirmService()
        result = confirm_service.create_pending_reservation(form)
        reservation_id = int(result.reservation_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create reservation: {e}",
        )

    try:
        magic_link_url = _service.send_magic_link(
            email=payload.email,
            reservation_id=reservation_id,
            agreed=payload.agreed,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    return MagicLinkSendResponse(
        ok=True,
        debug_magic_link_url=magic_link_url,
    )


# ============================================================
# POST /auth/consumer/magic/send-login  (LoginOnly 用)
# ============================================================

@router.post("/send-login")
def send_login_magic_link(payload: MagicLinkLoginSendRequest):
    """
    LoginOnly 専用 Magic Link 発行。

    - 予約は作らない
    - 既存 consumer のみ許可
    """

    email = payload.email.strip()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="email is required",
        )

    consumer_repo = ConsumerRepository()

    consumer_id = consumer_repo.get_consumer_id_by_email(
    email=email
    )

    # ★ 存在しなくても成功扱い（LoginOnlyの原則）
    if consumer_id is None:
       return {"ok": True}

    magic_link_url = _service.send_login_magic_link(
        email=email,
        consumer_id=consumer_id,
    )
    
    return {
        "ok": True,
        "debug_magic_link_url": magic_link_url,
    }



# ============================================================
# GET /auth/consumer/magic/consume  (Confirm 専用・既存)
# ============================================================

@router.get("/consume")
def consume_magic_link(request: Request, token: str):
    """
    【consumer session の正式入口（Confirm 用）】
    """

    try:
        result: Any = _service.consume_magic_link(token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    reservation_id: Optional[int] = None
    email: Optional[str] = None

    if isinstance(result, dict):
        raw_rid = result.get("reservation_id")
        if raw_rid is not None:
            reservation_id = int(raw_rid)

        raw_email = result.get("email")
        if isinstance(raw_email, str) and raw_email:
            email = raw_email

    if reservation_id is None or not email:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="invalid magic link token",
        )

    consumer_repo = ConsumerRepository()
    consumer_id_int = consumer_repo.get_or_create_consumer_id_by_email(
        email=email
    )

    try:
        _service.attach_consumer_id(
            token=token,
            consumer_id=consumer_id_int,
        )
    except Exception:
        pass

    try:
        reservation_repo = ReservationPaymentRepository()
        conn = reservation_repo.open_connection()
        try:
            reservation_repo.attach_consumer(
                conn,
                reservation_id=reservation_id,
                consumer_id=consumer_id_int,
            )
        finally:
            conn.close()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    request.session["consumer_id"] = consumer_id_int

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
    )

    return RedirectResponse(
        url=session["checkout_url"],
        status_code=status.HTTP_302_FOUND,
    )


# ============================================================
# GET /auth/consumer/magic/consume-login  (LoginOnly 専用)
# ============================================================

@router.get("/consume-login")
def consume_login_only(request: Request, token: str):
    """
    LoginOnly 専用 consume。

    - token 検証
    - session 確立
    - reservation/booked に戻す
    """

    try:
        result = _service.consume_magic_link(token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    consumer_id = result.get("consumer_id")
    if not consumer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="consumer_id missing in token",
        )

    request.session["consumer_id"] = consumer_id

    frontend_origin = os.getenv("FRONTEND_BASE_URL")
    if not frontend_origin:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="FRONTEND_BASE_URL is not set",
        )

    return RedirectResponse(
        url=f"{frontend_origin}/reservation/booked",
        status_code=status.HTTP_302_FOUND,
    )


# ============================================================
# GET /auth/consumer/magic/test-entry
# ============================================================

@router.get("/test-entry")
def magic_test_entry():
    """
    【DEV ONLY】
    """

    env = os.getenv("ENV", "development")
    if env not in ("development", "dev", "local"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not Found",
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="stripe-entry is removed",
    )
