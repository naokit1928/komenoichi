from __future__ import annotations

# ★ timedelta を追加
from datetime import datetime, timezone, timedelta
from typing import Optional

from app_v2.customer_booking.utils.pickup_time_utils import JST
from app_v2.customer_booking.repository.reservation_expanded_repo import (
    ReservationExpandedRepository,
)
from app_v2.customer_booking.services.reservation_expanded_service import (
    _resolve_slot_to_utc_event,
    _calc_event_for_booking,
    _parse_db_datetime,
)


class PickupLockService:
    """
    Pickup 設定が「予約によりロックされているか」を判定する専用サービス。
    """

    def __init__(self) -> None:
        self.reservation_repo = ReservationExpandedRepository()

    # ---------------------------------------------------------
    # 内部: 現在イベントに属する confirmed 件数を数える
    # ---------------------------------------------------------

    def _count_confirmed_for_current_event(
        self,
        farm_id: int,
        pickup_time: Optional[str],
    ) -> int:
        if not pickup_time:
            return 0

        # 該当 farm / スロットの confirmed 予約を全取得
        records = self.reservation_repo.get_confirmed_reservations_for_farm(
            farm_id=farm_id,
            pickup_slot_code=pickup_time,
        )

        if not records:
            return 0

        now_utc = datetime.now(timezone.utc)
        
        # 純粋にイベント終了時刻を基準にする
        base_start_utc, base_end_utc = _resolve_slot_to_utc_event(now_utc, pickup_time)
        
        # 現在時刻が受け渡し終了時刻(20:00)を過ぎていれば、ロックの対象を「来週」に切り替える
        if now_utc >= base_end_utc:
            # ★ 修正: datetime.timedelta ではなく、直接 timedelta(days=7) を使用
            lock_target_start = base_start_utc.date() + timedelta(days=7)
        else:
            lock_target_start = base_start_utc.date()

        count = 0
        for rec in records:
            if not rec.created_at:
                continue

            try:
                created_at_dt = _parse_db_datetime(rec.created_at)
            except Exception:
                continue

            booking_event_start, _ = _calc_event_for_booking(
                created_at_dt,
                pickup_time,
            )

            # 予約がロック対象の週に属しているか
            if booking_event_start.date() == lock_target_start:
                count += 1

        return count

    # ---------------------------------------------------------
    # 公開 API
    # ---------------------------------------------------------

    def get_active_reservations_count(
        self,
        farm_id: int,
        pickup_time: Optional[str],
    ) -> int:
        try:
            return self._count_confirmed_for_current_event(
                farm_id=farm_id,
                pickup_time=pickup_time,
            )
        except Exception as e:
            # ★ 修正: エラーを握りつぶさず、ターミナルに詳細を出力して気付けるようにする
            import traceback
            traceback.print_exc()
            return 0

    def is_locked(
        self,
        farm_id: int,
        pickup_time: Optional[str],
    ) -> bool:
        return self.get_active_reservations_count(
            farm_id=farm_id,
            pickup_time=pickup_time,
        ) > 0