# app_v2/integrations/payments/stripe/stripe_webhook_api.py
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import PlainTextResponse

from app_v2.integrations.payments.stripe.stripe_webhook_service import (
    StripeWebhookService,
)
from app_v2.integrations.payments.stripe.stripe_webhook_client import (
    construct_event,
)

router = APIRouter(prefix="/stripe", tags=["stripe_webhook_v2"])

_service = StripeWebhookService()


@router.post("/webhook", response_class=PlainTextResponse)
async def stripe_webhook(request: Request) -> PlainTextResponse:
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")

    try:
        event = construct_event(payload=payload, sig_header=sig_header)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    _service.handle_event(event)
    return PlainTextResponse("ok", status_code=200)
