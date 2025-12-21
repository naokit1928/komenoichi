from __future__ import annotations

from datetime import datetime
from typing import Optional

from app_v2.customer_booking.utils.pickup_time_utils import JST
from app_v2.customer_booking.repository.reservation_expanded_repo import (
    ReservationExpandedRepository,
)
from app_v2.customer_booking.services.reservation_expanded_service import (
    _calc_event_for_export,
    _calc_event_for_booking,
    _parse_db_datetime,
)


class PickupLockService:
    """
    Pickup 設定が「予約によりロックされているか」を判定する専用サービス。

    責務:
    - reservation_expanded と同一ロジックで
      「今のイベントに属する confirmed 予約が存在するか」を判定する
    - pickup_settings / API / DB 更新処理は一切知らない

    重要:
    - pickup_time が未設定なら必ず「ロックなし」
    - 内部エラーが起きても例外は投げない（安全側に倒す）
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
        """
        reservation_expanded と完全に同じ考え方で、

        - pickup_time（スロット）が未設定 → 0
        - status = confirmed のみ対象
        - created_at から booking event を計算
        - 「今の export event」と同じ週に属するものだけをカウント
        """
        if not pickup_time:
            return 0

        # 該当 farm / スロットの confirmed 予約を全取得
        records = self.reservation_repo.get_confirmed_reservations_for_farm(
            farm_id=farm_id,
            pickup_slot_code=pickup_time,
        )

        if not records:
            return 0

        now = datetime.now(JST)
        export_event_start, _ = _calc_event_for_export(now, pickup_time)

        count = 0
        for rec in records:
            if not rec.created_at:
                continue

            try:
                created_at_dt = _parse_db_datetime(rec.created_at)
            except Exception:
                # 壊れた created_at は無視
                continue

            booking_event_start, _ = _calc_event_for_booking(
                created_at_dt,
                pickup_time,
            )

            # 今表示対象のイベントと同じ週か
            if booking_event_start.date() == export_event_start.date():
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
        """
        今のイベントに属する confirmed 予約数を返す。
        例外は外に出さない。
        """
        try:
            return self._count_confirmed_for_current_event(
                farm_id=farm_id,
                pickup_time=pickup_time,
            )
        except Exception:
            # 何か壊れても「予約なし」として扱う（編集不能にしない）
            return 0

    def is_locked(
        self,
        farm_id: int,
        pickup_time: Optional[str],
    ) -> bool:
        """
        pickup 設定がロックされているかどうか。

        - confirmed が 1 件以上 → True
        - それ以外 → False
        """
        return self.get_active_reservations_count(
            farm_id=farm_id,
            pickup_time=pickup_time,
        ) > 0
