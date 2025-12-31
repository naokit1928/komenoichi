# app_v2/integrations/payments/stripe/stripe_checkout_api.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app_v2.integrations.payments.stripe.stripe_checkout_service import (
    StripeCheckoutService,
)

router = APIRouter(prefix="/stripe", tags=["stripe_checkout_v2"])


# ==============================
# Request Body
# ==============================
class CheckoutRequest(BaseModel):
    frontend_origin: str


@router.post("/checkout/{reservation_id}")
def create_checkout_session(
    reservation_id: int,
    body: CheckoutRequest,
):
    """
    Stripe Checkout セッション作成 API（V2）

    - reservation_id : path
    - frontend_origin : body
    - 業務ロジックは Service に完全委譲
    """
    service = StripeCheckoutService()
    try:
        return service.create_checkout_session(
            reservation_id=reservation_id,
            frontend_origin=body.frontend_origin,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Stripe Checkout session create failed: {e}",
        )
