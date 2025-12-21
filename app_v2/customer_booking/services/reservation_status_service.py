# app_v2/customer_booking/services/reservation_status_service.py
from __future__ import annotations

from app_v2.customer_booking.repository.reservation_status_repo import (
    ReservationStatusRepository,
)


class ReservationStatusService:
    """
    Reservation の状態遷移を一元管理する Service

    責務:
    - 状態遷移ルールの定義
    - 冪等性の保証
    - 不正遷移の防止

    DB / SQL / トランザクションは Repository に委譲する。
    """

    def __init__(self) -> None:
        self.repo = ReservationStatusRepository()

    # -------------------------------------------------
    # CANCEL
    # -------------------------------------------------
    def cancel(self, reservation_id: int) -> None:
        """
        reservation を cancelled にする。

        - cancelled → 何もしない（冪等）
        - pending / confirmed → cancelled は許可
        """

        current_status = self.repo.get_current_status(reservation_id)
        if current_status is None:
            raise ValueError("RESERVATION_NOT_FOUND")

        if current_status == "cancelled":
            return  # 冪等

        # confirmed / pending → cancelled
        self.repo.update_status_cancelled(reservation_id)

    # -------------------------------------------------
    # CONFIRM
    # -------------------------------------------------
    def confirm(self, reservation_id: int) -> None:
        """
        reservation を confirmed にする。

        - confirmed → 何もしない（冪等）
        - pending → confirmed のみ許可
        - cancelled → 不可
        """

        current_status = self.repo.get_current_status(reservation_id)
        if current_status is None:
            raise ValueError("RESERVATION_NOT_FOUND")

        if current_status == "confirmed":
            return  # 冪等

        if current_status != "pending":
            raise ValueError(
                f"INVALID_STATUS_TRANSITION: {current_status}"
            )

        self.repo.update_status_confirmed(reservation_id)
