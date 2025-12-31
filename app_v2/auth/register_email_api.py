from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from datetime import datetime
import sqlite3

from app_v2.db.core import resolve_db_path
from app_v2.auth import otp_repo, otp_service


router = APIRouter(
    prefix="/auth/register-email",
    tags=["auth-register-email"],
)


# =========================
# Schemas
# =========================

class RequestOtpRequest(BaseModel):
    email: EmailStr


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    code: str


class OkResponse(BaseModel):
    ok: bool = True


# =========================
# Helpers
# =========================

def _farm_exists(email: str) -> bool:
    conn = sqlite3.connect(resolve_db_path())
    try:
        row = conn.execute(
            "SELECT 1 FROM farms WHERE email = ? LIMIT 1",
            (email,),
        ).fetchone()
        return row is not None
    finally:
        conn.close()


def _create_empty_farm(email: str) -> int:
    """
    email 登録完了時点で farm を永続化する。
    registration_status は必須。
    """
    conn = sqlite3.connect(resolve_db_path())
    try:
        cur = conn.execute(
            """
            INSERT INTO farms (
                email,
                registration_status,
                active_flag,
                is_public,
                is_accepting_reservations
            ) VALUES (?, ?, 0, 0, 0)
            """,
            (
                email,
                "EMAIL_REGISTERED",
            ),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


# =========================
# POST /request-otp
# =========================

@router.post(
    "/request-otp",
    response_model=OkResponse,
)
def request_otp(
    payload: RequestOtpRequest,
    request: Request,
):
    # ★ 新規メール登録は必ず「匿名状態」から開始する
    # 既存セッションが混入するのを原理的に防ぐ
    request.session.clear()

    # email が既に使われていたらNG
    if _farm_exists(payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="email already registered",
        )

    issued_at = datetime.utcnow()
    expires_at = issued_at + otp_service.timedelta(
        minutes=otp_service.OTP_EXPIRE_MINUTES
    )
    code = otp_service._generate_otp_code()

    otp_repo.insert_otp(
        email=payload.email,
        code=code,
        expires_at=expires_at,
        created_at=issued_at,
    )

    otp_service._send_otp_email(
        email=payload.email,
        code=code,
    )

    return OkResponse()


# =========================
# POST /verify-otp
# =========================

@router.post(
    "/verify-otp",
    response_model=OkResponse,
)
def verify_otp(payload: VerifyOtpRequest, request: Request):
    try:
        otp_service.verify_otp(
            email=payload.email,
            code=payload.code,
        )
    except ValueError as e:
        reason = str(e)

        if reason == "invalid_otp":
            raise HTTPException(status_code=401, detail="invalid otp")
        if reason == "otp_expired":
            raise HTTPException(status_code=401, detail="otp expired")
        if reason == "too_many_attempts":
            raise HTTPException(status_code=429, detail="too many attempts")

        raise

    if _farm_exists(payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="email already registered",
        )

    farm_id = _create_empty_farm(payload.email)

    # 新規登録された farm をこのセッションの主体として確定
    request.session["farm_id"] = farm_id

    return OkResponse()
