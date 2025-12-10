# app_v2/integrations/payments/stripe_webhook_api.py
# ------------------------------------------------------------
# Stripe Webhook 受信 → DB更新 → V2 通知モジュール(LineNotificationService)
# ------------------------------------------------------------

from __future__ import annotations

import os
import json
import sqlite3
from datetime import datetime, UTC
from typing import Any, Dict, Optional

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import PlainTextResponse

import stripe

# --- V2 通知モジュール ---
from app_v2.notifications.services.line_notification_service import (
    LineNotificationService,
)

DB_PATH = "app.db"

router = APIRouter(prefix="/stripe", tags=["stripe_webhook_v2"])

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

if not STRIPE_SECRET_KEY:
    print("[WARN] STRIPE_SECRET_KEY が .env に設定されていません。")
if not STRIPE_WEBHOOK_SECRET:
    print("[WARN] STRIPE_WEBHOOK_SECRET が .env に設定されていません。")

stripe.api_key = STRIPE_SECRET_KEY

# ------------------------------------------------------------
# V2 通知サービス インスタンス
# ------------------------------------------------------------
try:
    _notification_service: Optional[LineNotificationService] = LineNotificationService()
    print("[StripeWebhook] LineNotificationService を初期化しました。")
except Exception as e:
    _notification_service = None
    print(f"[StripeWebhook] LineNotificationService 初期化に失敗しました: {e}")


# ------------------------------------------------------------
# DB ヘルパ
# ------------------------------------------------------------
def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _fetch_reservation_by_id(
    conn: sqlite3.Connection,
    rid: int,
) -> Optional[Dict[str, Any]]:
    cur = conn.execute("SELECT * FROM reservations WHERE id = ?", (rid,))
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
    rid: int,
    **fields: Any,
) -> None:
    if not fields:
        return
    cols = ", ".join(f"{k} = ?" for k in fields.keys())
    values = list(fields.values())
    values.append(rid)
    conn.execute(f"UPDATE reservations SET {cols} WHERE id = ?", values)
    conn.commit()


def _fetch_user_by_id(conn: sqlite3.Connection, user_id: int) -> Optional[Dict[str, Any]]:
    cur = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cur.fetchone()
    return dict(row) if row else None


# ------------------------------------------------------------
# Reservation 更新ロジック
# ------------------------------------------------------------
def _mark_reservation_paid(
    conn: sqlite3.Connection,
    reservation: Dict[str, Any],
    payment_intent_id: str,
) -> None:
    rid = int(reservation["id"])
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
        print(f"[DB] Reservation #{rid} を支払い成功に更新しました。")
    else:
        print(f"[DB] Reservation #{rid} は既に succeeded でした。")


def _ensure_confirmed_status(conn: sqlite3.Connection, reservation: Dict[str, Any]) -> None:
    rid = int(reservation["id"])
    current = (reservation.get("status") or "").lower()

    if current == "confirmed":
        print(f"[DB] Reservation #{rid} は既に confirmed。スキップ。")
        return

    if current in ("", "pending"):
        _update_reservation_fields(conn, rid, status="confirmed")
        print(f"[DB] Reservation #{rid} を confirmed に更新しました。")
    else:
        print(f"[DB] Reservation #{rid} は status='{current}' のため未変更。")


def _load_reservation_from_event(
    conn: sqlite3.Connection,
    event: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """
    Stripe イベントから Reservation を特定する。
    1) metadata.reservation_id
    2) payment_intent_id
    3) metadata.payment_intent_id
    の順で解決を試みる。
    """
    obj = event.get("data", {}).get("object", {})
    pi_id = obj.get("id") or obj.get("payment_intent")

    meta = obj.get("metadata") or {}
    rid = meta.get("reservation_id")

    # 1) metadata.reservation_id
    if rid is not None:
        try:
            rid_int = int(str(rid))
            r = _fetch_reservation_by_id(conn, rid_int)
            if r:
                return r
        except Exception:
            pass

    # 2) payment_intent_id
    if pi_id:
        r = _fetch_reservation_by_payment_intent(conn, str(pi_id))
        if r:
            return r

    # 3) metadata.payment_intent_id
    meta_pi = meta.get("payment_intent_id")
    if meta_pi:
        r = _fetch_reservation_by_payment_intent(conn, str(meta_pi))
        if r:
            return r

    print("[INFO] 対応する Reservation が見つかりませんでした。")
    return None


def _find_line_user_id(
    conn: sqlite3.Connection,
    reservation: Dict[str, Any],
) -> Optional[str]:
    """
    現時点では send-pending 側で line_user_id を使うので、
    Webhook では「通知ジョブの生成」だけに集中し、
    ここで line_user_id を直接使うことはない。

    ただし将来、Webhook 内で即時 push を再開したくなった場合のために
    ユーティリティとして残しておく。
    """
    user_id = reservation.get("user_id")
    if user_id is None:
        print("[WARN] reservation.user_id が設定されていません。")
        return None

    try:
        uid = int(user_id)
    except Exception:
        print(f"[WARN] invalid user_id on reservation: {user_id}")
        return None

    user = _fetch_user_by_id(conn, uid)
    if not user:
        print(f"[WARN] User #{uid} が見つかりません。")
        return None

    line_id = user.get("line_user_id")
    if not line_id:
        print(f"[WARN] User #{uid} に line_user_id が設定されていません。")
        return None

    return str(line_id)


# ------------------------------------------------------------
# Webhook 本体
# ------------------------------------------------------------
@router.post("/webhook", response_class=PlainTextResponse, summary="Stripe Webhook")
async def stripe_webhook(request: Request) -> PlainTextResponse:
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=STRIPE_WEBHOOK_SECRET,
        )
    except stripe.error.SignatureVerificationError as e:
        print(f"[Stripe] Signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        print(f"[Stripe] Error parsing webhook: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")

    event_type = event.get("type")
    print(f"[Stripe] Received event: {event_type}")

    conn = _get_conn()
    try:
        # ----------------------------------------------------
        # 1) payment_intent.succeeded
        # ----------------------------------------------------
        if event_type == "payment_intent.succeeded":
            reservation = _load_reservation_from_event(conn, event)
            if not reservation:
                return PlainTextResponse("ok (reservation not found)", status_code=200)

            pi = event["data"]["object"]
            pi_id = pi.get("id") or pi.get("payment_intent") or ""
            pi_id_str = str(pi_id) if pi_id else ""

            _mark_reservation_paid(conn, reservation, payment_intent_id=pi_id_str)

            # 最新状態を再取得して confirmed 化
            reservation = _fetch_reservation_by_id(conn, int(reservation["id"])) or reservation
            _ensure_confirmed_status(conn, reservation)

            # V2 通知モジュールでジョブ生成（CONFIRMATION + REMINDER）＋ 即時 flush
            if _notification_service is not None:
                try:
                    _notification_service.schedule_for_reservation(int(reservation["id"]))
                    # ここで「今送れるジョブ（主にCONFIRMATION）」だけ送信してしまう
                    _notification_service.send_pending_jobs(limit=50, dry_run=False)
                except Exception as e:
                    print(
                        f"[StripeWebhook] notification handling failed "
                        f"(reservation_id={reservation['id']}): {e}"
                    )

            return PlainTextResponse("ok", status_code=200)

        # ----------------------------------------------------
        # 2) checkout.session.completed
        #    → 既に payment_intent.succeeded で通知処理している前提。
        #       二重ジョブは LineNotificationService 側の冪等化で防いでいる。
        # ----------------------------------------------------
        elif event_type == "checkout.session.completed":
            session = event["data"]["object"]
            meta = session.get("metadata") or {}
            rid = meta.get("reservation_id")
            if not rid:
                return PlainTextResponse("ok (no reservation_id)", status_code=200)

            try:
                rid_int = int(str(rid))
            except Exception:
                return PlainTextResponse("ok (invalid reservation_id)", status_code=200)

            reservation = _fetch_reservation_by_id(conn, rid_int)
            if not reservation:
                return PlainTextResponse("ok (reservation not found)", status_code=200)

            pi_id = session.get("payment_intent")
            pi_id_str = str(pi_id) if isinstance(pi_id, str) else ""

            if not pi_id_str:
                try:
                    pi_obj = stripe.PaymentIntent.retrieve(session.get("payment_intent") or "")
                    if isinstance(pi_obj, dict):
                        pi_id_str = str(pi_obj.get("id") or "")
                except Exception as e:
                    print(f"[Stripe] retrieve PI failed: {e}")

            if pi_id_str:
                _mark_reservation_paid(conn, reservation, payment_intent_id=pi_id_str)

            reservation = _fetch_reservation_by_id(conn, rid_int) or reservation
            _ensure_confirmed_status(conn, reservation)

            # 念のためここでも schedule + flush を試みるが、
            # 既に存在するジョブは LineNotificationService 側でスキップされる想定。
            if _notification_service is not None:
                try:
                    _notification_service.schedule_for_reservation(int(reservation["id"]))
                    _notification_service.send_pending_jobs(limit=50, dry_run=False)
                except Exception as e:
                    print(
                        f"[StripeWebhook] notification handling failed "
                        f"(reservation_id={reservation['id']}): {e}"
                    )

            return PlainTextResponse("ok", status_code=200)

        # ----------------------------------------------------
        # その他のイベントは特に処理しない
        # ----------------------------------------------------
        else:
            return PlainTextResponse("ignored", status_code=200)

    finally:
        conn.close()
