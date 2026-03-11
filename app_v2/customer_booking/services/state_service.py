from __future__ import annotations

from typing import Any, Dict, Optional

from app_v2.customer_booking.repository.state_repo import StateRepository

# 既存の「正」を使う（State で再実装しない）
from app_v2.customer_booking.repository.latest_reservation_repo import (
    LatestReservationRepository,
)
from app_v2.customer_booking.services.reservation_booked_service import (
    ReservationBookedService,
)


class StateService:
    """
    Consumer の現在の予約状態をまとめて返す Service（長期安定版）

    責務:
      - 未ログイン/ログインの切り替え
      - pending の事実取得（reservations の PENDING）
      - active は「既存の正」に委譲して判定する
        - 候補: LatestReservationRepository（Stripe 二重予約ガード用）
        - 表示有効性: ReservationBookedService（is_expired_for_display）
      - State 自体で "active 判定" を再実装しない
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

    # ==================================================
    # Public API
    # ==================================================
    def get_state(self, *, consumer_id: Optional[int]) -> Dict[str, Any]:
        """
        返却仕様（安定版）:
        {
          is_logged_in: bool,
          pending: { exists, reservation_id, farm_id },
          active:  { exists, reservation_id, farm_id }
        }
        """

        # -----------------------------
        # 未ログイン
        # -----------------------------
        if not consumer_id:
            return {
                "is_logged_in": False,
                "pending": {"exists": False, "reservation_id": None, "farm_id": None},
                "active": {"exists": False, "reservation_id": None, "farm_id": None},
            }

        # -----------------------------
        # PENDING（Confirm表示用ドラフト）
        # -----------------------------
        pending = self._repo.fetch_pending_reservation(consumer_id=consumer_id)

        # -----------------------------
        # ACTIVE（既存の正に委譲）
        #   1) Stripe 二重予約ガードの定義で「候補 reservation_id」を取る
        #   2) booked_service で view を作り、表示上 expired なら active ではない
        #   3) farm_id は DB 事実から取る
        # -----------------------------
        active_payload = {"exists": False, "reservation_id": None, "farm_id": None}

        candidate_id = self._latest_repo.get_latest_confirmed_reservation_id(
            consumer_id=consumer_id
        )

        if candidate_id is not None:
            view = self._booked_service.get_view_for_reservation(candidate_id)

            # view が取れない＝表示できない confirmed（event_*不足など）
            # 長期安定のため、ここは "active扱いしない" で統一する
            if view is not None and (not view.is_expired_for_display):
                basic = self._repo.fetch_reservation_basic(reservation_id=candidate_id)
                if basic and basic.get("farm_id") is not None:
                    active_payload = {
                        "exists": True,
                        "reservation_id": int(candidate_id),
                        "farm_id": int(basic["farm_id"]),
                    }

        # -----------------------------
        # 返却
        # -----------------------------
        return {
            "is_logged_in": True,
            "pending": {
                "exists": bool(pending),
                "reservation_id": int(pending["reservation_id"]) if pending else None,
                "farm_id": int(pending["farm_id"]) if pending else None,
            },
            "active": active_payload,
        }
