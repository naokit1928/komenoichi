from __future__ import annotations

import os
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse

from app_v2.auth_consumer.magic.schemas import (
    MagicLinkSendRequest,
    MagicLinkSendResponse,
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
# POST /auth/consumer/magic/send
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

    やること（確定）:
    1. confirm_context から ReservationFormDTO を組み立てる
    2. ConfirmService で pending reservation を作成（reservation_id 発行）
    3. reservation_id を Magic Link token に保存して送信

    ※ consumer session はここでは作らない（入口は consume のみ）
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
# GET /auth/consumer/magic/consume
# ============================================================

@router.get("/consume")
def consume_magic_link(request: Request, token: str):
    """
    【consumer session の正式入口（唯一）】

    ここでやること（確定）:
    - token 検証（未使用・期限内）
    - token から reservation_id / email を取得
    - email を軸に consumer を取得 or 新規作成（EMAIL = 人格）
    - reservation.consumer_id を更新
    - consumer session を確立（cookie 発行）
    - Stripe Checkout へ 302
    """

    # 1) token 消費
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
            try:
                reservation_id = int(raw_rid)
            except Exception:
                reservation_id = None

        raw_email = result.get("email")
        if isinstance(raw_email, str) and raw_email:
            email = raw_email

    if reservation_id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="consume_magic_link did not return reservation_id",
        )

    if not email:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="email is missing in magic link token",
        )

    # 2) email → consumer 解決（EMAIL = 人格）
    consumer_repo = ConsumerRepository()
    consumer_id_int = consumer_repo.get_or_create_consumer_id_by_email(
        email=email
    )

    # ★ 既存 consumer の email が NULL の場合のみ補完セット
    try:
        consumer = consumer_repo.get_by_id(consumer_id_int)
        if consumer and not consumer.email:
            consumer_repo.update_email_if_empty(
                consumer_id=consumer_id_int,
                email=email,
            )
    except Exception:
        # identity 補完に失敗してもログイン自体は止めない
        pass

    # 2-1) magic_link_tokens に consumer_id を保存
    try:
        _service.attach_consumer_id(
            token=token,
            consumer_id=consumer_id_int,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"failed to attach consumer_id to magic_link_token: {e}",
        )

    # 2-2) reservation.consumer_id を更新
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
            detail=f"failed to update reservation.consumer_id: {e}",
        )


    # 3) consumer session を確立
    request.session["consumer_id"] = consumer_id_int

    if os.getenv("ENV", "development") in ("development", "dev", "local"):
        request.session["consumer_email"] = email
        request.session["consumer_authenticated_via"] = "magic_link"

    # 4) Stripe Checkout へ 302
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

    checkout_url = session.get("checkout_url")
    if not isinstance(checkout_url, str) or not checkout_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe checkout_url is missing",
        )

    return RedirectResponse(
        url=checkout_url,
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
        detail=(
            "stripe-entry is removed. "
            "Use POST /stripe/checkout/{reservation_id} (or magic consume flow)."
        ),
    )
