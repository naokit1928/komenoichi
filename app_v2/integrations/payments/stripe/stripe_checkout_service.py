from __future__ import annotations

from datetime import datetime, UTC
from typing import Any, Dict, Optional

from app_v2.integrations.payments.stripe.stripe_client import (
    create_checkout_session,
)
from app_v2.integrations.payments.stripe.stripe_checkout_repository import (
    StripeCheckoutRepository,
)
from app_v2.auth_consumer.magic.repository import MagicLinkRepository

TERM_SERVICE_NAME = "運営サポート費（予約確定・当日運営の固定費）"


class StripeCheckoutService:
    """
    Stripe Checkout に関する業務ロジック（V2 完成形）

    責務：
      - Checkout Session 作成
      - 予約状態の妥当性チェック
      - success / cancel URL の構築
      - Repository / Stripe Client のオーケストレーション
    """

    def __init__(
        self,
        *,
        repo: Optional[StripeCheckoutRepository] = None,
        magic_repo: Optional[MagicLinkRepository] = None,
    ) -> None:
        self._repo = repo or StripeCheckoutRepository()
        self._magic_repo = magic_repo or MagicLinkRepository()

    # ==================================================
    # Public API
    # ==================================================
    def create_checkout_session(
        self,
        *,
        reservation_id: int,
        frontend_origin: str,
        consumer_email: Optional[str] = None,
    ) -> Dict[str, Any]:
        conn = self._repo.open_connection()
        try:
            # ------------------------------
            # reservation 取得
            # ------------------------------
            reservation = self._repo.fetch_reservation_by_id(
                conn, reservation_id
            )
            if reservation is None:
                raise LookupError("Reservation not found")

            if bool(reservation.get("paid_service_fee")):
                raise ValueError(
                    "Service fee already paid for this reservation."
                )

            # ------------------------------
            # email 取得
            # - ログイン済み直行Checkout: consumer_email を優先
            # - 未ログイン（magic link 起点）: magic_link_tokens から取得
            # ------------------------------
            if not consumer_email:
                consumer_email = self._magic_repo.get_email_by_reservation_id(
                    reservation_id
                )

            if not consumer_email:
                raise LookupError(
                    "Consumer email not found for this reservation."
                )

            service_fee_amount_jpy = 300

            # ------------------------------
            # URL 構築
            # ------------------------------
            frontend_base = frontend_origin.rstrip("/")

            success_url = f"{frontend_base}/payment_success"
            cancel_url = (
                f"{frontend_base}/farms/{reservation.get('farm_id')}/confirm"
            )

            # ------------------------------
            # Stripe Checkout 作成
            # ------------------------------
            checkout_session = create_checkout_session(
                reservation_id=reservation["reservation_id"],
                farm_id=reservation.get("farm_id"),
                service_fee_amount_jpy=service_fee_amount_jpy,
                term_service_name=TERM_SERVICE_NAME,
                success_url=success_url,
                cancel_url=cancel_url,
                consumer_email=consumer_email,
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
