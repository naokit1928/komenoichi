from __future__ import annotations

import os
from typing import Optional
from urllib.parse import urlparse, parse_qs

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse

from app_v2.auth_consumer.magic.schemas import (
    MagicLinkLoginSendRequest,
    MagicLinkLoginSendResponse,
)
from app_v2.auth_consumer.magic.service import MagicLinkService

from app_v2.integrations.payments.stripe.reservation_payment_repo import (
    ReservationPaymentRepository,
)
from app_v2.customer_booking.repository.consumer_repo import ConsumerRepository

# ★ 追加: 農家としての登録があるか確認するためにインポート
from app_v2.auth import farm_magic_repo

router = APIRouter(prefix="/auth/consumer/magic", tags=["auth-consumer-magic"])
_service = MagicLinkService()

def _extract_token_from_url(magic_link_url: str) -> str:
    parsed = urlparse(magic_link_url)
    qs = parse_qs(parsed.query)
    token_list = qs.get("token")
    if not token_list:
        raise HTTPException(status_code=500, detail="Token parameter missing in generated URL")
    return token_list[0]

# ============================================================
# Magic Link 送信（ログイン・新規登録共通）
# ============================================================
@router.post("/send-login", response_model=MagicLinkLoginSendResponse)
def send_magic_link_login(
    request: Request,
    payload: MagicLinkLoginSendRequest,
):
    email = payload.email.strip().lower()
    redirect = payload.redirect

    consumer_repo = ConsumerRepository()
    consumer_id = consumer_repo.get_or_create_consumer_id_by_email(email=email)

    magic_link_url = _service.send_login_magic_link(
        email=email,
        consumer_id=consumer_id,
        redirect_path=redirect,
    )

    return MagicLinkLoginSendResponse(ok=True, debug_magic_link_url=magic_link_url)

# ============================================================
# Magic Link 消費（ログイン完了処理）
# ============================================================
@router.get("/consume-login")
def consume_login_only(request: Request, token: str, redirect: Optional[str] = None):
    try:
        result = _service.consume_magic_link(token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    consumer_id = result.get("consumer_id")
    email = result.get("email")

    if not consumer_id:
        raise HTTPException(status_code=400, detail="consumer_id missing in token")

    # セッションに consumer と magic_token を保存
    request.session["consumer_id"] = int(consumer_id)
    request.session["magic_token"] = token

    # ★ 追加（逆デュアルセッション）: 
    # 購入者ログインであっても、農家アカウントを持っていれば farm_id をセットする
    if email:
        try:
            farm_row = farm_magic_repo.get_farm_by_email(email)
            if farm_row:
                request.session["farm_id"] = farm_row["farm_id"]
        except Exception:
            pass # 万が一DBエラーが起きても、購入者としてのログインは止めないための安全策

    frontend_origin = os.getenv("FRONTEND_BASE_URL")
    if not frontend_origin:
        raise HTTPException(status_code=500, detail="FRONTEND_BASE_URL is not set")

    if redirect and redirect.startswith("/"):
        return RedirectResponse(url=f"{frontend_origin}{redirect}", status_code=302)

    return RedirectResponse(url=f"{frontend_origin}/farms", status_code=302)