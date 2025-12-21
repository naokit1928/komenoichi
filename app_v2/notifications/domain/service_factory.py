from app_v2.notifications.services.line_notification_v2_service import (
    LineNotificationV2Service,
)
from app_v2.notifications.repository.line_notification_job_v2_repo import (
    LineNotificationJobV2Repository,
)

def create_line_notification_service() -> LineNotificationV2Service:
    """
    LineNotificationV2Service の唯一の生成点（V2 統一）

    - webhook / cron / 手動実行 すべてここを通す
    - Service / Repository の契約をここに固定
    """
    job_repo = LineNotificationJobV2Repository()
    return LineNotificationV2Service(job_repo=job_repo)
