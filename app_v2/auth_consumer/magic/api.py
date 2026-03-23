from __future__ import annotations

import os
from typing import Optional
from urllib.parse import urlparse, parse_qs

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse, HTMLResponse

from app_v2.auth_consumer.magic.schemas import (
    MagicLinkLoginSendRequest,
    MagicLinkLoginSendResponse,
)
from app_v2.auth_consumer.magic.service import MagicLinkService
from app_v2.integrations.payments.stripe.reservation_payment_repo import ReservationPaymentRepository
from app_v2.customer_booking.repository.consumer_repo import ConsumerRepository
from app_v2.auth import farm_magic_repo

router = APIRouter(prefix="/auth/consumer/magic", tags=["auth-consumer-magic"])
_service = MagicLinkService()

# ★ 追加: 美しいエラー画面を返すヘルパー関数
def _get_error_html(title: str, message: str, link_text: str, link_url: str) -> HTMLResponse:
    html = f"""
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title} | Komenoichi</title>
        <style>
            body {{ font-family: 'Noto Sans JP', sans-serif; background-color: #f8fafc; color: #0f172a; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }}
            .card {{ background: #ffffff; padding: 40px 24px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); max-width: 400px; width: 100%; text-align: center; border: 1px solid #e2e8f0; }}
            .icon {{ font-size: 40px; margin-bottom: 16px; }}
            h1 {{ font-size: 18px; margin-top: 0; color: #0f172a; margin-bottom: 16px; }}
            p {{ font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 32px; word-break: break-word; }}
            a {{ display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 24px; border-radius: 999px; font-size: 14px; font-weight: bold; width: 100%; box-sizing: border-box; transition: opacity 0.2s; }}
            a:hover {{ opacity: 0.8; }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon">⚠️</div>
            <h1>{title}</h1>
            <p>{message}</p>
            <a href="{link_url}">{link_text}</a>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html, status_code=400)


def _extract_token_from_url(magic_link_url: str) -> str:
    parsed = urlparse(magic_link_url)
    qs = parse_qs(parsed.query)
    token_list = qs.get("token")
    if not token_list:
        raise HTTPException(status_code=500, detail="Token parameter missing in generated URL")
    return token_list[0]

@router.post("/send-login", response_model=MagicLinkLoginSendResponse)
def send_magic_link_login(request: Request, payload: MagicLinkLoginSendRequest):
    email = payload.email.strip().lower()
    redirect = payload.redirect

    consumer_repo = ConsumerRepository()
    consumer_id = consumer_repo.get_or_create_consumer_id_by_email(email=email)

    magic_link_url = _service.send_login_magic_link(
        email=email,
        consumer_id=consumer_id,
        redirect_path=redirect,
    )

    debug_url = magic_link_url if os.getenv("ENV") == "development" else None
    return MagicLinkLoginSendResponse(ok=True, debug_magic_link_url=debug_url)

@router.get("/consume-login")
def consume_login_only(request: Request, token: str, redirect: Optional[str] = None):
    frontend_origin = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173").rstrip("/")
    try:
        result = _service.consume_magic_link(token)
    except Exception as e:
        # ★ 変更: 生のJSONエラーではなく、美しいHTML画面を返す
        error_msg = str(e)
        title = "ログインリンクが無効です"
        if "expired" in error_msg.lower():
            message = "このリンクは有効期限（15分）が切れています。<br>お手数ですが、もう一度ログイン操作をやり直してください。"
        elif "used" in error_msg.lower():
            message = "このリンクは既に使用されています。<br>セキュリティのため、リンクは1回のみ有効です。<br>もう一度ログイン操作をやり直してください。"
        else:
            message = "無効なリンクです。<br>URLが正しくコピーされているか確認するか、もう一度ログイン操作をやり直してください。"
        
        return _get_error_html(title, message, "トップページへ戻る", f"{frontend_origin}/farms")

    consumer_id = result.get("consumer_id")
    email = result.get("email")

    if not consumer_id:
        # ここはシステムエラーなのでフロントへは飛ばさずそのままエラーで落とす
        raise HTTPException(status_code=400, detail="consumer_id missing in token")

    request.session.clear()
    request.session["consumer_id"] = int(consumer_id)
    request.session["magic_token"] = token

    if email:
        try:
            farm_row = farm_magic_repo.get_farm_by_email(email)
            if farm_row:
                request.session["farm_id"] = farm_row["farm_id"]
        except Exception:
            pass 

    if redirect and redirect.startswith("/"):
        return RedirectResponse(url=f"{frontend_origin}{redirect}", status_code=302)

    return RedirectResponse(url=f"{frontend_origin}/farms", status_code=302)