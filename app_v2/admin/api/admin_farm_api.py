# backend/app_v2/admin/api/admin_farm_api.py
from __future__ import annotations

from datetime import datetime, timedelta, timezone, time
from typing import List, Optional

from fastapi import APIRouter, Query, Depends
from pydantic import BaseModel

from app_v2.admin.usecases.resolve_farm_by_owner_kana import (
    resolve_farm_by_owner_kana,
)
from app_v2.admin.repository.admin_farm_repo import AdminFarmRepository
from app_v2.admin.dependencies import verify_admin_session

# 既存のイベント計算ロジックを再利用
from app_v2.customer_booking.services.reservation_expanded_service import (
    _calc_event_for_export,
)

router = APIRouter(
    prefix="/api/admin/farms",
    tags=["admin_farms"],
    dependencies=[Depends(verify_admin_session)]
)

JST = timezone(timedelta(hours=9), "JST")

# ── JST曜日名 ──
_WEEKDAY_JP = ["月", "火", "水", "木", "金", "土", "日"]


def _format_event_display(event_start_utc: datetime, event_end_utc: datetime) -> str:
    """
    UTC の event_start/end を JST に変換して表示文字列を生成する。
    例: "今週水 4/2 19:00-20:00"
    """
    st_jst = event_start_utc.astimezone(JST)
    ed_jst = event_end_utc.astimezone(JST)
    w = _WEEKDAY_JP[st_jst.weekday()]
    return f"今週{w} {st_jst.month}/{st_jst.day} {st_jst.strftime('%H:%M')}-{ed_jst.strftime('%H:%M')}"


# ============================================================
# DTOs
# ============================================================

class AdminFarmMatchDTO(BaseModel):
    farm_id: int
    owner_full_name: str
    owner_full_kana: str
    owner_postcode: str
    owner_address_line: str
    owner_phone: str


class AdminFarmResolveResponse(BaseModel):
    matches: List[AdminFarmMatchDTO]


class AdminFarmListItemDTO(BaseModel):
    farm_id: int
    owner_full_name: Optional[str] = None
    owner_full_kana: Optional[str] = None
    owner_email: Optional[str] = None
    owner_phone: Optional[str] = None
    owner_address_line: Optional[str] = None
    is_accepting_reservations: int
    is_public: int
    registration_status: str
    active_flag: int

    first_reservation_at: Optional[str] = None
    total_confirmed_6m: int = 0
    total_cancelled_6m: int = 0
    total_sales_6m: int = 0

    net_active_hours: float = 0.0
    cancel_count_a: int = 0
    cancel_count_b: int = 0
    emergency_cancels_1y: int = 0  # ★追加


class AdminFarmListResponse(BaseModel):
    farms: List[AdminFarmListItemDTO]


# ============================================================
# ★ 追加: 今週スロット別の予約農家フィルター用DTO
# ============================================================

class ThisWeekSlotDTO(BaseModel):
    slot_code: str        # "WED_19_20" など
    event_display: str    # "今週水 4/2 19:00-20:00"
    event_start_iso: str  # UTC ISO文字列（フロントから再送する必要はないが参考情報）
    farm_ids: List[int]   # このスロットに予約がある farm_id 一覧


class ThisWeekSlotsResponse(BaseModel):
    slots: List[ThisWeekSlotDTO]


# ============================================================
# GET /
# ============================================================

@router.get("/", response_model=AdminFarmListResponse)
def list_all_farms():
    """管理者用：全農家一覧"""
    repo = AdminFarmRepository()
    rows = repo.list_all_farms()
    return AdminFarmListResponse(
        farms=[AdminFarmListItemDTO(**row) for row in rows]
    )


# ============================================================
# GET /this-week-slots
# 今週のスロット別に「予約が入っている農家の farm_id 一覧」を返す
#
# フロントはこのレスポンスを使って農家一覧をフィルタリングする。
# スロット名はDBから動的に取得するため、将来の変更にも対応可能。
# ============================================================

@router.get("/this-week-slots", response_model=ThisWeekSlotsResponse)
def get_this_week_slots():
    """
    今週各スロットに確定予約を持つ農家の farm_id 一覧を返す。

    - スロット一覧は farms.pickup_time から動的に取得（ハードコードなし）
    - 今週の event_start は _calc_event_for_export で計算
    - farm_ids が空のスロットも返す（フロント側でボタン表示を判断）
    """
    repo = AdminFarmRepository()
    now_utc = datetime.now(timezone.utc)

    slot_codes = repo.get_distinct_active_slot_codes()

    result: List[ThisWeekSlotDTO] = []
    for slot_code in slot_codes:
        try:
            event_start_utc, event_end_utc = _calc_event_for_export(now_utc, slot_code)
        except ValueError:
            # 不正なスロットコードはスキップ
            continue

        farm_ids = repo.get_farm_ids_with_reservations_for_event(
            slot_code=slot_code,
            event_start_iso=event_start_utc.isoformat(),
        )

        result.append(ThisWeekSlotDTO(
            slot_code=slot_code,
            event_display=_format_event_display(event_start_utc, event_end_utc),
            event_start_iso=event_start_utc.isoformat(),
            farm_ids=farm_ids,
        ))

    return ThisWeekSlotsResponse(slots=result)


# ============================================================
# GET /resolve-by-owner-kana
# ============================================================

@router.get(
    "/resolve-by-owner-kana",
    response_model=AdminFarmResolveResponse,
)
def resolve_farm_by_owner_kana_api(
    query: str = Query(
        ...,
        min_length=1,
        description="農家オーナー名（ひらがな・部分一致）",
    ),
):
    return resolve_farm_by_owner_kana(owner_kana_query=query)