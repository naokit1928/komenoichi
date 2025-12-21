# app_v2/admin/api/admin_reservation_api.py
from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

from app_v2.admin.usecases.by_farm import (
    list_admin_reservations_by_farm,
    list_admin_reservation_weeks_by_farm,
)
from app_v2.admin.usecases.by_reservation import (
    get_admin_reservation_by_id,
)
from app_v2.admin.usecases.resolve_event_by_reservation import (
    resolve_event_context_by_reservation_id,
)
from app_v2.admin.dto.admin_reservation_dtos import (
    AdminReservationListItemDTO,
)

router = APIRouter(
    prefix="/api/admin/reservations",
    tags=["admin_reservations"],
)

# ============================================================
# 共通レスポンス DTO
# ============================================================

class AdminReservationListResponse(BaseModel):
    items: List[AdminReservationListItemDTO]
    total_count: int


# ============================================================
# 受け渡しイベント（週）一覧用 DTO
# ============================================================

class AdminReservationWeekSummary(BaseModel):
    farm_id: int
    pickup_slot_code: str

    event_start: datetime
    event_end: datetime

    pickup_display: str

    reservation_count: int
    pending_count: int
    confirmed_count: int
    cancelled_count: int

    rice_subtotal: int


class AdminReservationWeekListResponse(BaseModel):
    items: List[AdminReservationWeekSummary]


# ============================================================
# 予約一覧 API（表示用）
# ============================================================

@router.get("", response_model=AdminReservationListResponse)
def list_admin_reservations(
    reservation_id: Optional[int] = Query(
        default=None,
        description="特定の reservation_id を指定して 1 件取得する場合に使用",
    ),
    farm_id: Optional[int] = Query(
        default=None,
        description="特定の farm_id の予約に絞り込む場合に指定",
    ),
    status: Optional[str] = Query(
        default=None,
        description="予約ステータスでの絞り込み（未使用）",
    ),
    date_from: Optional[date] = Query(
        default=None,
        description="予約作成日の開始日（未使用）",
    ),
    date_to: Optional[date] = Query(
        default=None,
        description="予約作成日の終了日（未使用）",
    ),
    event_start: Optional[datetime] = Query(
        default=None,
        description=(
            "/weeks で返却された event_start を指定すると、"
            "その受け渡し回に属する予約のみを返す"
        ),
    ),
    limit: int = Query(
        default=200,
        ge=1,
        le=1000,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
) -> AdminReservationListResponse:
    """
    管理者用：予約一覧取得 API

    - 一覧表示が目的
    - 画面遷移用 resolve 系 usecase は使用しない
    """

    # ─────────────────────────────
    # reservation_id ピンポイント検索
    # ─────────────────────────────
    if reservation_id is not None:
        item = get_admin_reservation_by_id(
            reservation_id=reservation_id
        )
        if item is None:
            return AdminReservationListResponse(
                items=[],
                total_count=0,
            )

        return AdminReservationListResponse(
            items=[item],
            total_count=1,
        )

    # ─────────────────────────────
    # farm_id / event_start ベース一覧
    # ─────────────────────────────
    items, total_count = list_admin_reservations_by_farm(
        farm_id=farm_id,
        limit=limit,
        offset=offset,
        event_start=event_start,
    )

    return AdminReservationListResponse(
        items=items,
        total_count=total_count,
    )


# ============================================================
# 受け渡し回（週）一覧 API
# ============================================================

@router.get("/weeks", response_model=AdminReservationWeekListResponse)
def list_admin_reservation_weeks(
    farm_id: int = Query(
        ...,
        description="対象の farm_id",
    ),
) -> AdminReservationWeekListResponse:
    """
    管理者用：受け渡しイベント（週）一覧 API
    """

    raw_items = list_admin_reservation_weeks_by_farm(
        farm_id=farm_id,
    )

    items: List[AdminReservationWeekSummary] = []
    for b in raw_items:
        items.append(
            AdminReservationWeekSummary(
                farm_id=b["farm_id"],
                pickup_slot_code=b["pickup_slot_code"],
                event_start=b["event_start"],
                event_end=b["event_end"],
                pickup_display=b["pickup_display"],
                reservation_count=b["reservation_count"],
                pending_count=b["pending_count"],
                confirmed_count=b["confirmed_count"],
                cancelled_count=b["cancelled_count"],
                rice_subtotal=b["rice_subtotal"],
            )
        )

    return AdminReservationWeekListResponse(items=items)


# ============================================================
# reservation_id → event 解決 API（画面遷移専用）
# ============================================================

class AdminReservationResolveEventResponse(BaseModel):
    reservation_id: int
    farm_id: int
    event_start: datetime


@router.get(
    "/resolve-by-reservation-id",
    response_model=AdminReservationResolveEventResponse,
)
def resolve_event_by_reservation_id(
    reservation_id: int = Query(
        ...,
        ge=1,
        description="検索対象の reservation_id",
    ),
):
    """
    管理者用：
    reservation_id から、その予約が属する
    farm_id / event_start を解決する API

    ※ 一覧表示用途では使用しない
    """

    ctx = resolve_event_context_by_reservation_id(
        reservation_id=reservation_id
    )

    if ctx is None:
        raise HTTPException(
            status_code=404,
            detail="Reservation not found",
        )

    return AdminReservationResolveEventResponse(
        reservation_id=ctx["reservation_id"],
        farm_id=ctx["farm_id"],
        event_start=ctx["event_start"],
    )
