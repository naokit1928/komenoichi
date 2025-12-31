# app_v2/integrations/payments/stripe/stripe_client.py

import os
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
):
    """
    Stripe Checkout Session を作成する純粋な外部呼び出し関数

    - URL の正当性・構築は Service の責務
    - この関数は受け取った値を Stripe に渡すだけ
    """
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
            "metadata": {
                "reservation_id": str(reservation_id),
            }
        },
        metadata={
            "reservation_id": str(reservation_id),
        },
        custom_text={
            "submit": {
                "message": "この決済はStripeで安全に処理されます。カード情報は当サイトに保存されません。"
            }
        },
    )
