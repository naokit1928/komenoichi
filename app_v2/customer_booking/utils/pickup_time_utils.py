# app_v2/customer_booking/utils/pickup_time_utils.py
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Tuple
from zoneinfo import ZoneInfo

# 共通タイムゾーン（JST）
JST = ZoneInfo("Asia/Tokyo")

# pickup_slot_code 用の曜日マップ
# "MON"=0 .. "SUN"=6
WEEKDAY_MAP = {
    "MON": 0,
    "TUE": 1,
    "WED": 2,
    "THU": 3,
    "FRI": 4,
    "SAT": 5,
    "SUN": 6,
}


def parse_slot_code(slot_code: str) -> Tuple[int, int, int]:
    """
    pickup_slot_code を解析して (weekday_idx, start_hour, end_hour) を返す。

    例:
        "WED_19_20" / "wed_19_20" -> (2, 19, 20)
        weekday_idx: 0=Mon .. 6=Sun

    想定外フォーマットの場合:
        - 「今日の曜日インデックス」と「0:00–1:00」を返す
    """
    try:
        parts = slot_code.split("_")
        if len(parts) != 3:
            raise ValueError
        day_str, start_str, end_str = parts
    except Exception:
        # 想定外の形式はとりあえず「今日 + 0:00–1:00」みたいに fallback
        weekday_idx = datetime.now(JST).weekday()
        return weekday_idx, 0, 1

    weekday_idx = WEEKDAY_MAP.get(day_str.upper(), 0)
    start_hour = int(start_str)
    end_hour = int(end_str)
    return weekday_idx, start_hour, end_hour


def compute_next_pickup(
    now: datetime,
    slot_code: str,
) -> Tuple[datetime, datetime]:
    """
    pickup_slot_code と現在時刻から
    「次の受け渡し開始時刻」と「受付締切時刻」を計算する。

    仕様:
    - 今から見て最も近い「予約可能な」枠を next_pickup_start とする
    - 受付締切は start - 3時間
    - 今週分が「3時間前ルール」でアウトなら、来週の同じ曜日にシフトする

    戻り値:
        (start_dt, deadline_dt)
        start_dt: 次回の受け渡し開始日時（JST）
        deadline_dt: その枠の受付締切日時（JST）
    """
    weekday_idx, start_hour, _end_hour = parse_slot_code(slot_code)

    # 今日から見て、対象曜日まで何日先かを計算
    today_wd = now.weekday()
    days_ahead = (weekday_idx - today_wd) % 7
    candidate_date = (now + timedelta(days=days_ahead)).date()

    # 一旦「今週」の候補日時を作る
    start_dt = datetime(
        candidate_date.year,
        candidate_date.month,
        candidate_date.day,
        start_hour,
        0,
        0,
        tzinfo=JST,
    )

    # now から3時間以内に始まる枠は NG → 来週へシフト
    if start_dt - now <= timedelta(hours=3):
        candidate_date = candidate_date + timedelta(days=7)
        start_dt = datetime(
            candidate_date.year,
            candidate_date.month,
            candidate_date.day,
            start_hour,
            0,
            0,
            tzinfo=JST,
        )

    deadline_dt = start_dt - timedelta(hours=3)
    return start_dt, deadline_dt
