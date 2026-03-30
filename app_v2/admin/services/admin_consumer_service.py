from __future__ import annotations

import time
from typing import Any, Dict, Optional

from app_v2.admin.repository.admin_consumer_repo import AdminConsumerRepository
from app_v2.customer_booking.repository.state_repo import StateRepository

class AdminConsumerService:
    def __init__(self):
        self.repo = AdminConsumerRepository()
        self.state_repo = StateRepository()

    def search_penalty_info(self, email: Optional[str], reservation_id: Optional[int]) -> Dict[str, Any]:
        consumer = None
        if reservation_id:
            consumer = self.repo.find_consumer_by_reservation_id(reservation_id)
            if consumer and "_error" in consumer:
                return consumer  # エラー詳細をそのまま返す
        elif email:
            consumer = self.repo.find_consumer_by_email(email)
            if not consumer:
                return {"_error": "EMAIL_NOT_FOUND"}
                
        if not consumer:
            return {"_error": "NOT_FOUND"}
            
        consumer_id = consumer["consumer_id"]
        
        # 1. 現在のペナルティ状態の計算
        penalty_info = self.state_repo.fetch_penalty_info(consumer_id)
        ns_count = penalty_info["no_show_count"]
        cancel_count = penalty_info.get("cancel_count", 0)
        pardon_timestamp = penalty_info["no_show_pardon"]
        
        penalty_status = "none"
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
                    
        # 2. フラグ原因の履歴取得
        history = self.repo.get_penalty_history(consumer_id)
        
        return {
            "consumer_id": consumer_id,
            "email": consumer.get("email", "不明"),
            "penalty_status": penalty_status,
            "no_show_count": ns_count,
            "cancel_count": cancel_count,
            "pardon_timestamp": pardon_timestamp,
            "history": history
        }

    def reset_pardon(self, consumer_id: int):
        self.repo.reset_pardon(consumer_id)
        
    def revert_reservation_status(self, reservation_id: int, new_status: str):
        self.repo.update_reservation_status(reservation_id, new_status)