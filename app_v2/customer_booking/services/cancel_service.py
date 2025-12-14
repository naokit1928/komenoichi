from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Tuple

from app_v2.customer_booking.repository.reservation_repo import (
    get_reservation_by_id,
    cancel_reservation_db,
)
from app_v2.customer_booking.utils.cancel_token import CancelTokenPayload

from app_v2.customer_booking.services.reservation_expanded_service import (
    _parse_db_datetime,
    _calc_event_for_booking,
    _format_event_display_label,
)

# ★★ REMINDER 削除に必要
from app_v2.notifications.repository.line_notification_job_repo import (
    LineNotificationJobRepository,
)
from app_v2.notifications.services.line_notification_service import (
    LineNotificationService,
)

JST = timezone(timedelta(hours=9))


# -----------------------------------------------------
# Domain Errors
# -----------------------------------------------------
class CancelDomainError(Exception):
    pass


class InvalidTokenError(CancelDomainError):
    pass


class ReservationNotFoundError(CancelDomainError):
    pass


class AlreadyCancelledError(CancelDomainError):
    pass


class NotCancellableError(CancelDomainError):
    pass


# -----------------------------------------------------
# Page DTO
# -----------------------------------------------------
@dataclass
class CancelPageData:
    reservation_id: int
    pickup_display: str
    qty_5: int
    qty_10: int
    qty_25: int
    rice_subtotal: int
    is_cancellable: bool


# -----------------------------------------------------
# Service
# -----------------------------------------------------
class CancelService:

    def __init__(self) -> None:
        self.job_repo = LineNotificationJobRepository()
        self.notification_service = LineNotificationService()

    # -------------------------------------------------
    # items_json → qty_*（既存ロジックそのまま）
    # -------------------------------------------------
    def _parse_items_json(self, items_json: str) -> Tuple[int, int, int]:
        try:
            items = json.loads(items_json) if items_json else []
        except Exception:
            items = []

        qty_5 = qty_10 = qty_25 = 0
        for item in items:
            try:
                size = int(item.get("size_kg"))
                quantity = int(item.get("quantity", 0) or 0)
            except Exception:
                continue

            if size == 5:
                qty_5 += quantity
            elif size == 10:
                qty_10 += quantity
            elif size == 25:
                qty_25 += quantity

        return qty_5, qty_10, qty_25

    # -------------------------------------------------
    # pickup_display / is_cancellable（既存ロジック）
    # -------------------------------------------------
    def _calc_pickup_info(self, reservation_row: dict) -> Tuple[str, bool]:
        created_at_raw = reservation_row.get("created_at")
        pickup_slot_code = reservation_row.get("pickup_slot_code")

        if not created_at_raw or not pickup_slot_code:
            raise CancelDomainError("INVALID_RESERVATION_DATA")

        created_at_dt = _parse_db_datetime(created_at_raw)
        event_start, event_end = _calc_event_for_booking(created_at_dt, pickup_slot_code)
        pickup_display = _format_event_display_label(event_start, event_end)

        now_jst = datetime.now(JST)
        cancel_limit = event_start - timedelta(hours=3)

        return pickup_display, now_jst < cancel_limit

    # -------------------------------------------------
    # ★ Phase2 正式：token と reservation の照合
    # -------------------------------------------------
    def _verify_token_user(self, payload: CancelTokenPayload, row: dict) -> None:
        """
        CancelTokenPayload.consumer_id と
        reservations.consumer_id が一致するかを検証する。
        """
        db_consumer_id = row.get("consumer_id")
        if db_consumer_id is None:
            raise InvalidTokenError("RESERVATION_HAS_NO_CONSUMER")

        if int(db_consumer_id) != int(payload.consumer_id):
            raise InvalidTokenError("CONSUMER_ID_MISMATCH")

    # -------------------------------------------------
    # GET /cancel（確認ページ）
    # -------------------------------------------------
    def build_cancel_page_data(self, payload: CancelTokenPayload) -> CancelPageData:
        row = get_reservation_by_id(int(payload.reservation_id))
        if not row:
            raise ReservationNotFoundError("NOT_FOUND")

        if row["status"] == "cancelled":
            raise AlreadyCancelledError("ALREADY_CANCELLED")

        # ★ consumer_id で正当性チェック
        self._verify_token_user(payload, row)

        qty_5, qty_10, qty_25 = self._parse_items_json(row.get("items_json", ""))
        rice_subtotal = int(row.get("rice_subtotal", 0))
        pickup_display, is_cancellable = self._calc_pickup_info(row)

        return CancelPageData(
            reservation_id=int(payload.reservation_id),
            pickup_display=pickup_display,
            qty_5=qty_5,
            qty_10=qty_10,
            qty_25=qty_25,
            rice_subtotal=rice_subtotal,
            is_cancellable=is_cancellable,
        )

    # -------------------------------------------------
    # POST /cancel（実キャンセル）
    # -------------------------------------------------
    def cancel_reservation(self, payload: CancelTokenPayload) -> CancelPageData:
        data = self.build_cancel_page_data(payload)

        if not data.is_cancellable:
            raise NotCancellableError("CANCEL_LIMIT_PASSED")

        # ---- 状態更新
        cancel_reservation_db(data.reservation_id)

        # -------------------------------------------------
        # REMINDER(PENDING) 削除
        # -------------------------------------------------
        deleted = self.job_repo.delete_pending_reminder_jobs(data.reservation_id)
        print(f"[CancelService] deleted pending REMINDER jobs: {deleted}")

        # -------------------------------------------------
        # キャンセル完了通知（CANCEL_COMPLETED）
        # -------------------------------------------------
        job_id = self.notification_service.schedule_cancel_completed(data.reservation_id)

        if job_id:
            try:
               self.notification_service.send_single_job(job_id, dry_run=False)
            except Exception as e:
               # ★ 通知失敗は致命的ではない
               print(f"[CancelService] CANCEL_COMPLETED send failed: {e}")
