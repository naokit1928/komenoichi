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
      
    """

    def __init__(
        self,
        *,
        repo: Optional[StripeWebhookRepository] = None,
        status_service: Optional[ReservationPaymentService] = None,
    ) -> None:
        self._repo = repo or StripeWebhookRepository()
        self._status_service = status_service or ReservationPaymentService()

    # -------------------------
    # Internal helper
    # -------------------------
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

    # -------------------------
    # Public entry
    # -------------------------
    def handle_event(self, event: Dict[str, Any]) -> None:
        event_type = event.get("type")

        conn = self._repo.open_connection()
        try:
            # -----------------------------
            # payment_intent.succeeded
            # -----------------------------
            if event_type == "payment_intent.succeeded":
                reservation = self._load_reservation_from_event(conn, event)
                if not reservation:
                    return

                pi_id = event["data"]["object"].get("id")
                if isinstance(pi_id, str):
                    self._status_service.handle_payment_succeeded(
                        reservation=reservation,
                        payment_intent_id=pi_id,
                    )

            # -----------------------------
            # checkout.session.completed
            # -----------------------------
            elif event_type == "checkout.session.completed":
                session = event["data"]["object"]
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
                if isinstance(pi_id, str):
                    self._status_service.handle_payment_succeeded(
                        reservation=reservation,
                        payment_intent_id=pi_id,
                    )

            # それ以外のイベントは無視
        finally:
            conn.close()
