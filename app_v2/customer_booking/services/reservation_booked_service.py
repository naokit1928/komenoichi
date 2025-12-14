# app_v2/customer_booking/services/reservation_booked_service.py

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from pydantic import BaseModel

from app_v2.customer_booking.dtos import ReservationContextDTO
from app_v2.notifications.services.line_notification_service import (
    LineNotificationService,
)

# Web キャンセル用トークン
from app_v2.customer_booking.utils.cancel_token import (
    CancelTokenPayload,
    create_cancel_token,
)


class ReservationBookedViewDTO(BaseModel):
    """
    ReservationBooked ページ用 DTO
    ※ notifications / CANCEL_TEMPLATE には一切依存しない
    """

    reservation_id: int
    reservation_status: Optional[str] = None

    context: ReservationContextDTO

    event_start: str
    confirmed_at: str

    is_expired: bool = False
    is_expired_for_display: bool = False


class ReservationBookedService:
    """
    ReservationBookedPage 専用 Service
    """

    def __init__(
        self,
        notification_service: Optional[LineNotificationService] = None,
    ) -> None:
        self._notification_service = (
            notification_service or LineNotificationService()
        )

    def get_view_for_reservation(
        self,
        reservation_id: int,
    ) -> Optional[ReservationBookedViewDTO]:
        """
        reservation_id を受け取り、
        ReservationBookedPage 用の DTO を返す
        """

        conn = self._notification_service._open_connection()
        try:
            # -------------------------------------------------
            # reservations / consumers（新テーブル）
            # -------------------------------------------------
            reservation, consumer = (
                self._notification_service._fetch_reservation_and_user(
                    conn, reservation_id
                )
            )
            if not reservation or not consumer:
                print(
                    "[ReservationBookedService] reservation or consumer not found "
                    f"(reservation_id={reservation_id})"
                )
                return None

            # -------------------------------------------------
            # 農家情報
            # -------------------------------------------------
            farm = self._notification_service._fetch_farm(
                conn, reservation.get("farm_id")
            )
            if not farm:
                print(
                    "[ReservationBookedService] farm not found "
                    f"(farm_id={reservation.get('farm_id')})"
                )
                return None

            # LINE consumer id（通知用。UI では使わない）
            line_consumer_id = (consumer.get("line_consumer_id") or "").strip()

            # -------------------------------------------------
            # notifications 側で Context を一度組み立てる
            # -------------------------------------------------
            (
                notification_ctx,
                event_start,
                event_end,
                confirmed_at,
            ) = self._notification_service._build_context(
                reservation=reservation,
                user=consumer,
                farm=farm,
                line_consumer_id=line_consumer_id,
            )

            # -------------------------------------------------
            # キャンセル期限
            # 受け渡し開始 3 時間前までキャンセル可
            # -------------------------------------------------
            cancel_deadline = event_start - timedelta(hours=3)
            cancel_token_exp = int(cancel_deadline.timestamp())

            # -------------------------------------------------
            # customer_booking 用 Context に詰め替え
            # -------------------------------------------------
            ctx = ReservationContextDTO(
                reservation_id=notification_ctx.reservation_id,
                consumer_id=reservation.get("consumer_id"),

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

            # -------------------------------------------------
            # Web 用キャンセルトークン生成
            # -------------------------------------------------
            payload = CancelTokenPayload(
                reservation_id=ctx.reservation_id,
                consumer_id=ctx.consumer_id,
                exp=ctx.cancel_token_exp,
            )
            ctx.cancel_token = create_cancel_token(payload)

        finally:
            conn.close()

        # -------------------------------------------------
        # reservation_status
        # -------------------------------------------------
        reservation_status: Optional[str] = reservation.get("status")

        # -------------------------------------------------
        # is_expired / is_expired_for_display
        # -------------------------------------------------
        if event_end.tzinfo:
            now = datetime.now(tz=event_end.tzinfo)
        else:
            now = datetime.now()

        is_expired = now >= event_end
        is_expired_for_display = now >= (event_end + timedelta(minutes=15))

        # -------------------------------------------------
        # datetime → ISO
        # -------------------------------------------------
        def _to_iso(dt: datetime) -> str:
            return dt.isoformat()

        return ReservationBookedViewDTO(
            reservation_id=ctx.reservation_id,
            reservation_status=reservation_status,
            context=ctx,
            event_start=_to_iso(event_start),
            confirmed_at=_to_iso(confirmed_at),
            is_expired=is_expired,
            is_expired_for_display=is_expired_for_display,
        )
