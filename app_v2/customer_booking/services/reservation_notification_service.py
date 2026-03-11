from __future__ import annotations

import json
import logging
import os
from typing import Optional, Dict, Any

from app_v2.customer_booking.repository.reservation_notification_repo import (
    ReservationNotificationRepository,
)
from app_v2.customer_booking.services.reservation_expanded_service import (
    _generate_pickup_code,
)
from app_v2.integrations.email.postmark_client import (
    send_reservation_confirmed_email,
    send_reservation_cancelled_email,
    send_farmer_notification_email,
    send_farmer_cancelled_notification_email,
)

logger = logging.getLogger(__name__)

class ReservationNotificationService:
    """
    予約完了・キャンセル時の各種通知（消費者・農家）を管轄するサービス
    """
    def __init__(self, repo: Optional[ReservationNotificationRepository] = None):
        self._repo = repo or ReservationNotificationRepository()
        
        base = os.getenv("FRONTEND_URL") or os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
        self.frontend_base = base.rstrip("/")

    # =========================================================
    # 予約確定時の通知
    # =========================================================
    def send_booking_confirmed_notifications(self, reservation_id: int) -> None:
        conn = self._repo.open_connection()
        try:
            ctx = self._repo.fetch_notification_context(conn, reservation_id)
            if not ctx:
                logger.warning(f"Notification context not found for reservation {reservation_id}")
                return
                
            self._send_consumer_email(ctx)
            self._send_farmer_email(ctx)
        finally:
            conn.close()

    def _send_consumer_email(self, ctx: Dict[str, Any]) -> None:
        try:
            to_email = ctx.get("consumer_email")
            if not to_email:
                return

            res_id = ctx["reservation_id"]
            cons_id = ctx["consumer_id"]
            pickup_code = _generate_pickup_code(reservation_id=res_id, consumer_id=cons_id)
            
            map_url = self._build_map_url(ctx)

            model = {
                "pickup_datetime": ctx["pickup_display"],
                "pickup_place": ctx["pickup_place_name"],
                "google_maps_url": map_url,
                "total_price": f"{ctx['rice_subtotal']:,}",
                "reservation_code": pickup_code,
                "booked_page_url": f"{self.frontend_base}/reservation/booked"
            }
            
            send_reservation_confirmed_email(to_email=to_email, template_model=model)
            logger.info(f"Sent consumer notification to {to_email} for reservation {res_id}")
        except Exception as e:
            logger.error(f"Failed to send consumer email for reservation {ctx.get('reservation_id')}: {e}", exc_info=True)

    def _send_farmer_email(self, ctx: Dict[str, Any]) -> None:
        try:
            farm_email = ctx.get("farm_email")
            if not farm_email:
                return

            model = {
                "reservation_id": ctx["reservation_id"],
                "dashboard_url": f"{self.frontend_base}/farmer/reservations",
                "pickup_display": ctx.get("pickup_display", "未定"),
                "rice_subtotal": f"{ctx.get('rice_subtotal', 0):,}",
                "items_summary": self._build_items_summary(ctx.get("items_json"))
            }
            
            send_farmer_notification_email(to_email=farm_email, template_model=model)
            logger.info(f"Sent farmer notification to {farm_email} for reservation {ctx['reservation_id']}")
        except Exception as e:
            logger.error(f"Failed to send farmer email for reservation {ctx.get('reservation_id')}: {e}", exc_info=True)


    # =========================================================
    # 予約キャンセル時の通知 (★新規追加)
    # =========================================================
    def send_booking_cancelled_notifications(self, reservation_id: int) -> None:
        conn = self._repo.open_connection()
        try:
            ctx = self._repo.fetch_notification_context(conn, reservation_id)
            if not ctx:
                logger.warning(f"Notification context not found for cancelled reservation {reservation_id}")
                return
                
            self._send_consumer_cancel_email(ctx)
            self._send_farmer_cancel_email(ctx)
        finally:
            conn.close()

    def _send_consumer_cancel_email(self, ctx: Dict[str, Any]) -> None:
        try:
            to_email = ctx.get("consumer_email")
            if not to_email:
                return

            model = {
                "reservation_id": ctx["reservation_id"],
                "pickup_display": ctx.get("pickup_display", "未定"),
                "pickup_place_name": ctx.get("pickup_place_name"),
                "pickup_map_url": self._build_map_url(ctx),
                "items_summary": self._build_items_summary(ctx.get("items_json"), separator=" / "),
                "rice_subtotal": f"{ctx.get('rice_subtotal', 0):,}",
                "notice": "お米代のお支払いは発生しません。※システム利用料（300円）は返金対象外となります。",
                "home_url": self.frontend_base,
            }

            send_reservation_cancelled_email(to_email=to_email, template_model=model)
            logger.info(f"Sent consumer CANCEL notification to {to_email} for reservation {ctx['reservation_id']}")
        except Exception as e:
            logger.error(f"Failed to send consumer cancel email for reservation {ctx.get('reservation_id')}: {e}", exc_info=True)

    def _send_farmer_cancel_email(self, ctx: Dict[str, Any]) -> None:
        try:
            farm_email = ctx.get("farm_email")
            if not farm_email:
                return

            model = {
                "reservation_id": ctx["reservation_id"],
                "pickup_display": ctx.get("pickup_display", "未定"),
                "items_summary": self._build_items_summary(ctx.get("items_json")),
                "dashboard_url": f"{self.frontend_base}/farmer/reservations"
            }

            send_farmer_cancelled_notification_email(to_email=farm_email, template_model=model)
            logger.info(f"Sent farmer CANCEL notification to {farm_email} for reservation {ctx['reservation_id']}")
        except Exception as e:
            logger.error(f"Failed to send farmer cancel email for reservation {ctx.get('reservation_id')}: {e}", exc_info=True)

    # =========================================================
    # Helpers
    # =========================================================
    def _build_items_summary(self, items_json: str | None, separator: str = "\n") -> str:
        try:
            items = json.loads(items_json or "[]")
            lines = []
            for item in items:
                size = item.get("size_kg") or item.get("sizeKg")
                qty = item.get("quantity")
                lines.append(f"白米{size}kg × {qty}")
            return separator.join(lines)
        except Exception:
            return "（詳細はダッシュボードでご確認ください）"

    def _build_map_url(self, ctx: Dict[str, Any]) -> str:
        lat = ctx.get("pickup_lat")
        lng = ctx.get("pickup_lng")
        if lat is not None and lng is not None:
            return f"https://www.google.com/maps/search/?api=1&query={lat},{lng}"
        return ""