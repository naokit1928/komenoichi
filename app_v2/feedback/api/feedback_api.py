# app_v2/feedback/api/feedback_api.py

from fastapi import APIRouter, status

from app_v2.feedback.dtos import FeedbackRequest, FeedbackResponse
from app_v2.feedback.services.feedback_service import FeedbackService

router = APIRouter(tags=["feedback"])
service = FeedbackService()


@router.post(
    "/api/feedback",
    response_model=FeedbackResponse,
    status_code=status.HTTP_200_OK,
)
async def post_feedback(body: FeedbackRequest) -> FeedbackResponse:
    """フィードバックを受け取り、Slack に転送するだけのエンドポイント。

    - Slack への送信ロジックは FeedbackService に委譲
    - DB 保存や AI 分類はフェーズ2以降
    """
    ok = await service.send_feedback(body)
    return FeedbackResponse(ok=ok)
