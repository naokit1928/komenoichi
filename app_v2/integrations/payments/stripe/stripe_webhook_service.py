from __future__ import annotations

from typing import Any, Dict, Optional

from app_v2.integrations.payments.stripe.reservation_payment_service import (
    ReservationPaymentService,
)
from app_v2.integrations.payments.stripe.stripe_webhook_repository import (
    StripeWebhookRepository,
)


class StripeWebhookService:
    """
    Stripe Webhook Service（cs 固定版）

    方針：
      - Stripe metadata.confirm_session_id を唯一の参照キーとする
      - reservation_id / payment_intent fallback は使わない
    """

    def __init__(
        self,
        *,
        repo: Optional[StripeWebhookRepository] = None,
        status_service: Optional[ReservationPaymentService] = None,
    ) -> None:
        self._repo = repo or StripeWebhookRepository()
        self._status_service = status_service or ReservationPaymentService()

    # -------------------------------------------------
    # Public entry
    # -------------------------------------------------
    def handle_event(self, event: Dict[str, Any]) -> None:
        """
        対応イベント：
          - checkout.session.completed のみ
        """
        event_type = event.get("type")
        if event_type != "checkout.session.completed":
            return

        session = event.get("data", {}).get("object", {})
        meta = session.get("metadata") or {}

        # ★ confirm_session_id を必須にする
        cs = meta.get("confirm_session_id")
        if not cs:
            return

        pi_id = session.get("payment_intent")
        if not isinstance(pi_id, str):
            return

        conn = self._repo.open_connection()
        try:
            # ★ この ConfirmSession の PENDING を取得
            reservation = self._repo.fetch_pending_by_confirm_session(
                conn, cs
            )
            if not reservation:
                return

            # 状態遷移は Service に委譲
            self._status_service.handle_payment_succeeded(
                reservation=reservation,
                payment_intent_id=pi_id,
            )

        finally:
            conn.close()
