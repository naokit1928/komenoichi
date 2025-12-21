from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from app_v2.notifications.repository.line_notification_job_repo import (
    LineNotificationJobRepository,
)
from app_v2.notifications.repository.notification_data_repo import (
    NotificationDataRepository,
)
from app_v2.notifications.services.reminder_schedule_service import (
    ReminderScheduleService,
)
from app_v2.notifications.services.notification_context_builder import (
    NotificationContextBuilder,
)


class NotificationScheduler:
    """
    Notification Scheduler（V2 最終完成形）

    責務：
      - reservation に対して
      - どの通知 job を
      - いつ作るかを決める

    方針：
      - DB / SQL / sqlite3 には一切触らない
      - 読み取りは NotificationDataRepository に完全委譲
      - job 登録は LineNotificationJobRepository のみ
      - 送信処理・LINE API には一切触らない
    """

    def __init__(
        self,
        *,
        job_repo: Optional[LineNotificationJobRepository] = None,
        data_repo: Optional[NotificationDataRepository] = None,
        reminder_service: Optional[ReminderScheduleService] = None,
        context_builder: Optional[NotificationContextBuilder] = None,
    ) -> None:
        self._job_repo = job_repo or LineNotificationJobRepository()
        self._data_repo = data_repo or NotificationDataRepository()
        self._reminder_service = reminder_service or ReminderScheduleService()
        self._context_builder = context_builder or NotificationContextBuilder()

    # ==============================================================
    # Public API
    # ==============================================================

    def schedule_for_reservation(self, reservation_id: int) -> Optional[str]:
        """
        予約確定時の通知スケジューリング。
        CONFIRMATION / REMINDER を条件に応じて job 登録する。
        """

        # 既存 job の確認（job_repo は黒箱）
        existing_jobs = self._job_repo.get_jobs_by_reservation(reservation_id)

        has_confirmation = any(
            j["kind"] == "CONFIRMATION" and j["status"] in ("PENDING", "SENT")
            for j in existing_jobs
        )
        has_reminder = any(
            j["kind"] == "REMINDER" and j["status"] in ("PENDING", "SENT")
            for j in existing_jobs
        )

        # reservation / consumer 読み取り
        reservation, consumer = self._data_repo.fetch_reservation_and_consumer(
            reservation_id
        )
        if not reservation or not consumer:
            return None

        line_consumer_id = (consumer.get("line_consumer_id") or "").strip()
        if not line_consumer_id:
            return None

        # farm 読み取り
        farm = self._data_repo.fetch_farm(reservation["farm_id"])
        if not farm:
            return None

        # ContextBuilder に完全委譲
        ctx, event_start, _, confirmed_at = self._context_builder.build(
            reservation=reservation,
            user=consumer,
            farm=farm,
            line_consumer_id=line_consumer_id,
        )

        now_utc = datetime.now(timezone.utc)

        # --------------------------------------------------
        # CONFIRMATION
        # --------------------------------------------------
        if not has_confirmation:
            self._job_repo.insert_job(
                reservation_id=ctx.reservation_id,
                kind="CONFIRMATION",
                scheduled_at=now_utc,
            )

        # --------------------------------------------------
        # REMINDER
        # --------------------------------------------------
        reminder_result = self._reminder_service.calculate_reminder_time(
            pickup_start=event_start,
            confirmed_at=confirmed_at,
        )

        if reminder_result.should_send and reminder_result.scheduled_at:
            if not has_reminder:
                scheduled_at_utc = reminder_result.scheduled_at.astimezone(
                    timezone.utc
                )
                self._job_repo.insert_job(
                    reservation_id=ctx.reservation_id,
                    kind="REMINDER",
                    scheduled_at=scheduled_at_utc,
                )

        return "ok"

    def schedule_cancel_completed(self, reservation_id: int) -> Optional[int]:
        """
        キャンセル完了時の通知スケジューリング。
        CANCEL_COMPLETED を即時 job 登録する。
        """

        existing_jobs = self._job_repo.get_jobs_by_reservation(reservation_id)
        if any(
            j["kind"] == "CANCEL_COMPLETED" and j["status"] in ("PENDING", "SENT")
            for j in existing_jobs
        ):
            return None

        reservation, consumer = self._data_repo.fetch_reservation_and_consumer(
            reservation_id
        )
        if not reservation or not consumer:
            return None

        line_consumer_id = (consumer.get("line_consumer_id") or "").strip()
        if not line_consumer_id:
            return None

        farm = self._data_repo.fetch_farm(reservation["farm_id"])
        if not farm:
            return None

        # Context の妥当性チェックのみ（中身は使用しない）
        ctx, *_ = self._context_builder.build(
            reservation=reservation,
            user=consumer,
            farm=farm,
            line_consumer_id=line_consumer_id,
        )

        job = self._job_repo.insert_job(
            reservation_id=ctx.reservation_id,
            kind="CANCEL_COMPLETED",
            scheduled_at=datetime.now(timezone.utc),
        )
        return int(job["job_id"])
