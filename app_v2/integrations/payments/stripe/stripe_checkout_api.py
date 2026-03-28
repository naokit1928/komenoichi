from __future__ import annotations

import os
import sqlite3
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, status, Body, Depends

from app_v2.db.core import get_db_conn
from app_v2.integrations.payments.stripe.stripe_checkout_service import (
    StripeCheckoutService,
)
from app_v2.customer_booking.repository.latest_reservation_repo import (
    LatestReservationRepository,
)
from app_v2.customer_booking.services.checkout_prep_service import CheckoutPrepService
from app_v2.customer_booking.services.state_service import StateService 

router = APIRouter(
    prefix="/stripe/checkout",
    tags=["stripe-checkout"],
)

@router.post("/from-confirm")
def checkout_from_confirm(
    payload: dict = Body(...),
    request: Request = None,
    conn: sqlite3.Connection = Depends(get_db_conn)
):
    """
    業務ゲートAPI（最終版・JIT PENDING 生成対応）
    """
    # 1. consumer session
    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="NOT_AUTHENTICATED")
    try:
        consumer_id_int = int(consumer_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="INVALID_SESSION")

    # 2. confirm_session_id (cs) & 同意チェック
    cs = payload.get("cs")
    if not cs:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CONFIRM_SESSION_REQUIRED")
        
    agreed = bool(payload.get("agreed", False))
    if not agreed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="AGREEMENT_REQUIRED")

    # ==================================================
    # 3. ペナルティチェック（物理ブロックガード）
    # ==================================================
    state_service = StateService()
    state_info = state_service.get_state(consumer_id=consumer_id_int)
    penalty = state_info.get("penalty")
    
    if penalty:
        if penalty["status"] == "banned":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="ACCOUNT_BANNED")
        elif penalty["status"] in ["locked_requestable", "locked_cooling"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="ACCOUNT_LOCKED")

    # 4. active reservation ガード
    latest_repo = LatestReservationRepository()
    if latest_repo.get_latest_confirmed_reservation_id(consumer_id=consumer_id_int) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="ACTIVE_RESERVATION_EXISTS")

    # 5. PENDING 予約の取得 または JIT生成
    prep_service = CheckoutPrepService()
    try:
        reservation_id, consumer_email = prep_service.prepare_pending_reservation(
            conn=conn, 
            consumer_id=consumer_id_int, 
            cs=cs
        )
    except ValueError as e:
        error_msg = str(e)
        status_code = 400
        if error_msg in ["SESSION_NOT_FOUND", "FARM_NOT_FOUND"]:
            status_code = 404
        elif error_msg in ["DRAFT_JSON_CORRUPTED", "CREATION_FAILED"]:
            status_code = 500
            
        raise HTTPException(status_code=status_code, detail=error_msg)

    # 6. Stripe Checkout (Final)
    frontend_origin = os.getenv("FRONTEND_BASE_URL")
    if not frontend_origin:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="FRONTEND_BASE_URL_NOT_SET")

    stripe_service = StripeCheckoutService()
    try:
        session = stripe_service.create_checkout_session(
            reservation_id=reservation_id,
            frontend_origin=frontend_origin,
            consumer_email=consumer_email,
            confirm_session_id=cs,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    checkout_url = session.get("checkout_url")
    if not checkout_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CHECKOUT_URL_MISSING")

    return {
        "ok": True,
        "reservation_id": reservation_id,
        "confirm_session_id": cs,
        "checkout_url": checkout_url,
        "reused": bool(session.get("reused", False)),
        "timestamp": datetime.utcnow().isoformat(),
    }