# app_v2/customer_booking/services/pickup_event_logic.py
from __future__ import annotations

from datetime import datetime
from typing import Tuple

# 既存の reservation_expanded_service にある実装をそのままラップする
from app_v2.customer_booking.services.reservation_expanded_service import (
    JST as _JST,
    _parse_db_datetime as _parse_db_datetime_impl,
    _calc_event_for_export as _calc_event_for_export_impl,
    _calc_event_for_booking as _calc_event_for_booking_impl,
)

# 外からは pickup_event_logic.JST として使えるように re-export
JST = _JST


def parse_db_datetime(value: str) -> datetime:
    """
    SQLite に保存されている DATETIME 文字列を Python datetime(JST) に変換する。

    実装は reservation_expanded_service の _parse_db_datetime に委譲。
    """
    return _parse_db_datetime_impl(value)


def calc_event_for_export(now: datetime, pickup_slot_code: str) -> Tuple[datetime, datetime]:
    """
    「今の時刻 now から見て、どのイベント(週)を表示対象にするか」を決める。

    実装は reservation_expanded_service の _calc_event_for_export に委譲。
    """
    return _calc_event_for_export_impl(now, pickup_slot_code)


def calc_event_for_booking(created_at: datetime, pickup_slot_code: str) -> Tuple[datetime, datetime]:
    """
    「予約 created_at がどのイベント(週)に属する扱いにするか」を決める。

    実装は reservation_expanded_service の _calc_event_for_booking に委譲。
    """
    return _calc_event_for_booking_impl(created_at, pickup_slot_code)


def is_same_event_for_display(
    now: datetime,
    created_at: datetime,
    pickup_slot_code: str,
) -> bool:
    """
    reservation_expanded / pickup_settings 共通の

    「今表示対象のイベント」と
    「この予約(created_at)が属するイベント」が同じか？

    を判定するユーティリティ。
    """
    export_start, _ = calc_event_for_export(now, pickup_slot_code)
    booking_start, _ = calc_event_for_booking(created_at, pickup_slot_code)
    return export_start == booking_start
