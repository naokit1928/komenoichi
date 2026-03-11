import os
from typing import Optional, Dict, Any

from dotenv import load_dotenv
import stripe

# ------------------------------------------------------------
# Env / Stripe setup
# ------------------------------------------------------------
load_dotenv()

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
if not STRIPE_SECRET_KEY:
    raise RuntimeError("STRIPE_SECRET_KEY is not set")

stripe.api_key = STRIPE_SECRET_KEY


def create_checkout_session(
    *,
    reservation_id: int,
    farm_id: int | None,
    service_fee_amount_jpy: int,
    term_service_name: str,
    success_url: str,
    cancel_url: str,
    consumer_email: str | None = None,
    confirm_session_id: Optional[str] = None,  # ★ 追加（cs）
    idempotency_key: Optional[str] = None,     # ★ 追加（cs冪等）
):
    """
    Stripe Checkout Session を作成する純粋な外部呼び出し関数

    方針：
      - reservation_id は従来通り metadata に入れる
      - confirm_session_id があれば Stripe metadata にも必ず入れる
      - Webhook は confirm_session_id を正とする
      - idempotency_key が指定された場合は Stripe 側で冪等化する
    """

    # -------------------------
    # Session metadata
    # -------------------------
    session_meta: Dict[str, Any] = {
        "reservation_id": str(reservation_id),
    }

    if consumer_email:
        session_meta["consumer_email"] = consumer_email

    # ★ ConfirmSession を Stripe 側の唯一キーとして入れる
    if confirm_session_id:
        session_meta["confirm_session_id"] = confirm_session_id

    # -------------------------
    # PaymentIntent metadata
    # -------------------------
    pi_meta: Dict[str, Any] = {
        "reservation_id": str(reservation_id),
    }

    if consumer_email:
        pi_meta["consumer_email"] = consumer_email

    if confirm_session_id:
        pi_meta["confirm_session_id"] = confirm_session_id

    return stripe.checkout.Session.create(
        mode="payment",
        payment_method_types=["card"],
        line_items=[
            {
                "price_data": {
                    "currency": "jpy",
                    "product_data": {
                        "name": term_service_name,
                        "metadata": {
                            "reservation_id": str(reservation_id),
                            "farm_id": str(farm_id or ""),
                            **(
                                {"confirm_session_id": confirm_session_id}
                                if confirm_session_id
                                else {}
                            ),
                        },
                    },
                    "unit_amount": service_fee_amount_jpy,
                },
                "quantity": 1,
            }
        ],
        success_url=success_url,
        cancel_url=cancel_url,
        payment_intent_data={
            "metadata": pi_meta,
        },
        metadata=session_meta,
        custom_text={
            "submit": {
                "message": "この決済はStripeで安全に処理されます。カード情報は当サイトに保存されません。"
            }
        },
        # Stripe-python は idempotency_key を kwargs で受け付ける
        idempotency_key=idempotency_key,
    )


def find_checkout_session_by_payment_intent(
    *, payment_intent_id: str
) -> Optional["stripe.checkout.Session"]:
    """
    既に決済開始済（payment_intent_id がある）場合に、
    その PaymentIntent に紐づく Checkout Session を探す。

    目的：
      - 「Stripe開始済のPENDINGは再生成禁止」を守るため、
        新規 Session 作成ではなく既存 Session を再利用する。

    注意：
      - Stripe API の都合上、複数返る可能性はあるが、
        通常は先頭で十分（limit=1）。
    """
    try:
        sessions = stripe.checkout.Session.list(payment_intent=payment_intent_id, limit=1)
        if sessions and getattr(sessions, "data", None):
            return sessions.data[0]
        return None
    except Exception:
        # ネットワーク/Stripe側障害など。呼び出し側で扱う。
        return None
