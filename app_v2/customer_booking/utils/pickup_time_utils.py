# app_v2/customer_booking/utils/pickup_time_utils.py
from __future__ import annotations

from datetime import datetime, timedelta, time
from typing import Tuple
from zoneinfo import ZoneInfo

# 共通タイムゾーン（JST）
JST = ZoneInfo("Asia/Tokyo")

# pickup_slot_code 用の曜日マップ
# "MON"=0 .. "SUN"=6（datetime.weekday と一致）
WEEKDAY_MAP = {
    "MON": 0,
    "TUE": 1,
    "WED": 2,
    "THU": 3,
    "FRI": 4,
    "SAT": 5,
    "SUN": 6,
}

_WEEKDAY_JP = ["月", "火", "水", "木", "金", "土", "日"]


# ============================================================
# slot_code parsing
# ============================================================

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
        weekday_idx = datetime.now(JST).weekday()
        return weekday_idx, 0, 1

    weekday_idx = WEEKDAY_MAP.get(day_str.upper(), 0)
    start_hour = int(start_str)
    end_hour = int(end_str)
    return weekday_idx, start_hour, end_hour


# ============================================================
# base week calculation
# ============================================================

def calc_base_week_event(
    base: datetime,
    pickup_slot_code: str,
) -> Tuple[datetime, datetime]:
    """
    指定した base が属する「週」（月曜はじまり）における
    pickup_slot_code の event_start / event_end を計算する。
    """
    base = base.astimezone(JST)
    weekday_idx, start_hour, end_hour = parse_slot_code(pickup_slot_code)

    # 月曜始まりの週
    week_start_date = base.date() - timedelta(days=base.weekday())
    event_date = week_start_date + timedelta(days=weekday_idx)

    event_start = datetime.combine(
        event_date,
        time(hour=start_hour, minute=0, tzinfo=JST),
    )
    event_end = datetime.combine(
        event_date,
        time(hour=end_hour, minute=0, tzinfo=JST),
    )
    return event_start, event_end


# ============================================================
# booking / export decision rules
# ============================================================

def calc_event_for_booking(
    created_at: datetime,
    pickup_slot_code: str,
) -> Tuple[datetime, datetime]:
    """
    予約確定時に「どの週のイベント扱いにするか」を決める。

    ルール:
    - event_start の 3時間前 までは「今週のイベント」
    - それ以降に入った予約は「次週のイベント」
    """
    base_start, base_end = calc_base_week_event(created_at, pickup_slot_code)
    deadline = base_start - timedelta(hours=3)

    if created_at <= deadline:
        return base_start, base_end

    return base_start + timedelta(days=7), base_end + timedelta(days=7)


def calc_event_for_export(
    now: datetime,
    pickup_slot_code: str,
) -> Tuple[datetime, datetime]:
    """
    Export / 管理画面で「今表示すべきイベント週」を決める。

    ルール:
    - now <= event_end + 3h → 今週
    - それ以降 → 次週
    """
    base_start, base_end = calc_base_week_event(now, pickup_slot_code)
    grace_until = base_end + timedelta(hours=3)

    if now <= grace_until:
        return base_start, base_end

    return base_start + timedelta(days=7), base_end + timedelta(days=7)


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
    - 今週分が「3時間前ルール」でアウトなら、来週へ
    """
    weekday_idx, start_hour, _ = parse_slot_code(slot_code)

    today_wd = now.weekday()
    days_ahead = (weekday_idx - today_wd) % 7
    candidate_date = (now + timedelta(days=days_ahead)).date()

    start_dt = datetime(
        candidate_date.year,
        candidate_date.month,
        candidate_date.day,
        start_hour,
        0,
        0,
        tzinfo=JST,
    )

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


# ============================================================
# display helpers
# ============================================================

def format_event_display_label(
    event_start: datetime,
    event_end: datetime,
) -> str:
    """
    表示用:
    "11月29日（土）10:00〜11:00"
    """
    event_start = event_start.astimezone(JST)
    event_end = event_end.astimezone(JST)

    month = event_start.month
    day = event_start.day
    weekday_jp = _WEEKDAY_JP[event_start.weekday()]
    start_str = event_start.strftime("%H:%M")
    end_str = event_end.strftime("%H:%M")

    return f"{month}月{day}日（{weekday_jp}）{start_str}〜{end_str}"
