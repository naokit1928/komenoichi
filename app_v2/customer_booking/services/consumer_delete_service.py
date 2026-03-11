from datetime import datetime, timezone
from app_v2.customer_booking.repository.consumer_delete_repo import ConsumerDeleteRepository
from app_v2.customer_booking.services.reservation_expanded_service import (
    _calc_event_for_booking,
    _parse_db_datetime,
)

class ConsumerDeleteError(Exception):
    pass

class ConsumerHasActiveReservationsError(ConsumerDeleteError):
    pass

class ConsumerDeleteService:
    def __init__(self) -> None:
        self.repo = ConsumerDeleteRepository()

    def delete_account(self, consumer_id: int) -> None:
        # 1. 過去を含めたすべての confirmed 予約を取得
        records = self.repo.get_confirmed_reservations(consumer_id)
        
        now_utc = datetime.now(timezone.utc)
        
        # 2. 厳密な時間判定（現在時刻がイベント終了時刻を過ぎていないか）
        for rec in records:
            created_at_str = rec.get("created_at")
            pickup_time = rec.get("pickup_time")
            if not created_at_str or not pickup_time:
                continue
            
            try:
                created_at_utc = _parse_db_datetime(created_at_str)
                _, event_end_utc = _calc_event_for_booking(created_at_utc, pickup_time)
                
                # イベント終了時刻が未来であれば、まだ「受け取り待ち」の予約が存在する
                if now_utc < event_end_utc:
                    raise ConsumerHasActiveReservationsError("受け取り待ちの予約があるため、退会できません。")
            except ConsumerHasActiveReservationsError:
                raise
            except Exception:
                # 過去の壊れたデータなどは安全側に倒してスキップ
                continue
        
        # 3. 匿名化処理の実行
        self.repo.anonymize_consumer(consumer_id)