from __future__ import annotations

import os
from datetime import datetime, UTC
from typing import Any, Dict, Optional

from dotenv import load_dotenv

from app_v2.integrations.payments.stripe.stripe_client import (
    create_checkout_session,
)
from app_v2.integrations.payments.stripe.stripe_checkout_repository import (
    StripeCheckoutRepository,
)

# ------------------------------------------------------------
# Env
# ------------------------------------------------------------
load_dotenv()

FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
TERM_SERVICE_NAME = "運営サポート費（予約確定・当日運営の固定費）"


class StripeCheckoutService:
    """
    Stripe Checkout に関する業務ロジック（V2 最終形）

    責務：
      - Checkout Session 作成
      - 予約状態の妥当性チェック
      - Repository / Stripe Client のオーケストレーション

    方針：
      - DB には直接触らない
      - DB パス・sqlite3 を一切知らない
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
    def create_checkout_session(self, reservation_id: int) -> Dict[str, Any]:
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

            checkout_session = create_checkout_session(
                reservation_id=reservation["reservation_id"],
                farm_id=reservation.get("farm_id"),
                service_fee_amount_jpy=service_fee_amount_jpy,
                term_service_name=TERM_SERVICE_NAME,
                frontend_base_url=FRONTEND_BASE_URL,
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
