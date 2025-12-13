import os
from dotenv import load_dotenv

from app_v2.notifications.services.line_notification_service import LineNotificationService


def send_pending_notifications(limit: int = 50, dry_run: bool = True):
    """
    PENDING の通知ジョブを送信する（cron 用）

    ※ 現在は誤爆防止のため dry_run=True 固定
    """
    # .env 読み込み（ローカル / cron 両対応）
    load_dotenv()

    token = os.getenv("LINE_CHANNEL_ACCESS_TOKEN")
    if not token:
        raise RuntimeError("LINE_CHANNEL_ACCESS_TOKEN is not set")

    service = LineNotificationService()
    result = service.send_pending_jobs(limit=limit, dry_run=dry_run)
    return result


if __name__ == "__main__":
    # ★ 誤爆防止：常に dry_run=True
    result = send_pending_notifications(limit=50, dry_run=True)
    print("[send_pending_notifications] result:", result)
