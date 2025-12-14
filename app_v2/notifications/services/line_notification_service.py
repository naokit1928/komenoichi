from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple, List
from zoneinfo import ZoneInfo

from app_v2.notifications.dtos import NotificationContextDTO
from app_v2.notifications.repository.line_notification_job_repo import (
    LineNotificationJobRepository,
)
from app_v2.notifications.services.reminder_schedule_service import (
    ReminderScheduleService,
)
from app_v2.notifications.services.line_message_builder import LineMessageBuilder
from app_v2.notifications.external.line_client import LineClient
from app_v2.customer_booking.services.reservation_expanded_service import (
    _calc_event_for_booking,
    _format_event_display_label,
    _generate_pickup_code,
)

JST = ZoneInfo("Asia/Tokyo")
DB_PATH = "app.db"
LINE_MESSAGING_ACCESS_TOKEN_ENV = "LINE_MESSAGING_CHANNEL_ACCESS_TOKEN"


class LineNotificationService:
    """
    LINE 通知サービス（新 notification_jobs 対応）

    対象通知：
      - CONFIRMATION
      - REMINDER
      - CANCEL_COMPLETED
    """

    def __init__(
        self,
        db_path: str = DB_PATH,
        job_repo: Optional[LineNotificationJobRepository] = None,
        reminder_service: Optional[ReminderScheduleService] = None,
        line_client: Optional[LineClient] = None,
    ) -> None:
        self._db_path = db_path
        self._job_repo = job_repo or LineNotificationJobRepository(db_path=db_path)
        self._reminder_service = reminder_service or ReminderScheduleService()

        if line_client is not None:
            self._line_client = line_client
        else:
            token = os.getenv(LINE_MESSAGING_ACCESS_TOKEN_ENV, "")
            self._line_client = LineClient(token)

    # ==============================================================
    # cron / admin 共通：PENDING job の送信
    # ==============================================================

    def send_pending_jobs(self, limit: int = 50, dry_run: bool = False) -> Dict[str, Any]:
        now_utc = datetime.now(timezone.utc)
        jobs = self._job_repo.list_pending_jobs(before=now_utc)[:limit]

        processed = 0
        sent = 0
        failed = 0
        results: List[Dict[str, Any]] = []

        for job in jobs:
            job_id = int(job["job_id"])
            processed += 1

            try:
                # 実行時に reservation / consumer / farm を再取得
                ctx = self._build_context_for_job(job)
                if ctx is None:
                    # コンテキストを組めない＝送信不可
                    self._job_repo.update_status(
                        job_id,
                        status="FAILED",
                        last_error="failed to build notification context",
                        increment_attempt=True,
                    )
                    failed += 1
                    continue

                if not dry_run:
                    message_text = self._build_message_by_kind(job["kind"], ctx)
                    self._line_client.push_message(
                        ctx.customer_line_user_id,
                        message_text,
                    )

                self._job_repo.update_status(job_id, status="SENT")
                sent += 1

                results.append(
                    {
                        "job_id": job_id,
                        "result": "SENT",
                        "status_before": "PENDING",
                        "status_after": "SENT",
                        "attempt_count_after": job["attempt_count"],
                        "error": None,
                    }
                )

            except Exception as e:
                self._job_repo.update_status(
                    job_id,
                    status="FAILED",
                    last_error=str(e),
                    increment_attempt=True,
                )
                failed += 1
                results.append(
                    {
                        "job_id": job_id,
                        "result": "FAILED",
                        "status_before": "PENDING",
                        "status_after": "FAILED",
                        "attempt_count_after": job["attempt_count"] + 1,
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
    # Public API：予約確定時の通知スケジュール
    # ==============================================================

    def schedule_for_reservation(self, reservation_id: int) -> Optional[str]:
        conn = None
        try:
            conn = self._open_connection()

            existing_jobs = self._job_repo.get_jobs_by_reservation(reservation_id)

            has_confirmation = any(
                j["kind"] == "CONFIRMATION" and j["status"] in ("PENDING", "SENT")
                for j in existing_jobs
            )
            has_reminder = any(
                j["kind"] == "REMINDER" and j["status"] in ("PENDING", "SENT")
                for j in existing_jobs
            )

            reservation, user = self._fetch_reservation_and_user(conn, reservation_id)
            if not reservation or not user:
                return None

            line_consumer_id = (user.get("line_consumer_id") or "").strip()
            if not line_consumer_id:
                return None

            farm = self._fetch_farm(conn, reservation["farm_id"])
            if not farm:
                return None

            ctx, event_start, _, confirmed_at = self._build_context(
                reservation=reservation,
                user=user,
                farm=farm,
                line_consumer_id=line_consumer_id,
            )

            now_utc = datetime.now(timezone.utc)

            # CONFIRMATION
            if not has_confirmation:
                self._job_repo.insert_job(
                    reservation_id=ctx.reservation_id,
                    kind="CONFIRMATION",
                    scheduled_at=now_utc,
                )

            # REMINDER
            reminder_result = self._reminder_service.calculate_reminder_time(
                pickup_start=event_start,
                confirmed_at=confirmed_at,
            )

            if reminder_result.should_send and reminder_result.scheduled_at:
              if not has_reminder:
                scheduled_at_utc = reminder_result.scheduled_at.astimezone(timezone.utc)
                self._job_repo.insert_job(
                reservation_id=ctx.reservation_id,
                kind="REMINDER",
                scheduled_at=scheduled_at_utc,
              )

            return "ok"
        finally:
            if conn is not None:
                conn.close()

    # ==============================================================
    # Public API：キャンセル完了通知
    # ==============================================================

    def schedule_cancel_completed(self, reservation_id: int) -> Optional[int]:
        conn = None
        try:
            conn = self._open_connection()

            existing_jobs = self._job_repo.get_jobs_by_reservation(reservation_id)
            if any(
                j["kind"] == "CANCEL_COMPLETED" and j["status"] in ("PENDING", "SENT")
                for j in existing_jobs
            ):
                return None

            reservation, user = self._fetch_reservation_and_user(conn, reservation_id)
            if not reservation or not user:
                return None

            line_consumer_id = (user.get("line_consumer_id") or "").strip()
            if not line_consumer_id:
                return None

            farm = self._fetch_farm(conn, reservation["farm_id"])
            if not farm:
                return None

            ctx, *_ = self._build_context(
                reservation=reservation,
                user=user,
                farm=farm,
                line_consumer_id=line_consumer_id,
            )

            job = self._job_repo.insert_job(
                reservation_id=ctx.reservation_id,
                kind="CANCEL_COMPLETED",
                scheduled_at=datetime.now(timezone.utc),
            )
            return int(job["job_id"])
        finally:
            if conn is not None:
                conn.close()

    # ==============================================================
    # 内部ヘルパー
    # ==============================================================

    def _open_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _fetch_reservation_and_user(
        self, conn: sqlite3.Connection, reservation_id: int
    ) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        sql = """
        SELECT r.*, c.consumer_id, c.line_consumer_id
        FROM reservations r
        JOIN consumers c ON r.consumer_id = c.consumer_id
        WHERE r.reservation_id = ?
        """
        row = conn.execute(sql, (reservation_id,)).fetchone()
        if not row:
            return None, None

        r = dict(row)
        reservation = {k: r[k] for k in r if k != "line_consumer_id"}
        user = {
            "consumer_id": r.get("consumer_id"),
            "line_consumer_id": r.get("line_consumer_id"),
        }
        return reservation, user

    def _fetch_farm(self, conn: sqlite3.Connection, farm_id: Any) -> Optional[Dict[str, Any]]:
        try:
            fid = int(farm_id)
        except Exception:
            return None
        row = conn.execute(
            "SELECT * FROM farms WHERE farm_id = ?", (fid,)
        ).fetchone()
        return dict(row) if row else None

    def _build_context_for_job(self, job: Dict[str, Any]) -> Optional[NotificationContextDTO]:
        conn = None
        try:
            conn = self._open_connection()
            reservation_id = int(job["reservation_id"])

            reservation, user = self._fetch_reservation_and_user(conn, reservation_id)
            if not reservation or not user:
                return None

            line_consumer_id = (user.get("line_consumer_id") or "").strip()
            if not line_consumer_id:
                return None

            farm = self._fetch_farm(conn, reservation["farm_id"])
            if not farm:
                return None

            ctx, *_ = self._build_context(
                reservation=reservation,
                user=user,
                farm=farm,
                line_consumer_id=line_consumer_id,
            )
            return ctx
        finally:
            if conn is not None:
                conn.close()

    def _build_message_by_kind(self, kind: str, ctx: NotificationContextDTO) -> str:
        if kind == "CONFIRMATION":
            return LineMessageBuilder.build_confirmation(ctx)
        if kind == "REMINDER":
            return LineMessageBuilder.build_reminder(ctx)
        if kind == "CANCEL_COMPLETED":
            return LineMessageBuilder.build_cancel_completed(ctx)
        raise ValueError(f"unknown notification kind: {kind}")

    def _build_context(
        self,
        reservation: Dict[str, Any],
        user: Dict[str, Any],
        farm: Dict[str, Any],
        line_consumer_id: str,
    ) -> Tuple[NotificationContextDTO, datetime, datetime, datetime]:
        created_at = self._parse_db_utc_to_jst(reservation.get("created_at"))
        event_start, event_end = _calc_event_for_booking(
            created_at=created_at,
            pickup_slot_code=str(reservation.get("pickup_slot_code") or ""),
        )

        pickup_display = _format_event_display_label(event_start, event_end)
        pickup_code = _generate_pickup_code(
            reservation_id=int(reservation["reservation_id"]),
            consumer_id=int(user["consumer_id"]),
        )

        items = self._parse_items(reservation.get("items_json") or "[]")
        qty_5, qty_10, qty_25, s5, s10, s25 = self._aggregate_rice_items(items)

        confirmed_at = self._parse_db_utc_to_jst(
            reservation.get("payment_succeeded_at") or reservation.get("created_at")
        )

        ctx = NotificationContextDTO(
            reservation_id=int(reservation["reservation_id"]),
            farm_id=int(reservation["farm_id"]),
            customer_line_user_id=line_consumer_id,
            pickup_display=pickup_display,
            pickup_place_name=farm.get("pickup_place_name") or "",
            pickup_map_url=self._build_google_maps_url(
                farm.get("pickup_lat"), farm.get("pickup_lng")
            )
            if farm.get("pickup_lat") and farm.get("pickup_lng")
            else "",
            pickup_detail_memo=farm.get("pickup_notes") or "",
            pickup_code=pickup_code,
            qty_5=qty_5,
            qty_10=qty_10,
            qty_25=qty_25,
            subtotal_5=s5,
            subtotal_10=s10,
            subtotal_25=s25,
            rice_subtotal=reservation.get("rice_subtotal") or (s5 + s10 + s25),
            label_5kg="5kg",
            label_10kg="10kg",
            label_25kg="25kg",
        )

        return ctx, event_start, event_end, confirmed_at

    def _parse_items(self, items_json: str) -> Any:
        try:
            return json.loads(items_json)
        except Exception:
            return []

    def _aggregate_rice_items(self, items: Any):
        qty_5 = qty_10 = qty_25 = s5 = s10 = s25 = 0
        for i in items if isinstance(items, list) else []:
            try:
                size = int(i.get("size_kg"))
                q = int(i.get("quantity") or 0)
                s = int(i.get("subtotal") or 0)
            except Exception:
                continue
            if size == 5:
                qty_5 += q
                s5 += s
            elif size == 10:
                qty_10 += q
                s10 += s
            elif size == 25:
                qty_25 += q
                s25 += s
        return qty_5, qty_10, qty_25, s5, s10, s25

    def _parse_db_utc_to_jst(self, value: Any) -> datetime:
        if value is None:
            return datetime.now(tz=JST)
        if isinstance(value, datetime):
            dt = value
        else:
            dt = datetime.fromisoformat(str(value).replace(" ", "T"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(JST)

    def _build_google_maps_url(self, lat: float, lng: float) -> str:
        return f"https://www.google.com/maps/search/?api=1&query={lat},{lng}"
