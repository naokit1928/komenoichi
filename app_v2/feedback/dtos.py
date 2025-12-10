# app_v2/feedback/dtos.py

from pydantic import BaseModel, EmailStr, Field


class FeedbackRequest(BaseModel):
    """
    フィードバックページから受け取るリクエストボディ。
    - source: どこから来たか（将来 LINE などとも共通化できるように）
    - message: 本文（フロントで 20〜500 文字バリデート済み）
    - email: 任意の連絡先（原則返信はしない）
    """
    source: str = Field(
        "feedback_page",
        description="フィードバック元（例: feedback_page, line, admin など）",
    )
    message: str = Field(
        ...,
        min_length=20,
        max_length=500,
        description="フィードバック本文",
    )
    email: EmailStr | None = Field(
        None,
        description="連絡先メールアドレス（原則返信はしない・任意）",
    )


class FeedbackResponse(BaseModel):
    ok: bool
