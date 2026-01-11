from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Tuple

from app_v2.customer_booking.repository.reservation_repo import (
    get_reservation_by_id,
)
from app_v2.customer_booking.utils.cancel_token import CancelTokenPayload

# 状態遷移はここに集約（キャンセルの本体）
from app_v2.customer_booking.services.booking_lifecycle_service import (
    Booking_Lifecycle_Service,
)

UTC = timezone.utc


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
        self.status_service = Booking_Lifecycle_Service()

    # -------------------------------------------------
    # items_json → qty_*（既存ロジック維持）
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
    # pickup_display / is_cancellable（DB唯一正）
    # -------------------------------------------------
    def _calc_pickup_info(self, reservation_row: dict) -> Tuple[str, bool]:
        pickup_display = reservation_row.get("pickup_display") or ""

        event_start_raw = reservation_row.get("event_start_at")
        if not event_start_raw:
            raise CancelDomainError("EVENT_START_NOT_SET")

        # DB に保存されている UTC 時刻をそのまま使う
        event_start = datetime.fromisoformat(event_start_raw)
        if event_start.tzinfo is None:
            event_start = event_start.replace(tzinfo=UTC)

        cancel_limit = event_start - timedelta(hours=3)
        now_utc = datetime.now(UTC)

        is_cancellable = now_utc < cancel_limit
        return pickup_display, is_cancellable

    # -------------------------------------------------
    # token と reservation の照合
    # -------------------------------------------------
    def _verify_token_user(self, payload: CancelTokenPayload, row: dict) -> None:
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

        # consumer_id の正当性チェック
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

        # 状態更新（正式・一元管理）
        self.status_service.cancel(data.reservation_id)

        # 通知・REMINDER・外部副作用はここでは一切行わない
        return data
