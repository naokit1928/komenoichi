from __future__ import annotations

from datetime import datetime, UTC
from typing import Any, Dict, Optional

from app_v2.notifications.services.line_notification_service import (
    LineNotificationService,
)
from app_v2.integrations.payments.stripe.reservation_status_repository import (
    ReservationStatusRepository,
)


class ReservationStatusService:
    """
    Reservation の状態遷移を一元管理する Service（最終形）

    責務：
      - payment 成功状態の反映
      - confirmed への遷移
      - consumer 紐づけ
      - notification 発火

    方針：
      - DB には直接触らない
      - Repository を唯一の DB 入口とする
    """

    def __init__(
        self,
        *,
        repo: Optional[ReservationStatusRepository] = None,
        notification_service: Optional[LineNotificationService] = None,
    ) -> None:
        self._repo = repo or ReservationStatusRepository()

        # Notification は副作用なので optional
        try:
            self._notification_service: Optional[
                LineNotificationService
            ] = notification_service or LineNotificationService()
            print("[ReservationStatusService] LineNotificationService initialized")
        except Exception as e:
            self._notification_service = None
            print(f"[ReservationStatusService] Notification init failed: {e}")

    # ==================================================
    # 状態遷移ロジック（正）
    # ==================================================

    def mark_payment_succeeded(
        self, *, reservation: Dict[str, Any], payment_intent_id: str
    ) -> None:
        conn = self._repo.open_connection()
        try:
            rid = int(reservation["reservation_id"])
            fields: Dict[str, Any] = {}

            if reservation.get("payment_intent_id") != payment_intent_id:
                fields["payment_intent_id"] = payment_intent_id

            if (reservation.get("payment_status") or "").lower() != "succeeded":
                fields["payment_status"] = "succeeded"

            if not reservation.get("paid_service_fee"):
                fields["paid_service_fee"] = 1

            if not reservation.get("payment_succeeded_at"):
                fields["payment_succeeded_at"] = datetime.now(UTC).isoformat()

            if fields:
                self._repo.update_reservation_fields(
                    conn,
                    reservation_id=rid,
                    **fields,
                )
        finally:
            conn.close()

    def ensure_confirmed(self, *, reservation: Dict[str, Any]) -> None:
        conn = self._repo.open_connection()
        try:
            rid = int(reservation["reservation_id"])
            current = (reservation.get("status") or "").lower()
            if current != "confirmed":
                self._repo.update_reservation_fields(
                    conn,
                    reservation_id=rid,
                    status="confirmed",
                )
        finally:
            conn.close()

    def attach_consumer_by_line_id(
        self, *, reservation_id: int, line_consumer_id: Optional[str]
    ) -> None:
        if not line_consumer_id:
            return

        conn = self._repo.open_connection()
        try:
            consumer = self._repo.fetch_consumer_by_line_id(
                conn, line_consumer_id
            )
            if consumer:
                self._repo.attach_consumer(
                    conn,
                    reservation_id=reservation_id,
                    consumer_id=int(consumer["consumer_id"]),
                )
        finally:
            conn.close()

    def notify(self, *, reservation_id: int) -> None:
        if not self._notification_service:
            return
        self._notification_service.schedule_for_reservation(reservation_id)
        self._notification_service.send_pending_jobs(limit=50, dry_run=False)

    # ==================================================
    # 複合ユースケース（Webhook 用）
    # ==================================================

    def handle_payment_succeeded(
        self,
        *,
        reservation: Dict[str, Any],
        payment_intent_id: str,
    ) -> None:
        """
        Stripe Webhook から呼ばれる正規フロー
        """
        self.mark_payment_succeeded(
            reservation=reservation,
            payment_intent_id=payment_intent_id,
        )
        self.ensure_confirmed(reservation=reservation)
        self.notify(reservation_id=int(reservation["reservation_id"]))
