import os
from fastapi import APIRouter, HTTPException, Request, status, BackgroundTasks
from fastapi.responses import RedirectResponse, HTMLResponse
from pydantic import BaseModel, Field

from app_v2.auth import farm_magic_service, farm_magic_repo
from app_v2.customer_booking.repository.consumer_repo import ConsumerRepository

router = APIRouter(
    prefix="/auth/farmer/magic",
    tags=["auth-farmer-magic"],
)

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


class FarmerMagicSendRequest(BaseModel):
    email: str = Field(
        ..., 
        min_length=5, 
        pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    )

@router.post("/send-login")
def send_login(req: FarmerMagicSendRequest, background_tasks: BackgroundTasks):
    try:
        url = farm_magic_service.send_login_magic_link(req.email)
        background_tasks.add_task(farm_magic_repo.cleanup_expired_tokens, 7)
        response = {"ok": True}
        if os.getenv("ENV") == "development":
            response["debug_magic_link_url"] = url
        return response
    except ValueError as e:
        if str(e) == "email_not_registered":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="email_not_registered")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.post("/send-register")
def send_register(req: FarmerMagicSendRequest, background_tasks: BackgroundTasks):
    try:
        url = farm_magic_service.send_register_magic_link(req.email)
        background_tasks.add_task(farm_magic_repo.cleanup_expired_tokens, 7)
        response = {"ok": True}
        if os.getenv("ENV") == "development":
            response["debug_magic_link_url"] = url
        return response
    except ValueError as e:
        if str(e) == "email_already_registered":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email_already_registered")
        raise HTTPException(status_code=500, detail="Internal Server Error")


# ======================================================
# GET /auth/farmer/magic/consume-login
# ======================================================

@router.get("/consume-login")
def consume_login(token: str, request: Request, redirect: str | None = None):
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    try:
        result = farm_magic_service.consume_magic_link(token)

        farm_id = result["farm_id"]
        is_registered = result["is_registered"]
        email = result["email"]

        # セッションをクリアして再セット
        request.session.clear()
        request.session["farm_id"] = farm_id

        consumer_repo = ConsumerRepository()
        consumer_id = consumer_repo.get_or_create_consumer_id_by_email(email=email)
        request.session["consumer_id"] = consumer_id

        if redirect and redirect.startswith("/farmer/"):
            target = f"{frontend_url}{redirect}"
            return RedirectResponse(target, status_code=302)

        if is_registered:
            target_path = "/farmer/reservations"
        else:
            target_path = "/farmer/registration"

        return RedirectResponse(f"{frontend_url}{target_path}", status_code=302)

    except ValueError as e:
        # ★ 変更: 生のJSONエラーではなく、美しいHTML画面を返す
        error_msg = str(e)
        title = "ログインリンクが無効です"
        if "expired" in error_msg.lower():
            message = "このリンクは有効期限（15分）が切れています。<br>お手数ですが、もう一度ログイン画面からリンクを発行してください。"
        elif "used" in error_msg.lower():
            message = "このリンクは既に使用されています。<br>セキュリティのため、リンクは1回のみ有効です。<br>もう一度リンクを発行してください。"
        else:
            message = "無効なリンクです。<br>URLが正しくコピーされているか確認するか、もう一度リンクを発行してください。"
        
        return _get_error_html(title, message, "ログイン画面へ戻る", f"{frontend_url}/auth/login")

@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}