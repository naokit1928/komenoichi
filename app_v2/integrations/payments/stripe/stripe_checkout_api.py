# app_v2/integrations/payments/stripe/stripe_checkout_api.py

from fastapi import APIRouter, HTTPException

from app_v2.integrations.payments.stripe.stripe_checkout_service import (
    StripeCheckoutService,
)

router = APIRouter(prefix="/stripe", tags=["stripe_checkout_v2"])


@router.post("/checkout/{reservation_id}")
def create_checkout_session(reservation_id: int):
    """
    Stripe Checkout セッション作成 API

    - reservation_id を受け取る
    - 業務ロジックは Service に完全委譲
    """
    service = StripeCheckoutService()
    try:
        return service.create_checkout_session(reservation_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Stripe Checkout session create failed: {e}",
        )
