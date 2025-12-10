# app_v2/integrations/payments/stripe_checkout_api.py
import os
import sqlite3
from datetime import datetime, UTC
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException

from dotenv import load_dotenv
import stripe

# .env の読み込み
load_dotenv()

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
if not STRIPE_SECRET_KEY:
    raise RuntimeError("STRIPE_SECRET_KEY is not set in environment")
stripe.api_key = STRIPE_SECRET_KEY

# フロントURL（ローカル/本番で切替）
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")

# ここを書き換えるだけで名目を変更可能
TERM_SERVICE_NAME = "運営サポート費（予約確定・当日運営の固定費）"

DB_PATH = "app.db"

# ★ tags を stripe_checkout_v2 に変更（既存どおり）
router = APIRouter(
    prefix="/stripe",
    tags=["stripe_checkout_v2"],
)


# ============================================================
# DB ヘルパ
# ============================================================

def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _get_reservation_by_id(reservation_id: int) -> Optional[Dict[str, Any]]:
    with _get_conn() as conn:
        cur = conn.execute(
            "SELECT * FROM reservations WHERE id = ?",
            (reservation_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def _update_reservation_checkout_created(
    reservation_id: int,
    payment_intent_id: Optional[str],
) -> Dict[str, Any]:
    """
    payment_intent_id と payment_status を更新し、更新後のレコードを返す。
    """
    with _get_conn() as conn:
        conn.execute(
            """
            UPDATE reservations
               SET payment_intent_id = ?,
                   payment_status = 'checkout_created'
             WHERE id = ?
            """,
            (payment_intent_id, reservation_id),
        )
        conn.commit()

        cur = conn.execute(
            "SELECT * FROM reservations WHERE id = ?",
            (reservation_id,),
        )
        row = cur.fetchone()
        if not row:
            raise RuntimeError("Reservation disappeared after update")
        return dict(row)


# ============================================================
# Checkout セッション作成
# ============================================================


@router.post("/checkout/{reservation_id}")
def create_checkout_session(reservation_id: int):
    """
    指定された Reservation の300円をユーザーに決済してもらうための
    Stripe Checkout セッションURLを発行して返す。

    フロント側は受け取った checkout_url に window.location.href で遷移するだけでOK。
    決済完了後は stripe_webhook_api.py が呼ばれて Reservation が自動更新される。
    """

    # 1. 予約を取得
    reservation = _get_reservation_by_id(reservation_id)
    if reservation is None:
        raise HTTPException(status_code=404, detail="Reservation not found")

    # すでに支払い済みなら新しいCheckoutは出さない
    paid_service_fee = reservation.get("paid_service_fee")
    if bool(paid_service_fee):
        raise HTTPException(
            status_code=400,
            detail="Service fee already paid for this reservation.",
        )

    # 固定300円
    service_fee_amount_jpy = 300

    # 2. Checkout Session を作成
    try:
        checkout_session = stripe.checkout.Session.create(
            mode="payment",
            # Link を出さない（カードのみ）
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "jpy",
                        "product_data": {
                            # ← 名目を明確化（ここだけで印象が変わる）
                            "name": TERM_SERVICE_NAME,
                            "metadata": {
                                "reservation_id": str(reservation["id"]),
                                "farm_id": str(reservation.get("farm_id") or ""),
                            },
                        },
                        "unit_amount": service_fee_amount_jpy,
                    },
                    "quantity": 1,
                }
            ],
            # 成功/キャンセルURL
            success_url=f"{FRONTEND_BASE_URL}/payment_success",
            cancel_url=f"{FRONTEND_BASE_URL}/farms/{reservation.get('farm_id')}/confirm",
            # ★★ 重要：PaymentIntent にも reservation_id を埋め込み（A案の要点）★★
            payment_intent_data={
                "metadata": {
                    "reservation_id": str(reservation["id"]),
                    "user_id": str(reservation.get("user_id") or ""),
                }
            },
            # Checkout Session 側の metadata（保険）
            metadata={
                "reservation_id": str(reservation["id"]),
                "user_id": str(reservation.get("user_id") or ""),
            },
            # 画面下部の安心テキスト（疑念・迷いを潰す）
            custom_text={
                "submit": {
                    "message": "この決済はStripeで安全に処理されます。カード情報は当サイトに保存されません。"
                }
            },
            # （必要なら）日本語UIを強制したい場合はコメント解除
            # locale="ja",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Stripe Checkout session create failed: {e}",
        )

    # 3. Reservation を更新（PIを保存しておくと突き合わせの保険にもなる）
    pi_id = checkout_session.get("payment_intent")
    if isinstance(pi_id, str):
        updated = _update_reservation_checkout_created(reservation_id, pi_id)
    else:
        updated = _update_reservation_checkout_created(reservation_id, None)

    return {
        "reservation_id": updated["id"],
        "checkout_url": checkout_session.url,
        "payment_intent_id": updated.get("payment_intent_id"),
        "status": updated.get("payment_status"),
        "note": "Redirect the buyer to checkout_url to complete payment.",
        "timestamp": datetime.now(UTC).isoformat(),
    }
