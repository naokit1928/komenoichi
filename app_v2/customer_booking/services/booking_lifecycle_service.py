from __future__ import annotations

from app_v2.customer_booking.repository.reservation_status_repo import (
    ReservationStatusRepository,
)


class Booking_Lifecycle_Service:
    """
    UI（ReservationBooked / CancelConfirm）起点の
    予約ライフサイクル操作専用 Service。

    ※ この Service が状態遷移の唯一の正
    """

    def __init__(self) -> None:
        self.repo = ReservationStatusRepository()

    # -------------------------------------------------
    # CANCEL
    # -------------------------------------------------
    def cancel(self, reservation_id: int) -> None:
        current_status = self.repo.get_current_status(reservation_id)
        if current_status is None:
            raise ValueError("RESERVATION_NOT_FOUND")

        if current_status == "cancelled":
            return  # 冪等

        # pending / confirmed → cancelled
        self.repo.update_status_cancelled(reservation_id)

    # -------------------------------------------------
    # CONFIRM
    # -------------------------------------------------
    def confirm(self, reservation_id: int) -> None:
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
