from __future__ import annotations

from typing import Any, Dict, Optional

from app_v2.customer_booking.repository.state_repo import StateRepository
from app_v2.customer_booking.repository.latest_reservation_repo import (
    LatestReservationRepository,
)
from app_v2.customer_booking.services.reservation_booked_service import (
    ReservationBookedService,
)


class StateService:
    """
    ペナルティ仕様（統一シンプル版）

    カウント対象（過去1年間・ローリング）:
      - no_show    : 農家から無断キャンセルとして報告された予約
      - late_cancel: 受け渡し3時間以内にユーザー自身がキャンセルした予約

    ペナルティ状態:
      penalty_count >= 3 → "banned"（予約完全ブロック）
      それ以外           → "none"（正常）

    locked_requestable / locked_cooling / pardon は廃止。
    """

    def __init__(
        self,
        *,
        repo: Optional[StateRepository] = None,
        latest_repo: Optional[LatestReservationRepository] = None,
        booked_service: Optional[ReservationBookedService] = None,
    ) -> None:
        self._repo = repo or StateRepository()
        self._latest_repo = latest_repo or LatestReservationRepository()
        self._booked_service = booked_service or ReservationBookedService()

    def get_state(self, *, consumer_id: Optional[int]) -> Dict[str, Any]:
        if not consumer_id:
            return {
                "is_logged_in": False,
                "penalty": {"status": "none", "penalty_count": 0},
                "pending": {"exists": False, "reservation_id": None, "farm_id": None},
                "active": {"exists": False, "reservation_id": None, "farm_id": None},
            }

        penalty_info = self._repo.fetch_penalty_info(consumer_id=consumer_id)
        penalty_count = penalty_info["penalty_count"]
        penalty_status = "banned" if penalty_count >= 3 else "none"

        pending = self._repo.fetch_pending_reservation(consumer_id=consumer_id)

        active_payload: Dict[str, Any] = {
            "exists": False,
            "reservation_id": None,
            "farm_id": None,
        }
        candidate_id = self._latest_repo.get_latest_confirmed_reservation_id(
            consumer_id=consumer_id
        )
        if candidate_id is not None:
            view = self._booked_service.get_view_for_reservation(candidate_id)
            if view is not None and not view.is_expired_for_display:
                basic = self._repo.fetch_reservation_basic(reservation_id=candidate_id)
                if basic and basic.get("farm_id") is not None:
                    active_payload = {
                        "exists": True,
                        "reservation_id": int(candidate_id),
                        "farm_id": int(basic["farm_id"]),
                    }

        return {
            "is_logged_in": True,
            "penalty": {
                "status": penalty_status,
                "penalty_count": penalty_count,
            },
            "pending": {
                "exists": bool(pending),
                "reservation_id": int(pending["reservation_id"]) if pending else None,
                "farm_id": int(pending["farm_id"]) if pending else None,
            },
            "active": active_payload,
        }