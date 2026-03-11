from __future__ import annotations
from datetime import datetime, UTC
from typing import Any, Dict, Optional

from app_v2.integrations.payments.stripe.stripe_client import (
    create_checkout_session,
    find_checkout_session_by_payment_intent,
)
from app_v2.integrations.payments.stripe.stripe_checkout_repository import (
    StripeCheckoutRepository,
)
from app_v2.auth_consumer.magic.repository import MagicLinkRepository

TERM_SERVICE_NAME = "プラットフォーム利用料"


class StripeCheckoutService:
    """
    ConfirmSession(cs) を Stripe に焼き付ける決済レイヤ

    cs冪等（補助条文B/C）：
      - 同一 cs の Checkout を何回叩いても「決済対象が増えない」
      - Stripe開始済（payment_intent_id がある）なら再生成禁止で必ず再利用
    """

    def __init__(
        self,
        *,
        repo: Optional[StripeCheckoutRepository] = None,
        magic_repo: Optional[MagicLinkRepository] = None,
    ) -> None:
        self._repo = repo or StripeCheckoutRepository()
        self._magic_repo = magic_repo or MagicLinkRepository()

    def create_checkout_session(
        self,
        *,
        reservation_id: int,
        frontend_origin: str,
        consumer_email: Optional[str] = None,
        confirm_session_id: Optional[str] = None,
    ) -> Dict[str, Any]:

        if not confirm_session_id:
            raise ValueError("confirm_session_id is required")

        conn = self._repo.open_connection()
        try:
            reservation = self._repo.fetch_reservation_by_id(conn, reservation_id)
            if reservation is None:
                raise LookupError("Reservation not found")

            if bool(reservation.get("paid_service_fee")):
                raise ValueError("Service fee already paid")

            # email（from-confirm から渡される想定。無ければ予約から辿る）
            if not consumer_email:
                consumer_email = self._magic_repo.get_email_by_reservation_id(
                    reservation_id
                )
            if not consumer_email:
                raise LookupError("Consumer email not found")

            service_fee_amount_jpy = 300

            base = frontend_origin.rstrip("/")
            success_url = f"{base}/payment_success?cs={confirm_session_id}"
            cancel_url = (
                f"{base}/farms/{reservation['farm_id']}/confirm?cs={confirm_session_id}"
            )

            # =========================================================
            # 重要：Stripe開始済なら「再生成禁止」→ 既存Checkoutを再利用
            # =========================================================
            existing_pi = reservation.get("payment_intent_id")
            if isinstance(existing_pi, str) and existing_pi.strip():
                existing = find_checkout_session_by_payment_intent(
                    payment_intent_id=existing_pi
                )
                if existing and getattr(existing, "url", None):
                    return {
                        "reservation_id": reservation["reservation_id"],
                        "checkout_url": existing.url,
                        "payment_intent_id": existing_pi,
                        "status": reservation.get("payment_status") or "checkout_created",
                        "timestamp": datetime.now(UTC).isoformat(),
                        "reused": True,
                    }

                # 既存PIがあるのにCheckout Sessionが見つからない場合、
                # ここで新規作成すると二重決済を誘発し得るため「安全側に倒す」。
                raise ValueError(
                    "Checkout already started for this reservation, but active session was not found"
                )

            # =========================================================
            # Stripe未開始：cs冪等キーでCheckout作成（再実行でも同一に収束）
            # =========================================================
            idem_key = f"checkout_session:cs:{confirm_session_id}"

            checkout_session = create_checkout_session(
                reservation_id=reservation["reservation_id"],
                farm_id=reservation["farm_id"],
                service_fee_amount_jpy=service_fee_amount_jpy,
                term_service_name=TERM_SERVICE_NAME,
                success_url=success_url,
                cancel_url=cancel_url,
                consumer_email=consumer_email,
                confirm_session_id=confirm_session_id,  # ← Stripe側の唯一キー
                idempotency_key=idem_key,
            )

            pi_id = checkout_session.get("payment_intent")
            pi_str = pi_id if isinstance(pi_id, str) else None

            updated = self._repo.update_checkout_created(
                conn,
                reservation_id=reservation_id,
                payment_intent_id=pi_str,
            )

            return {
                "reservation_id": updated["reservation_id"],
                "checkout_url": checkout_session.url,
                "payment_intent_id": updated.get("payment_intent_id"),
                "status": updated.get("payment_status"),
                "timestamp": datetime.now(UTC).isoformat(),
                "reused": False,
            }

        finally:
            conn.close()
