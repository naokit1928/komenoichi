from __future__ import annotations

from datetime import datetime
from typing import Tuple

# 既存ロジックをそのまま移植
from app_v2.customer_booking.services.reservation_expanded_service import (
    _parse_db_datetime,
    _calc_event_for_booking,
    _format_event_display_label,
)


# ============================================================
# 管理画面用：受け渡しイベント解決ロジック
# ============================================================

def parse_created_at(value) -> datetime:
    """
    DB から取得した created_at を datetime に正規化する。
    """
    if isinstance(value, str):
        return _parse_db_datetime(value)
    if isinstance(value, datetime):
        return value
    # 想定外だが落とさない
    return datetime.now()


def resolve_event(
    *,
    created_at: datetime,
    pickup_slot_code: str,
) -> Tuple[datetime, datetime]:
    """
    created_at + pickup_slot_code から
    (event_start, event_end) を返す。
    """
    return _calc_event_for_booking(created_at, pickup_slot_code)


def format_pickup_display(
    *,
    event_start: datetime,
    event_end: datetime,
) -> str:
    """
    管理画面表示用の pickup_display を生成する。
    """
    return _format_event_display_label(event_start, event_end)
