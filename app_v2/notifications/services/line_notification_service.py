from __future__ import annotations

import os
from typing import Any, Dict, Optional

from app_v2.db.core import resolve_db_path

from app_v2.notifications.repository.line_notification_job_repo import (
    LineNotificationJobRepository,
)
from app_v2.notifications.services.notification_scheduler import (
    NotificationScheduler,
)
from app_v2.notifications.services.notification_dispatcher import (
    NotificationDispatcher,
)
from app_v2.notifications.services.reminder_schedule_service import (
    ReminderScheduleService,
)
from app_v2.notifications.external.line_client import LineClient

LINE_MESSAGING_ACCESS_TOKEN_ENV = "LINE_MESSAGING_CHANNEL_ACCESS_TOKEN"


class LineNotificationService:
    """
    LINE Notification Service（Facade 専用・最終形）

    役割：
      - 外部（API / cron / webhook）からの通知要求を受ける
      - Scheduler / Dispatcher に委譲する
      - 自身はロジックを一切持たない

    方針：
      - DB パスは resolve_db_path() を唯一の正とする
      - 内部サービスの組み立てのみを担当
    """

    
    def __init__(
        self,
        *,
        job_repo: Optional[LineNotificationJobRepository] = None,
        reminder_service: Optional[ReminderScheduleService] = None,
        line_client: Optional[LineClient] = None,
    ) -> None:

        # Repository（DB パスは repo 側で解決）
        self._job_repo = job_repo or LineNotificationJobRepository()

        # Domain Services
        self._reminder_service = reminder_service or ReminderScheduleService()

        # External Client
        if line_client is not None:
            self._line_client = line_client
        else:
            token = os.getenv("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", "")
            self._line_client = LineClient(token)

        # Internal Services
        self._scheduler = NotificationScheduler(
            job_repo=self._job_repo,
        )
        self._dispatcher = NotificationDispatcher(
            job_repo=self._job_repo,
            line_client=self._line_client,
        )


    # ==============================================================
    # 外部公開 API（Facade）
    # ==============================================================

    def schedule_for_reservation(self, reservation_id: int) -> Optional[str]:
        """
        予約確定時の通知スケジューリング
        """
        return self._scheduler.schedule_for_reservation(reservation_id)

    def schedule_cancel_completed(self, reservation_id: int) -> Optional[int]:
        """
        キャンセル完了時の通知スケジューリング
        """
        return self._scheduler.schedule_cancel_completed(reservation_id)

    def send_pending_jobs(
        self,
        limit: int = 50,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """
        PENDING job の送信（cron / admin 共通）
        """
        return self._dispatcher.send_pending_jobs(
            limit=limit,
            dry_run=dry_run,
        )
