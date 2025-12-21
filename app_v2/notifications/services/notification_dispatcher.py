from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, List

from app_v2.notifications.dtos import NotificationContextDTO
from app_v2.notifications.repository.line_notification_job_repo import (
    LineNotificationJobRepository,
)
from app_v2.notifications.repository.notification_context_repo import (
    NotificationContextRepository,
)
from app_v2.notifications.services.line_message_builder import LineMessageBuilder
from app_v2.notifications.services.notification_context_builder import (
    NotificationContextBuilder,
)
from app_v2.notifications.external.line_client import LineClient


class NotificationDispatcher:
    """
    Notification Dispatcher（V2 完全体）

    責務:
      - PENDING job を取得する
      - Repository から Context 元データを取得する
      - ContextBuilder で通知コンテキストを生成する
      - メッセージを組み立てる
      - LINE API に送信する
      - job の status を更新する

    非責務:
      - DB / SQL / sqlite3
      - job の作成
      - 送信タイミング判断
    """

    def __init__(
        self,
        *,
        job_repo: Optional[LineNotificationJobRepository] = None,
        context_repo: Optional[NotificationContextRepository] = None,
        line_client: Optional[LineClient] = None,
        context_builder: Optional[NotificationContextBuilder] = None,
    ) -> None:
        self._job_repo = job_repo or LineNotificationJobRepository()
        self._context_repo = context_repo or NotificationContextRepository()
        self._line_client = line_client or LineClient.from_env()
        self._context_builder = context_builder or NotificationContextBuilder()

    # ==============================================================
    # Public API
    # ==============================================================

    def send_pending_jobs(
        self, limit: int = 50, dry_run: bool = False
    ) -> Dict[str, Any]:
        now_utc = datetime.now(timezone.utc)
        jobs = self._job_repo.list_pending_jobs(before=now_utc)[:limit]

        processed = sent = failed = 0
        results: List[Dict[str, Any]] = []

        for job in jobs:
            job_id = int(job["job_id"])
            processed += 1

            try:
                ctx = self._build_context_for_job(job)
                if ctx is None:
                    self._mark_failed(
                        job_id,
                        "failed to build notification context",
                        increment=True,
                    )
                    failed += 1
                    continue

                if not dry_run:
                    message = self._build_message(job["kind"], ctx)
                    self._line_client.push_message(
                        ctx.customer_line_user_id,
                        message,
                    )

                self._job_repo.update_status(job_id, status="SENT")
                sent += 1

                results.append(
                    {
                        "job_id": job_id,
                        "result": "SENT",
                        "error": None,
                    }
                )

            except Exception as e:
                self._mark_failed(job_id, str(e), increment=True)
                failed += 1
                results.append(
                    {
                        "job_id": job_id,
                        "result": "FAILED",
                        "error": str(e),
                    }
                )

        return {
            "ok": True,
            "summary": {
                "total_candidates": len(jobs),
                "processed": processed,
                "sent": sent,
                "failed": failed,
                "dry_run": dry_run,
            },
            "results": results,
        }

    # ==============================================================
    # Internal helpers
    # ==============================================================

    def _mark_failed(self, job_id: int, error: str, increment: bool) -> None:
        self._job_repo.update_status(
            job_id,
            status="FAILED",
            last_error=error,
            increment_attempt=increment,
        )

    def _build_context_for_job(
        self, job: Dict[str, Any]
    ) -> Optional[NotificationContextDTO]:
        reservation_id = int(job["reservation_id"])

        reservation, user, farm = self._context_repo.fetch_context_sources(
            reservation_id
        )
        if not reservation or not user or not farm:
            return None

        line_consumer_id = (user.get("line_consumer_id") or "").strip()
        if not line_consumer_id:
            return None

        ctx, *_ = self._context_builder.build(
            reservation=reservation,
            user=user,
            farm=farm,
            line_consumer_id=line_consumer_id,
        )
        return ctx

    def _build_message(self, kind: str, ctx: NotificationContextDTO) -> str:
        if kind == "CONFIRMATION":
            return LineMessageBuilder.build_confirmation(ctx)
        if kind == "REMINDER":
            return LineMessageBuilder.build_reminder(ctx)
        if kind == "CANCEL_COMPLETED":
            return LineMessageBuilder.build_cancel_completed(ctx)
        raise ValueError(f"unknown notification kind: {kind}")
