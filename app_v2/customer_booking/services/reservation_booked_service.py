from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from pydantic import BaseModel

from app_v2.customer_booking.dtos import ReservationContextDTO
from app_v2.customer_booking.repository.reservation_booked_repo import (
    ReservationBookedRepository,
)
from app_v2.customer_booking.utils.cancel_token import (
    CancelTokenPayload,
    create_cancel_token,
)

# ★ NotificationContextBuilder を唯一の正として使用
from app_v2.notifications.services.notification_context_builder import (
    NotificationContextBuilder,
)


class ReservationBookedViewDTO(BaseModel):
    reservation_id: int
    reservation_status: Optional[str] = None

    context: ReservationContextDTO

    event_start: str
    confirmed_at: str

    is_expired: bool
    is_expired_for_display: bool


class ReservationBookedService:
    """
    ReservationBookedPage 専用 Service（最終形）

    方針（固定）:
    - NotificationContextBuilder を唯一の正とする
    - NotificationService / Scheduler / Dispatcher には依存しない
    - DB 取得は Repository に完全委譲
    - 本 Service は「Web 表示用 DTO への詰め替え」のみ
    """

    def __init__(
        self,
        repo: Optional[ReservationBookedRepository] = None,
        context_builder: Optional[NotificationContextBuilder] = None,
    ) -> None:
        self._repo = repo or ReservationBookedRepository()
        self._context_builder = context_builder or NotificationContextBuilder()

    @staticmethod
    def _row_get(row, key: str) -> Optional[str]:
        # sqlite3.Row は get() を持たないので安全取得
        try:
            return row[key]
        except Exception:
            return None

    def get_view_for_reservation(
        self,
        reservation_id: int,
    ) -> Optional[ReservationBookedViewDTO]:

        conn = self._repo.open_connection()
        try:
            # --------------------------------
            # DB 取得（Rowのまま）
            # --------------------------------
            reservation_row, consumer_row = self._repo.fetch_reservation_and_consumer(
                conn, reservation_id
            )
            if not reservation_row or not consumer_row:
                return None

            farm_row = self._repo.fetch_farm(conn, reservation_row["farm_id"])
            if not farm_row:
                return None

            # --------------------------------
            # ContextBuilder（唯一の正）
            # --------------------------------
            line_consumer_id = (consumer_row["line_consumer_id"] or "").strip()

            (
                notification_ctx,
                event_start,
                event_end,
                confirmed_at,
            ) = self._context_builder.build(
                reservation=dict(reservation_row),
                user={
                    "consumer_id": int(consumer_row["consumer_id"]),
                    "line_consumer_id": line_consumer_id,
                },
                farm=dict(farm_row),
                line_consumer_id=line_consumer_id,
            )

            # --------------------------------
            # Web 用キャンセルトークン
            # --------------------------------
            cancel_deadline = event_start - timedelta(hours=3)
            cancel_token_exp = int(cancel_deadline.timestamp())

            ctx = ReservationContextDTO(
                reservation_id=notification_ctx.reservation_id,
                consumer_id=int(consumer_row["consumer_id"]),
                pickup_display=notification_ctx.pickup_display,
                pickup_place_name=notification_ctx.pickup_place_name,
                pickup_map_url=notification_ctx.pickup_map_url,
                pickup_detail_memo=notification_ctx.pickup_detail_memo,
                qty_5=notification_ctx.qty_5,
                qty_10=notification_ctx.qty_10,
                qty_25=notification_ctx.qty_25,
                label_5kg=notification_ctx.label_5kg,
                label_10kg=notification_ctx.label_10kg,
                label_25kg=notification_ctx.label_25kg,
                rice_subtotal=notification_ctx.rice_subtotal,
                pickup_code=notification_ctx.pickup_code,
                cancel_token_exp=cancel_token_exp,
            )

            payload = CancelTokenPayload(
                reservation_id=ctx.reservation_id,
                consumer_id=ctx.consumer_id,
                exp=ctx.cancel_token_exp,
            )
            ctx.cancel_token = create_cancel_token(payload)

        finally:
            conn.close()

        # --------------------------------
        # expired 判定（表示専用）
        # --------------------------------
        now = datetime.now(tz=event_end.tzinfo) if event_end.tzinfo else datetime.now()

        is_expired = now >= event_end
        is_expired_for_display = now >= (event_end + timedelta(minutes=15))

        reservation_status = self._row_get(reservation_row, "status")

        return ReservationBookedViewDTO(
            reservation_id=ctx.reservation_id,
            reservation_status=reservation_status,
            context=ctx,
            event_start=event_start.isoformat(),
            confirmed_at=confirmed_at.isoformat(),
            is_expired=is_expired,
            is_expired_for_display=is_expired_for_display,
        )
