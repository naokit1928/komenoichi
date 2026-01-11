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
    Stripe Webhook Service（V2 最終形・LINE完全非依存）

    責務：
      - Stripe event を解釈する
      - 対象 reservation を特定する
      - ReservationPaymentService に状態遷移を委譲する

    方針：
      - DB には直接触らない
      - Repository を唯一の DB 入口とする
      - 再計算・fallback 一切なし
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
    # Internal helper
    # -------------------------------------------------
    def _load_reservation_from_event(
        self,
        conn,
        event: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        obj = event.get("data", {}).get("object", {})
        meta = obj.get("metadata") or {}

        # 優先① reservation_id（metadata）
        rid = meta.get("reservation_id")
        if rid:
            try:
                reservation = self._repo.fetch_reservation_by_id(
                    conn, int(rid)
                )
                if reservation:
                    return reservation
            except Exception:
                pass

        # 優先② payment_intent id
        pi_id = obj.get("id") or obj.get("payment_intent")
        if isinstance(pi_id, str):
            reservation = self._repo.fetch_reservation_by_payment_intent(
                conn, pi_id
            )
            if reservation:
                return reservation

        return None

    # -------------------------------------------------
    # Public entry
    # -------------------------------------------------
    def handle_event(self, event: Dict[str, Any]) -> None:
        """
        Stripe Webhook entry point

        対応イベント：
          - checkout.session.completed のみ

        ※ payment_intent.succeeded は使用しない
        """
        event_type = event.get("type")

        # 対応外イベントは即 return
        if event_type != "checkout.session.completed":
            return

        conn = self._repo.open_connection()
        try:
            session = event.get("data", {}).get("object", {})
            meta = session.get("metadata") or {}

            rid = meta.get("reservation_id")
            if not rid:
                return

            reservation = self._repo.fetch_reservation_by_id(
                conn, int(rid)
            )
            if not reservation:
                return

            pi_id = session.get("payment_intent")
            if not isinstance(pi_id, str):
                return

            # 状態遷移はすべて ReservationPaymentService に委譲
            self._status_service.handle_payment_succeeded(
                reservation=reservation,
                payment_intent_id=pi_id,
            )

        finally:
            conn.close()
