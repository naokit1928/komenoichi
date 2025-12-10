# app_v2/feedback/services/feedback_service.py

from datetime import datetime, timedelta, timezone

from starlette.concurrency import run_in_threadpool

from app_v2.feedback.dtos import FeedbackRequest
from app_v2.feedback.utils.slack_notifier import SlackNotifier


JST = timezone(timedelta(hours=9))


class FeedbackService:
    """フィードバック送信のドメインロジックを担当するサービス層。

    - Slack に送るメッセージテキストの組み立て
    - SlackNotifier 経由での送信
    """

    def __init__(self) -> None:
        self._notifier = SlackNotifier()

    def _build_slack_message(self, payload: FeedbackRequest) -> str:
        """Slack に送るテキストメッセージを組み立てる。"""
        now = datetime.now(JST).strftime("%Y-%m-%d %H:%M:%S")
        email = payload.email or "(なし)"

        return (
            "📮 新しいフィードバック\n"
            f"日時: {now}\n"
            f"source: {payload.source}\n"
            f"email: {email}\n\n"
            "----- 本文 -----\n"
            f"{payload.message}"
        )

    async def send_feedback(self, payload: FeedbackRequest) -> bool:
        """フィードバックを Slack に送信する。

        URL 未設定の場合は False を返し、例外は握りつぶして False。
        """
        if not self._notifier.is_configured():
            print(
                "[FeedbackService] SLACK_WEBHOOK_URL が設定されていないため送信をスキップしました。"
            )
            return False

        text = self._build_slack_message(payload)

        # Slack 送信はスレッドプールで実行（blocking I/O を避ける）
        result = await run_in_threadpool(self._notifier.send_message, text)
        return bool(result.get("ok"))
