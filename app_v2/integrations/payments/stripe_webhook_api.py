# app_v2/integrations/payments/stripe_webhook_api.py
from __future__ import annotations

import os
import sqlite3
from datetime import datetime, UTC
from typing import Any, Dict, Optional

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import PlainTextResponse
import stripe

from app_v2.notifications.services.line_notification_service import (
    LineNotificationService,
)

DB_PATH = "app.db"

router = APIRouter(prefix="/stripe", tags=["stripe_webhook_v2"])

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

stripe.api_key = STRIPE_SECRET_KEY


# ------------------------------------------------------------
# Notification service
# ------------------------------------------------------------
try:
    _notification_service: Optional[LineNotificationService] = LineNotificationService()
    print("[StripeWebhook] LineNotificationService を初期化しました。")
except Exception as e:
    _notification_service = None
    print(f"[StripeWebhook] LineNotificationService 初期化失敗: {e}")


# ------------------------------------------------------------
# DB helpers
# ------------------------------------------------------------
def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _fetch_reservation_by_id(
    conn: sqlite3.Connection,
    reservation_id: int,
) -> Optional[Dict[str, Any]]:
    cur = conn.execute(
        "SELECT * FROM reservations WHERE reservation_id = ?",
        (reservation_id,),
    )
    row = cur.fetchone()
    return dict(row) if row else None


def _fetch_reservation_by_payment_intent(
    conn: sqlite3.Connection,
    payment_intent_id: str,
) -> Optional[Dict[str, Any]]:
    cur = conn.execute(
        "SELECT * FROM reservations WHERE payment_intent_id = ?",
        (payment_intent_id,),
    )
    row = cur.fetchone()
    return dict(row) if row else None


def _update_reservation_fields(
    conn: sqlite3.Connection,
    reservation_id: int,
    **fields: Any,
) -> None:
    if not fields:
        return
    cols = ", ".join(f"{k} = ?" for k in fields.keys())
    values = list(fields.values())
    values.append(reservation_id)
    conn.execute(
        f"UPDATE reservations SET {cols} WHERE reservation_id = ?",
        values,
    )
    conn.commit()


# ------------------------------------------------------------
# Reservation update logic
# ------------------------------------------------------------
def _mark_reservation_paid(
    conn: sqlite3.Connection,
    reservation: Dict[str, Any],
    payment_intent_id: str,
) -> None:
    rid = int(reservation["reservation_id"])
    fields: Dict[str, Any] = {}

    if reservation.get("payment_intent_id") != payment_intent_id:
        fields["payment_intent_id"] = payment_intent_id

    if (reservation.get("payment_status") or "").lower() != "succeeded":
        fields["payment_status"] = "succeeded"

    if not reservation.get("paid_service_fee"):
        fields["paid_service_fee"] = 1

    if not reservation.get("payment_succeeded_at"):
        fields["payment_succeeded_at"] = datetime.now(UTC).isoformat()

    if fields:
        _update_reservation_fields(conn, rid, **fields)


def _ensure_confirmed_status(
    conn: sqlite3.Connection,
    reservation: Dict[str, Any],
) -> None:
    rid = int(reservation["reservation_id"])
    current = (reservation.get("status") or "").lower()

    if current == "confirmed":
        return

    if current in ("", "pending"):
        _update_reservation_fields(conn, rid, status="confirmed")


def _load_reservation_from_event(
    conn: sqlite3.Connection,
    event: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    obj = event.get("data", {}).get("object", {})
    pi_id = obj.get("id") or obj.get("payment_intent")

    meta = obj.get("metadata") or {}
    rid = meta.get("reservation_id")

    if rid is not None:
        try:
            r = _fetch_reservation_by_id(conn, int(rid))
            if r:
                return r
        except Exception:
            pass

    if pi_id:
        r = _fetch_reservation_by_payment_intent(conn, str(pi_id))
        if r:
            return r

    meta_pi = meta.get("payment_intent_id")
    if meta_pi:
        r = _fetch_reservation_by_payment_intent(conn, str(meta_pi))
        if r:
            return r

    return None


# ------------------------------------------------------------
# Webhook
# ------------------------------------------------------------
@router.post("/webhook", response_class=PlainTextResponse)
async def stripe_webhook(request: Request) -> PlainTextResponse:
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=STRIPE_WEBHOOK_SECRET,
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid payload")

    event_type = event.get("type")
    conn = _get_conn()

    try:
        if event_type == "payment_intent.succeeded":
            reservation = _load_reservation_from_event(conn, event)
            if not reservation:
                return PlainTextResponse("ok", status_code=200)

            pi = event["data"]["object"]
            pi_id = str(pi.get("id") or "")

            _mark_reservation_paid(conn, reservation, pi_id)

            reservation = (
                _fetch_reservation_by_id(conn, int(reservation["reservation_id"]))
                or reservation
            )
            _ensure_confirmed_status(conn, reservation)

            if _notification_service:
                _notification_service.schedule_for_reservation(
                    int(reservation["reservation_id"])
                )
                _notification_service.send_pending_jobs(limit=50, dry_run=False)

            return PlainTextResponse("ok", status_code=200)

        elif event_type == "checkout.session.completed":
            session = event["data"]["object"]
            meta = session.get("metadata") or {}
            rid = meta.get("reservation_id")
            if not rid:
                return PlainTextResponse("ok", status_code=200)

            reservation = _fetch_reservation_by_id(conn, int(rid))
            if not reservation:
                return PlainTextResponse("ok", status_code=200)

            # ===== consumer 紐づけ（新テーブル対応）=====
            line_consumer_id = meta.get("line_consumer_id")
            if not line_consumer_id:
                 # metadata が無い checkout.session.completed は普通に来る
                 # Webhook では失敗扱いにしない
                 return PlainTextResponse("ok", status_code=200)

            cur = conn.cursor()
            cur.execute(
                """
                SELECT consumer_id
                FROM consumers
                WHERE line_consumer_id = ?
                LIMIT 1
                """,
                (line_consumer_id,),
            )
            row = cur.fetchone()
            if not row:
                # consumer 未作成でも Webhook は成功扱い
                return PlainTextResponse("ok", status_code=200)
            consumer_id = int(row["consumer_id"])

            conn.execute(
                """
                UPDATE reservations
                SET consumer_id = ?
                WHERE reservation_id = ?
                """,
                (consumer_id, int(rid)),
            )
            conn.commit()
            # ===== consumer 紐づけ end =====

            pi_id = session.get("payment_intent")
            if isinstance(pi_id, str):
                _mark_reservation_paid(conn, reservation, pi_id)

            reservation = (
                _fetch_reservation_by_id(conn, int(rid)) or reservation
            )
            _ensure_confirmed_status(conn, reservation)

            if _notification_service:
                _notification_service.schedule_for_reservation(
                    int(reservation["reservation_id"])
                )
                _notification_service.send_pending_jobs(limit=50, dry_run=False)

            return PlainTextResponse("ok", status_code=200)

        else:
            return PlainTextResponse("ignored", status_code=200)

    finally:
        conn.close()
