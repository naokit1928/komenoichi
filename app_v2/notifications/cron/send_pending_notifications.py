import os
from dotenv import load_dotenv

from app_v2.notifications.services.line_notification_service import LineNotificationService

"""
notification_jobs 用 cron エントリーポイント（最終確定版）

責務：
- 環境変数をロードする
- LineNotificationService.send_pending_jobs を呼ぶ
- 結果をログ出力するだけ

設計原則：
- 判断ロジックを一切持たない
- DB / job / 文面には触らない
"""

def send_pending_notifications(limit: int = 50):
    """
    PENDING の通知ジョブを送信する（cron 用）

    dry_run は環境変数で制御する：
    - NOTIFICATION_CRON_DRY_RUN=true  -> dry_run=True
    - NOTIFICATION_CRON_DRY_RUN=false -> dry_run=False
    """
    # .env 読み込み（ローカル / Render cron 両対応）
    load_dotenv()

    dry_run_env = os.getenv("NOTIFICATION_CRON_DRY_RUN", "true").lower()
    dry_run = dry_run_env in ("1", "true", "yes")

    service = LineNotificationService()
    result = service.send_pending_jobs(limit=limit, dry_run=dry_run)
    return result


if __name__ == "__main__":
    result = send_pending_notifications(limit=50)
    print("[send_pending_notifications] result:", result)
