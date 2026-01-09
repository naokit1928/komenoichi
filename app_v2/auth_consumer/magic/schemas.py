from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


# ============================================================
# Request
# ============================================================

class MagicLinkSendRequest(BaseModel):
    """
    ConfirmPage から送られてくる Magic Link 発行リクエスト。

    方針:
    - confirm_context の中身は一切解釈しない
    - JSON として保存できることだけを保証する
    """

    email: str = Field(
        ...,
        description="連絡用メールアドレス（厳密な検証は行わない）",
        min_length=1,
    )

    confirm_context: Dict[str, Any] = Field(
        ...,
        description="ConfirmPage の state をそのまま格納するコンテキスト",
    )

    agreed: bool = Field(
        ...,
        description="利用規約・同意チェック（true 必須）",
    )


# ============================================================
# Response
# ============================================================

class MagicLinkSendResponse(BaseModel):
    """
    Magic Link 送信結果レスポンス。

    Phase B（開発モード）方針:
    - 実メール送信は行わない
    - magic link URL をフロントに返し、必ず consume を通す
    """

    ok: bool = True

    # 開発用: フロントに表示する magic link
    # 本番では返さない想定（mailer 差し替えで削除可）
    debug_magic_link_url: Optional[str] = None
