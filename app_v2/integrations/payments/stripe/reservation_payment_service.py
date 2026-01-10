from __future__ import annotations

from datetime import datetime, UTC
from typing import Any, Dict, Optional

from app_v2.integrations.payments.stripe.reservation_payment_repo import (
    ReservationPaymentRepository,
)



class ReservationPaymentService:

    """
    Reservation の payment 結果を反映する Service（Stripe 配下・通知非依存版）

    責務：
      - payment 成功状態の反映
      - confirmed への遷移

    方針：

      - DB 更新は Repository 経由のみ
    """

    def __init__(
        self,
        *,
        repo: Optional[ReservationPaymentRepository] = None,
    ) -> None:
        self._repo = repo or ReservationPaymentRepository()

    # ==================================================
    # 状態遷移ロジック
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
        Stripe Webhook から呼ばれる正規フロー（通知なし）
        """
        self.mark_payment_succeeded(
            reservation=reservation,
            payment_intent_id=payment_intent_id,
        )
        self.ensure_confirmed(reservation=reservation)
