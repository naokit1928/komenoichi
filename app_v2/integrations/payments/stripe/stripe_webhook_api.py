# app_v2/integrations/payments/stripe/stripe_webhook_api.py
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
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
async def stripe_webhook(
    request: Request, 
    background_tasks: BackgroundTasks  # ★ 追加: バックグラウンドタスクを受け取る
) -> PlainTextResponse:
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")

    try:
        # 1. 署名の検証とイベントの構築（ここは同期/即時でやるべき）
        event = construct_event(payload=payload, sig_header=sig_header)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 2. 実際の処理（DB更新とメール送信）をバックグラウンドに投げる
    background_tasks.add_task(_service.handle_event, event)

    # 3. Stripeには即座に 200 OK を返す（タイムアウト防止）
    return PlainTextResponse("ok", status_code=200)