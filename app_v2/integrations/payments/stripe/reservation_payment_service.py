from __future__ import annotations

import logging
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

# ★ 新設した通知サービスをインポート（パスは実際の配置に合わせてください）
from app_v2.customer_booking.services.reservation_notification_service import (
    ReservationNotificationService,
)

logger = logging.getLogger(__name__)


class ReservationPaymentService:
    """
    Reservation の payment 結果を反映する Service（Stripe 配下・通知分離版）

    責務：
      - payment 成功状態の反映
      - 予約確定（confirmed）
      - 予約確定時の event_start_at / event_end_at の確定
      - ConfirmSession を consumed に遷移
      - ★ 予約確定メールの送信トリガー（外部Serviceへ完全委譲）
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
    # Webhook 用複合ユースケース（FSM準拠版）
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
        - ConfirmSession を consumed に遷移（FSM）
        - ★ 最後に通知処理（消費者・農家）をトリガー
        """

        # ① 支払い成功反映
        self.mark_payment_succeeded(
            reservation=reservation,
            payment_intent_id=payment_intent_id,
        )

        rid = int(reservation["reservation_id"])

        # ② event を確定
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

        # ④ ConfirmSession を consumed（FSM 準拠・idempotent）
        cs = reservation.get("confirm_session_id")
        if cs:
            now = datetime.now(UTC).isoformat()
            conn = self._repo.open_connection()
            try:
                conn.execute(
                    """
                    UPDATE confirm_sessions
                       SET status = 'consumed',
                           consumed_at = ?
                     WHERE confirm_session_id = ?
                       AND status = 'draft'
                    """,
                    (now, cs),
                )
                conn.commit()
            finally:
                conn.close()

        # ⑤ ★ NEW: 予約確定通知の送信 (通知専用Serviceに完全委譲 / Best Effort)
        try:
            notification_svc = ReservationNotificationService()
            notification_svc.send_booking_confirmed_notifications(rid)
        except Exception as e:
            # 通知に失敗しても決済完了処理自体は巻き戻さない（Webhookを落とさない）
            logger.error(f"Failed to trigger notifications for reservation {rid}: {e}", exc_info=True)