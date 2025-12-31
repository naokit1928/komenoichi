from fastapi import APIRouter, HTTPException, Request, status

from app_v2.auth.schemas import (
    RequestOtpRequest,
    RequestOtpResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from app_v2.auth import otp_service


router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


# ======================================================
# POST /auth/request-otp
# ======================================================

@router.post(
    "/request-otp",
    response_model=RequestOtpResponse,
)
def request_otp(payload: RequestOtpRequest):
    try:
        otp_service.request_otp(email=payload.email)
    except ValueError as e:
        if str(e) == "email_not_registered":
            # セキュリティ上、詳細は返さない
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="email not registered",
            )
        raise

    return RequestOtpResponse()


# ======================================================
# POST /auth/verify-otp
# ======================================================

@router.post(
    "/verify-otp",
    response_model=VerifyOtpResponse,
)
def verify_otp(payload: VerifyOtpRequest, request: Request):
    # ★ ログインは「主体の切替」なので、まず既存セッションを破棄
    request.session.clear()

    try:
        otp_service.verify_otp(
            email=payload.email,
            code=payload.code,
        )
    except ValueError as e:
        reason = str(e)

        if reason == "invalid_otp":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid otp",
            )

        if reason == "otp_expired":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="otp expired",
            )

        if reason == "too_many_attempts":
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="too many attempts",
            )

        raise

    # ==================================================
    # セッション確立
    # ==================================================
    # farm_id の解決はここで行う（認証後）
    from app_v2.db.core import resolve_db_path
    import sqlite3

    conn = sqlite3.connect(resolve_db_path())
    try:
        row = conn.execute(
            "SELECT farm_id FROM farms WHERE email = ?",
            (payload.email,),
        ).fetchone()
    finally:
        conn.close()

    if row is None:
        # 理論上起きないが安全のため
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="farm not found",
        )

    # このログインで確定した主体をセッションにセット
    request.session["farm_id"] = row[0]

    return VerifyOtpResponse()


# ======================================================
# POST /auth/logout
# ======================================================

@router.post("/logout")
def logout(request: Request):
    """
    ログアウト API
    - セッションを完全に破棄する
    """
    request.session.clear()
    return {"ok": True}
