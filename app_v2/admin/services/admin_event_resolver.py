from __future__ import annotations

from datetime import datetime
from typing import Tuple

# ============================================================
# 既存ロジック（表示禁止・ロジック専用）
# ============================================================

from app_v2.customer_booking.services.reservation_expanded_service import (
    _parse_db_datetime,
    _calc_event_for_booking,
)

# ============================================================
# 管理画面用：受け渡しイベント解決ロジック
#
# 【重要な不変条件】
# - このファイルは「表示用文字列」を一切生成しない
# - pickup_display は DB.reservations.pickup_display が唯一の正
# - event_start / event_end は業務ロジック専用
# ============================================================


def parse_created_at(value) -> datetime:
    """
    DB から取得した created_at を datetime に正規化する。
    ※ 表示目的では使用しない
    """
    if isinstance(value, str):
        return _parse_db_datetime(value)
    if isinstance(value, datetime):
        return value
    # 想定外だが、落とさず現在時刻を返す（UTC）
    return datetime.utcnow()


def resolve_event(
    *,
    created_at: datetime,
    pickup_slot_code: str,
) -> Tuple[datetime, datetime]:
    """
    created_at + pickup_slot_code から
    (event_start, event_end) を返す。

    ※ 業務ロジック専用
    ※ 表示用文字列は生成しない
    """
    return _calc_event_for_booking(created_at, pickup_slot_code)
