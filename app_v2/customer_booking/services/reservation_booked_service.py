from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from pydantic import BaseModel

from app_v2.customer_booking.dtos import (
    BookingContextDTO,
    ReservationContextDTO,
)
from app_v2.customer_booking.repository.reservation_booked_repo import (
    ReservationBookedRepository,
)
from app_v2.customer_booking.services.booking_context_builder import (
    BookingContextBuilder,
)
from app_v2.customer_booking.utils.cancel_token import (
    CancelTokenPayload,
    create_cancel_token,
)


class ReservationBookedViewDTO(BaseModel):
    reservation_id: int
    reservation_status: Optional[str] = None

    context: ReservationContextDTO
    confirmed_at: str

    is_expired: bool
    is_expired_for_display: bool


class ReservationBookedService:
    """
    STEP3 確定版:
    - 表示: DB の pickup_display
    - ロジック: DB の event_start_at / event_end_at
    - Builder: 表示コンテキストのみ
    """

    def __init__(
        self,
        repo: Optional[ReservationBookedRepository] = None,
        context_builder: Optional[BookingContextBuilder] = None,
    ) -> None:
        self._repo = repo or ReservationBookedRepository()
        self._context_builder = context_builder or BookingContextBuilder()

    @staticmethod
    def _parse_utc(value) -> Optional[datetime]:
        if value is None:
            return None
        if isinstance(value, datetime):
            dt = value
        else:
            dt = datetime.fromisoformat(str(value).replace(" ", "T"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt

    def get_view_for_reservation(
        self,
        reservation_id: int,
    ) -> Optional[ReservationBookedViewDTO]:

        conn = self._repo.open_connection()
        try:
            reservation_row, consumer_row = self._repo.fetch_reservation_and_consumer(
                conn, reservation_id
            )
            if not reservation_row or not consumer_row:
                return None

            event_start_at = self._parse_utc(
                reservation_row["event_start_at"]
            )
            event_end_at = self._parse_utc(
                reservation_row["event_end_at"]
            )
            if event_start_at is None or event_end_at is None:
                return None

            farm_row = self._repo.fetch_farm(
                conn, reservation_row["farm_id"]
            )
            if not farm_row:
                return None

            # 表示用 Context（event_* なし）
            reservation_for_builder = {
              "reservation_id": reservation_row["reservation_id"],
              "items_json": reservation_row["items_json"],
              "rice_subtotal": reservation_row["rice_subtotal"],
              "pickup_display": reservation_row["pickup_display"],
            }

            booking_ctx = self._context_builder.build(
               reservation=reservation_for_builder,
               user={"consumer_id": int(consumer_row["consumer_id"])},
               farm=dict(farm_row),
            )


            # キャンセル期限（DB event_start_at 基準）
            cancel_deadline = event_start_at - timedelta(hours=3)
            cancel_token_exp = int(cancel_deadline.timestamp())

            ctx = ReservationContextDTO(
                reservation_id=booking_ctx.reservation_id,
                consumer_id=int(consumer_row["consumer_id"]),
                pickup_display=reservation_row["pickup_display"],
                pickup_place_name=booking_ctx.pickup_place_name,
                pickup_map_url=booking_ctx.pickup_map_url,
                pickup_detail_memo=booking_ctx.pickup_detail_memo,
                qty_5=booking_ctx.qty_5,
                qty_10=booking_ctx.qty_10,
                qty_25=booking_ctx.qty_25,
                label_5kg=booking_ctx.label_5kg,
                label_10kg=booking_ctx.label_10kg,
                label_25kg=booking_ctx.label_25kg,
                rice_subtotal=booking_ctx.rice_subtotal,
                pickup_code=booking_ctx.pickup_code,
                cancel_token_exp=cancel_token_exp,
            )

            payload = CancelTokenPayload(
                reservation_id=ctx.reservation_id,
                consumer_id=ctx.consumer_id,
                exp=ctx.cancel_token_exp,
            )
            ctx.cancel_token = create_cancel_token(payload)

            confirmed_at = self._parse_utc(
                reservation_row["confirmed_at"]
                or reservation_row["payment_succeeded_at"]
            )

        finally:
            conn.close()

        now = datetime.now(tz=event_end_at.tzinfo)

        is_expired = now >= event_end_at
        is_expired_for_display = now >= (
            event_end_at + timedelta(minutes=15)
        )

        return ReservationBookedViewDTO(
            reservation_id=ctx.reservation_id,
            reservation_status=reservation_row["status"],
            context=ctx,
            confirmed_at=confirmed_at.isoformat(),
            is_expired=is_expired,
            is_expired_for_display=is_expired_for_display,
        )
