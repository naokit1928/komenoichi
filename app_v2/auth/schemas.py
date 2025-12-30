from pydantic import BaseModel, EmailStr, Field
from typing import Optional


# =========================
# 共通レスポンス
# =========================

class OkResponse(BaseModel):
    ok: bool = True


# =========================
# OTP 発行
# =========================

class RequestOtpRequest(BaseModel):
    email: EmailStr = Field(
        ...,
        description="登録済み農家のメールアドレス"
    )


class RequestOtpResponse(OkResponse):
    """
    成功時は常に ok: true のみ返す
    （存在有無・送信成否をクライアントに漏らさない）
    """
    pass


# =========================
# OTP 検証
# =========================

class VerifyOtpRequest(BaseModel):
    email: EmailStr = Field(
        ...,
        description="登録済み農家のメールアドレス"
    )
    code: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="6桁のワンタイムコード"
    )



class VerifyOtpResponse(OkResponse):
    """
    認証成功レスポンス
    セッションはサーバ側で確立される
    """
    pass
