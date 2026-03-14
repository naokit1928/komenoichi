import os
from fastapi import APIRouter, HTTPException, Request, status, BackgroundTasks
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app_v2.auth import farm_magic_service, farm_magic_repo
from app_v2.customer_booking.repository.consumer_repo import ConsumerRepository

router = APIRouter(
    prefix="/auth/farmer/magic",
    tags=["auth-farmer-magic"],
)

class FarmerMagicSendRequest(BaseModel):
    email: str

@router.post("/send-login")
def send_login(req: FarmerMagicSendRequest, background_tasks: BackgroundTasks):
    try:
        url = farm_magic_service.send_login_magic_link(req.email)
        
        # バックグラウンドで古いトークンのクリーンアップを実行
        background_tasks.add_task(farm_magic_repo.cleanup_expired_tokens, 7)
        
        response = {"ok": True}
        if os.getenv("ENV") == "development":
            response["debug_magic_link_url"] = url
        return response
    except ValueError as e:
        if str(e) == "email_not_registered":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="email_not_registered",
            )
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.post("/send-register")
def send_register(req: FarmerMagicSendRequest, background_tasks: BackgroundTasks):
    try:
        url = farm_magic_service.send_register_magic_link(req.email)
        
        # バックグラウンドで古いトークンのクリーンアップを実行
        background_tasks.add_task(farm_magic_repo.cleanup_expired_tokens, 7)
        
        response = {"ok": True}
        if os.getenv("ENV") == "development":
            response["debug_magic_link_url"] = url
        return response
    except ValueError as e:
        if str(e) == "email_already_registered":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="email_already_registered",
            )
        raise HTTPException(status_code=500, detail="Internal Server Error")

# ======================================================
# GET /auth/farmer/magic/consume-login
# ======================================================

@router.get("/consume-login")
def consume_login(token: str, request: Request, redirect: str | None = None):
    try:
        result = farm_magic_service.consume_magic_link(token)

        farm_id = result["farm_id"]
        is_registered = result["is_registered"]
        email = result["email"] # サービスからemailを受け取る

        # 1. セッションをクリア
        request.session.clear()
        
        # 2. 農家としてのセッションをセット
        request.session["farm_id"] = farm_id

        # 3. ★ デュアルセッション: 消費者としてのセッションもセット
        consumer_repo = ConsumerRepository()
        consumer_id = consumer_repo.get_or_create_consumer_id_by_email(email=email)
        request.session["consumer_id"] = consumer_id

        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

        # リダイレクト先の決定
        if redirect and redirect.startswith("/farmer/"):
            target = f"{frontend_url}{redirect}"
            return RedirectResponse(target, status_code=302)

        if is_registered:
            target_path = "/farmer/reservations"
        else:
            target_path = "/farmer/registration"

        return RedirectResponse(f"{frontend_url}{target_path}", status_code=302)

    except ValueError as e:
        # トークン無効 or 期限切れ
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}