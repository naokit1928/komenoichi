from __future__ import annotations

from datetime import datetime, UTC
from typing import Any, Dict, Optional

from app_v2.integrations.payments.stripe.reservation_payment_repo import (
    ReservationPaymentRepository,
)
from app_v2.customer_booking.repository.reservation_status_repo import (
    ReservationStatusRepository,
)
from app_v2.customer_booking.services.reservation_expanded_service import (
    _calc_event_for_booking,
)


class ReservationPaymentService:
    """
    Reservation の payment 結果を反映する Service（Stripe 配下・通知非依存版）

    責務：
      - payment 成功状態の反映
      - 予約確定（confirmed）
      - 予約確定時の event_start_at / event_end_at の確定
    """

    def __init__(
        self,
        *,
        repo: Optional[ReservationPaymentRepository] = None,
    ) -> None:
        self._repo = repo or ReservationPaymentRepository()
        self._status_repo = ReservationStatusRepository()

    # ==================================================
    # 支払い成功の反映
    # ==================================================

    def mark_payment_succeeded(
        self,
        *,
        reservation: Dict[str, Any],
        payment_intent_id: str,
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

    # ==================================================
    # Webhook 用複合ユースケース（確定版）
    # ==================================================

    def handle_payment_succeeded(
        self,
        *,
        reservation: Dict[str, Any],
        payment_intent_id: str,
    ) -> None:
        """
        Stripe Webhook から呼ばれる正規フロー

        - 支払い成功の反映
        - event_start_at / event_end_at の確定
        - confirmed への遷移（event と同時）
        """

        # ① 支払い成功反映
        self.mark_payment_succeeded(
            reservation=reservation,
            payment_intent_id=payment_intent_id,
        )

        rid = int(reservation["reservation_id"])

        # ② event を確定（status は見ない）
        created_at, pickup_slot_code = self._status_repo.get_event_calc_source(
            reservation_id=rid
        )

        event_start_at, event_end_at = _calc_event_for_booking(
            created_at,
            pickup_slot_code,
        )

        # ③ confirmed + event_* を同時に確定
        self._status_repo.update_confirmed_with_event(
            reservation_id=rid,
            event_start_at=event_start_at,
            event_end_at=event_end_at,
        )
