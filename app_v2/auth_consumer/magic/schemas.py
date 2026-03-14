from typing import Optional
from pydantic import BaseModel, Field

# ============================================================
# Request
# ============================================================

class MagicLinkLoginSendRequest(BaseModel):
    """
    LoginOnlyPage / FarmDetail から送られてくる Magic Link 発行リクエスト（ログイン専用）。

    方針:
    - 予約は新規作成しない
    - email のみで consumer を解決する
    - redirect があれば consume-login 後にそのパスへ戻す
    """
    email: str = Field(
        ...,
        description="ログイン用メールアドレス",
        min_length=5,
        pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    )
    redirect: Optional[str] = Field(
        default=None,
        description="Magic Link 消費後に戻すフロントエンドのパス（省略時は booked に行かない）",
    )

# ============================================================
# Response
# ============================================================

class MagicLinkSendResponse(BaseModel):
    ok: bool = True
    debug_magic_link_url: Optional[str] = None

class MagicLinkLoginSendResponse(BaseModel):
    ok: bool = True
    debug_magic_link_url: Optional[str] = None