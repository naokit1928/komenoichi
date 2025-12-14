# app_v2/integrations/payments/stripe_checkout_api.py

import os
import sqlite3
from datetime import datetime, UTC
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from dotenv import load_dotenv
import stripe

# ------------------------------------------------------------
# Env
# ------------------------------------------------------------
load_dotenv()

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
if not STRIPE_SECRET_KEY:
    raise RuntimeError("STRIPE_SECRET_KEY is not set")
stripe.api_key = STRIPE_SECRET_KEY

FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
TERM_SERVICE_NAME = "運営サポート費（予約確定・当日運営の固定費）"
DB_PATH = "app.db"

router = APIRouter(prefix="/stripe", tags=["stripe_checkout_v2"])


# ------------------------------------------------------------
# DB helpers
# ------------------------------------------------------------
def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _get_reservation_by_id(reservation_id: int) -> Optional[Dict[str, Any]]:
    with _get_conn() as conn:
        cur = conn.execute(
            "SELECT * FROM reservations WHERE reservation_id = ?",
            (reservation_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def _update_reservation_checkout_created(
    reservation_id: int,
    payment_intent_id: Optional[str],
) -> Dict[str, Any]:
    with _get_conn() as conn:
        conn.execute(
            """
            UPDATE reservations
               SET payment_intent_id = ?,
                   payment_status = 'checkout_created'
             WHERE reservation_id = ?
            """,
            (payment_intent_id, reservation_id),
        )
        conn.commit()

        cur = conn.execute(
            "SELECT * FROM reservations WHERE reservation_id = ?",
            (reservation_id,),
        )
        row = cur.fetchone()
        if not row:
            raise RuntimeError("Reservation disappeared after update")
        return dict(row)


# ------------------------------------------------------------
# Checkout
# ------------------------------------------------------------
@router.post("/checkout/{reservation_id}")
def create_checkout_session(reservation_id: int):
    reservation = _get_reservation_by_id(reservation_id)
    if reservation is None:
        raise HTTPException(status_code=404, detail="Reservation not found")

    if bool(reservation.get("paid_service_fee")):
        raise HTTPException(
            status_code=400,
            detail="Service fee already paid for this reservation.",
        )

    service_fee_amount_jpy = 300

    try:
        checkout_session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "jpy",
                        "product_data": {
                            "name": TERM_SERVICE_NAME,
                            "metadata": {
                                "reservation_id": str(reservation["reservation_id"]),
                                "farm_id": str(reservation.get("farm_id") or ""),
                            },
                        },
                        "unit_amount": service_fee_amount_jpy,
                    },
                    "quantity": 1,
                }
            ],
            success_url=f"{FRONTEND_BASE_URL}/payment_success",
            cancel_url=f"{FRONTEND_BASE_URL}/farms/{reservation.get('farm_id')}/confirm",
            payment_intent_data={
                "metadata": {
                    "reservation_id": str(reservation["reservation_id"]),
                }
            },
            metadata={
                "reservation_id": str(reservation["reservation_id"]),
            },
            custom_text={
                "submit": {
                    "message": "この決済はStripeで安全に処理されます。カード情報は当サイトに保存されません。"
                }
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Stripe Checkout session create failed: {e}",
        )

    pi_id = checkout_session.get("payment_intent")
    updated = _update_reservation_checkout_created(
        reservation_id,
        pi_id if isinstance(pi_id, str) else None,
    )

    return {
        "reservation_id": updated["reservation_id"],
        "checkout_url": checkout_session.url,
        "payment_intent_id": updated.get("payment_intent_id"),
        "status": updated.get("payment_status"),
        "timestamp": datetime.now(UTC).isoformat(),
    }
