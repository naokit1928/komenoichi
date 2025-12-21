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
    frontend_base_url: str,
):
    """
    Stripe Checkout Session を作成する純粋な外部呼び出し関数
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
        success_url=f"{frontend_base_url}/payment_success",
        cancel_url=f"{frontend_base_url}/farms/{farm_id}/confirm",
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
