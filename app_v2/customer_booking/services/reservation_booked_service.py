# app_v2/customer_booking/services/reservation_booked_service.py

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from pydantic import BaseModel

from app_v2.notifications.dtos import NotificationContextDTO
from app_v2.notifications.services.line_notification_service import (
    LineNotificationService,
)
from app_v2.notifications.services.line_message_builder import LineMessageBuilder
from app_v2.customer_booking.repository import reservation_repo  # 既存のまま利用


class ReservationBookedViewDTO(BaseModel):
    """
    予約確認ページ（予約済み一覧 → 1件を開いた画面）で使う DTO。

    - NotificationContextDTO（pickup_display など通知ドメインと同じ）
    - reservation_status: "confirmed" / "cancelled" など
    - is_expired: 受け渡し終了時刻を過ぎているか（ロジック用）
    - is_expired_for_display: 受け渡し終了 +15分 を過ぎているか（UI 用）
    """

    reservation_id: int
    reservation_status: Optional[str] = None

    context: NotificationContextDTO

    
    cancel_template_json: Dict[str, Any]


    event_start: str
    confirmed_at: str

    is_expired: bool = False
    is_expired_for_display: bool = False


class ReservationBookedService:
    """
    ReservationBookedPage 専用 Service。

    - NotificationContextDTO の生成
    - event_start / event_end / confirmed_at の取得

    ※ SQL やロジックは NotificationDomain の private メソッドを再利用し、
       新規の重複ロジックを絶対に作らない。
    """

    def __init__(self, notification_service: Optional[LineNotificationService] = None) -> None:
        self._notification_service = notification_service or LineNotificationService()

    def get_view_for_reservation(self, reservation_id: int) -> Optional[ReservationBookedViewDTO]:
        """
        reservation_id を受け取り、ReservationBookedPage 用の DTO を返す。
        該当予約 / ユーザー / 農家が存在しない場合は None を返す。
        """

        # ---- DB 接続 ----
        conn = self._notification_service._open_connection()
        try:
            # reservations / users をまとめて取得
            reservation, user = self._notification_service._fetch_reservation_and_user(
                conn, reservation_id
            )
            if not reservation or not user:
                print(
                    f"[ReservationBookedService] reservation or user not found "
                    f"(reservation_id={reservation_id})"
                )
                return None

            line_user_id = (user.get("line_user_id") or "").strip()

            # 農家情報
            farm = self._notification_service._fetch_farm(conn, reservation.get("farm_id"))
            if not farm:
                print(
                    f"[ReservationBookedService] farm not found "
                    f"(farm_id={reservation.get('farm_id')})"
                )
                return None

            # NotificationContextDTO + event_start + event_end + confirmed_at を一度で生成
            ctx, event_start, event_end, confirmed_at = self._notification_service._build_context(
                reservation=reservation,
                user=user,
                farm=farm,
                line_user_id=line_user_id,
            )

        finally:
            conn.close()

        # ---- reservations テーブルのステータスを取得 ----
        reservation_row = reservation_repo.get_reservation_by_id(reservation_id)
        if reservation_row is not None:
            reservation_status: Optional[str] = reservation_row.get("status")  # type: ignore[assignment]
        else:
            reservation_status = None

        # ---- is_expired / is_expired_for_display の計算 ----
        # event_end は _build_context が完全に返す
        if event_end.tzinfo:
            now = datetime.now(tz=event_end.tzinfo)
        else:
            now = datetime.now()

        is_expired = now >= event_end
        is_expired_for_display = now >= (event_end + timedelta(minutes=15))

        

        # ---- 2通目：キャンセル案内 TemplateMessage(dict) ----
        cancel_template_dict = LineMessageBuilder.build_cancel_template(ctx)

        

        # ---- datetime → ISO ----
        def _to_iso(dt: datetime) -> str:
            return dt.isoformat()

        # ---- DTO 返却 ----
        return ReservationBookedViewDTO(
            reservation_id=ctx.reservation_id,
            reservation_status=reservation_status,
            context=ctx,
            cancel_template_json=cancel_template_dict,
            event_start=_to_iso(event_start),
            confirmed_at=_to_iso(confirmed_at),
            is_expired=is_expired,
            is_expired_for_display=is_expired_for_display,
        )
