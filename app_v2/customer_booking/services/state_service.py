from __future__ import annotations

import time
from typing import Any, Dict, Optional

from app_v2.customer_booking.repository.state_repo import StateRepository
from app_v2.customer_booking.repository.latest_reservation_repo import (
    LatestReservationRepository,
)
from app_v2.customer_booking.services.reservation_booked_service import (
    ReservationBookedService,
)

class StateService:
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
                "penalty": {"status": "none", "no_show_count": 0, "cancel_count": 0},
                "pending": {"exists": False, "reservation_id": None, "farm_id": None},
                "active": {"exists": False, "reservation_id": None, "farm_id": None},
            }

        # ペナルティステータスの判定
        penalty_info = self._repo.fetch_penalty_info(consumer_id=consumer_id)
        ns_count = penalty_info["no_show_count"]
        pardon_timestamp = penalty_info["no_show_pardon"]
        cancel_count = penalty_info.get("cancel_count", 0)

        penalty_status = "none"
        
        # ★ 追加: 1年以内のキャンセルが4回以上、または無断キャンセルが3回以上の場合は完全BAN
        if ns_count >= 3 or cancel_count >= 4:
            penalty_status = "banned"   
        elif ns_count == 2:
            if pardon_timestamp == 0:
                penalty_status = "locked_requestable"
            else:
                if int(time.time()) < pardon_timestamp + 259200:
                    penalty_status = "locked_cooling"
                else:
                    penalty_status = "none"

        # 既存ロジック（PENDING）
        pending = self._repo.fetch_pending_reservation(consumer_id=consumer_id)

        # 既存ロジック（ACTIVE）
        active_payload = {"exists": False, "reservation_id": None, "farm_id": None}
        candidate_id = self._latest_repo.get_latest_confirmed_reservation_id(
            consumer_id=consumer_id
        )

        if candidate_id is not None:
            view = self._booked_service.get_view_for_reservation(candidate_id)
            if view is not None and (not view.is_expired_for_display):
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
                "no_show_count": ns_count,
                "cancel_count": cancel_count # フロントエンドに渡す
            },
            "pending": {
                "exists": bool(pending),
                "reservation_id": int(pending["reservation_id"]) if pending else None,
                "farm_id": int(pending["farm_id"]) if pending else None,
            },
            "active": active_payload,
        }

    def pardon_penalty(self, consumer_id: int) -> None:
        self._repo.update_pardon_flag(consumer_id, int(time.time()))