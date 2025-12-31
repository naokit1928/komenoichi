# app_v2/integrations/payments/stripe/stripe_checkout_service.py

from __future__ import annotations

from datetime import datetime, UTC
from typing import Any, Dict, Optional

from app_v2.integrations.payments.stripe.stripe_client import (
    create_checkout_session,
)
from app_v2.integrations.payments.stripe.stripe_checkout_repository import (
    StripeCheckoutRepository,
)

TERM_SERVICE_NAME = "運営サポート費（予約確定・当日運営の固定費）"


class StripeCheckoutService:
    """
    Stripe Checkout に関する業務ロジック（V2 完成形）

    責務：
      - Checkout Session 作成
      - 予約状態の妥当性チェック
      - success / cancel URL の構築
      - Repository / Stripe Client のオーケストレーション

    方針：
      - DB には直接触らない
      - URL は env に依存しない
      - 呼び出し元から渡された origin を唯一の正とする
    """

    def __init__(
        self,
        *,
        repo: Optional[StripeCheckoutRepository] = None,
    ) -> None:
        self._repo = repo or StripeCheckoutRepository()

    # ==================================================
    # Public API
    # ==================================================
    def create_checkout_session(
        self,
        *,
        reservation_id: int,
        frontend_origin: str,
    ) -> Dict[str, Any]:
        conn = self._repo.open_connection()
        try:
            reservation = self._repo.fetch_reservation_by_id(
                conn, reservation_id
            )
            if reservation is None:
                raise LookupError("Reservation not found")

            if bool(reservation.get("paid_service_fee")):
                raise ValueError(
                    "Service fee already paid for this reservation."
                )

            service_fee_amount_jpy = 300

            # ------------------------------
            # URL 構築（ここが唯一の正）
            # ------------------------------
            frontend_base = frontend_origin.rstrip("/")

            success_url = f"{frontend_base}/payment_success"
            cancel_url = (
                f"{frontend_base}/farms/{reservation.get('farm_id')}/confirm"
            )

            checkout_session = create_checkout_session(
                reservation_id=reservation["reservation_id"],
                farm_id=reservation.get("farm_id"),
                service_fee_amount_jpy=service_fee_amount_jpy,
                term_service_name=TERM_SERVICE_NAME,
                success_url=success_url,
                cancel_url=cancel_url,
            )

            pi_id = checkout_session.get("payment_intent")

            updated = self._repo.update_checkout_created(
                conn,
                reservation_id=reservation_id,
                payment_intent_id=pi_id if isinstance(pi_id, str) else None,
            )

            return {
                "reservation_id": updated["reservation_id"],
                "checkout_url": checkout_session.url,
                "payment_intent_id": updated.get("payment_intent_id"),
                "status": updated.get("payment_status"),
                "timestamp": datetime.now(UTC).isoformat(),
            }
        finally:
            conn.close()
