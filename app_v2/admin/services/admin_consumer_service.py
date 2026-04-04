from __future__ import annotations

from typing import Any, Dict, Optional

from app_v2.admin.repository.admin_consumer_repo import AdminConsumerRepository
from app_v2.customer_booking.repository.state_repo import StateRepository


class AdminConsumerService:
    def __init__(self):
        self.repo = AdminConsumerRepository()
        self.state_repo = StateRepository()

    def search_penalty_info(
        self,
        email: Optional[str],
        reservation_id: Optional[int],
    ) -> Dict[str, Any]:
        consumer = None
        if reservation_id:
            consumer = self.repo.find_consumer_by_reservation_id(reservation_id)
            if consumer and "_error" in consumer:
                return consumer
        elif email:
            consumer = self.repo.find_consumer_by_email(email)
            if not consumer:
                return {"_error": "EMAIL_NOT_FOUND"}

        if not consumer:
            return {"_error": "NOT_FOUND"}

        consumer_id = consumer["consumer_id"]

        # ペナルティカウント（state_repo の統一ロジックを再利用）
        penalty_info = self.state_repo.fetch_penalty_info(consumer_id)
        penalty_count    = penalty_info["penalty_count"]
        no_show_count    = penalty_info["no_show_count"]
        late_cancel_count = penalty_info["late_cancel_count"]

        # 状態は banned / none の2種類のみ
        penalty_status = "banned" if penalty_count >= 3 else "none"

        # フラグ履歴（no_show + is_late_cancel のみ）
        history = self.repo.get_penalty_history(consumer_id)

        return {
            "consumer_id":       consumer_id,
            "email":             consumer.get("email", "不明"),
            "penalty_status":    penalty_status,
            "penalty_count":     penalty_count,
            "no_show_count":     no_show_count,
            "late_cancel_count": late_cancel_count,
            "history":           history,
        }

    def revert_reservation_status(self, reservation_id: int, new_status: str) -> None:
        """no_show → confirmed など、ステータスを強制変更する（案A）"""
        self.repo.update_reservation_status(reservation_id, new_status)

    def clear_late_cancel_flag(self, reservation_id: int) -> None:
        """遅延キャンセルフラグを解除する（案A）"""
        self.repo.clear_late_cancel_flag(reservation_id)