from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException

from app_v2.customer_booking.dtos import (
    ReservationFormDTO,
    ReservationResultDTO,
)

from app_v2.customer_booking.utils.pickup_time_utils import (
    JST,
    compute_next_pickup,
)

from app_v2.customer_booking.repository.confirm_repo import (
    create_pending_reservation,
)


# ============================================================
# Service
# ============================================================

class ConfirmService:
    """
    ConfirmPage 用 Service（V2 / orchestration 専用）

    責務:
    - クライアント / サーバ締切の最終検証
    - confirm_repo による pending reservation 作成

    ※ 状態遷移（confirmed / cancelled）は一切行わない
    ※ confirmed は Stripe / Booking_Lifecycle_Service の責務
    """

    SERVICE_FEE = 300
    CURRENCY = "jpy"

    def __init__(self) -> None:
        pass

    # --------------------------------------------------------
    # Public API
    # --------------------------------------------------------

    def create_pending_reservation(
        self,
        payload: ReservationFormDTO,
    ) -> ReservationResultDTO:

        now = self._now_jst()

        # --- クライアント側締切（Detail → Confirm 遷移保護） ---
        self._check_client_deadline(
            now=now,
            client_deadline_iso=payload.client_next_pickup_deadline_iso,
        )

        # --- サーバ側締切（最終安全装置） ---
        self._check_server_deadline(
            now=now,
            pickup_slot_code=payload.pickup_slot_code,
        )

        # --- pending reservation 作成（永続化は repo に完全委譲） ---
        result = create_pending_reservation(
            farm_id=payload.farm_id,
            pickup_slot_code=payload.pickup_slot_code,
            items=payload.items,
            service_fee=self.SERVICE_FEE,
            currency=self.CURRENCY,
        )

        # ★ ここでは状態遷移しない（pending のまま）

        return result

    # ========================================================
    # Internal helpers（業務ルールのみ）
    # ========================================================

    def _now_jst(self) -> datetime:
        return datetime.now(JST)

    # --------------------------------------------------------
    # Deadline checks
    # --------------------------------------------------------

    def _check_client_deadline(
        self,
        *,
        now: datetime,
        client_deadline_iso: str | None,
    ) -> None:
        if not client_deadline_iso:
            return

        try:
            client_deadline = datetime.fromisoformat(client_deadline_iso)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid client_next_pickup_deadline_iso format",
            )

        if client_deadline.tzinfo is None:
            client_deadline = client_deadline.replace(tzinfo=JST)
        else:
            client_deadline = client_deadline.astimezone(JST)

        if now >= client_deadline:
            raise HTTPException(
                status_code=409,
                detail="この予約画面の有効期限が切れました。",
            )

    def _check_server_deadline(
        self,
        *,
        now: datetime,
        pickup_slot_code: str,
    ) -> None:
        if not pickup_slot_code or not pickup_slot_code.strip():
            raise HTTPException(
                status_code=400,
                detail="pickup_slot_code is required",
            )

        _start_dt, deadline_dt = compute_next_pickup(
            now,
            pickup_slot_code.strip(),
        )

        if now >= deadline_dt:
            raise HTTPException(
                status_code=409,
                detail="今週分の予約受付は締め切りました。",
            )
