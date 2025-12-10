# app_v2/admin_reservations/admin_reservation_api.py

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from .admin_reservation_service import AdminReservationService
from .dtos import AdminReservationListItemDTO

router = APIRouter(
    prefix="/api/admin/reservations",
    tags=["admin_reservations"],
)


class AdminReservationListResponse(BaseModel):
    items: List[AdminReservationListItemDTO]
    total_count: int


# 受け渡しイベント（実受け渡し回）一覧用 DTO
class AdminReservationWeekSummary(BaseModel):
    farm_id: int
    pickup_slot_code: str

    # 実際の受け渡し日時（FarmerReservationTable と同じロジック）
    event_start: datetime
    event_end: datetime

    # 画面表示用のラベル（例: "12月3日（水）19:00〜20:00"）
    pickup_display: str

    # 件数・ステータス別件数
    reservation_count: int
    pending_count: int
    confirmed_count: int
    cancelled_count: int

    # 合計金額（お米部分のみ）
    rice_subtotal: int


class AdminReservationWeekListResponse(BaseModel):
    items: List[AdminReservationWeekSummary]


def get_admin_reservation_service() -> AdminReservationService:
    """
    DI用の Factory。
    必要になればここで Repository の差し替えなどを行う。
    """
    return AdminReservationService()


@router.get("", response_model=AdminReservationListResponse)
def list_admin_reservations(
    # --- フィルタ ---
    reservation_id: Optional[int] = Query(
        default=None,
        description="特定の予約IDで1件ピンポイント検索したい場合に指定",
    ),
    farm_id: Optional[int] = Query(
        default=None,
        description="特定の農家(farm_id)の予約だけに絞り込みたい場合に指定",
    ),
    status: Optional[str] = Query(
        default=None,
        description="予約ステータスで絞り込み（例: 'pending', 'confirmed', 'cancelled'）",
    ),
    date_from: Optional[date] = Query(
        default=None,
        description="（暫定）予約作成日の開始日: DATE(created_at) >= date_from",
    ),
    date_to: Optional[date] = Query(
        default=None,
        description="（暫定）予約作成日の終了日: DATE(created_at) <= date_to",
    ),
    event_start: Optional[datetime] = Query(
        default=None,
        description=(
            "/api/admin/reservations/weeks で返ってきた event_start をそのまま指定すると、"
            "その受け渡し回（FarmerReservationTable 1マス分）に属する予約だけを返す"
        ),
    ),
    # --- ページング ---
    limit: int = Query(
        default=200,
        ge=1,
        le=1000,
        description="取得する最大件数（デフォルト200、最大1000）。event_start 指定時は無視される。",
    ),
    offset: int = Query(
        default=0,
        ge=0,
        description="スキップする件数（ページング用）。event_start 指定時は無視される。",
    ),
    service: AdminReservationService = Depends(get_admin_reservation_service),
) -> AdminReservationListResponse:
    """
    管理者用：予約タイムライン一覧 API。

    想定ユースケース:
      - 日々のモニター（今日〜数日先の予約を一覧）
      - 特定の farm_id の予約状況確認
      - reservation_id からのピンポイント調査
      - /weeks で選んだ受け渡し回（event_start）に属する予約だけを一覧
    """
    items, total_count = service.list_for_admin(
        limit=limit,
        offset=offset,
        farm_id=farm_id,
        reservation_id=reservation_id,
        status=status,
        date_from=date_from,
        date_to=date_to,
        event_start=event_start,
    )

    return AdminReservationListResponse(
        items=items,
        total_count=total_count,
    )


@router.get("/weeks", response_model=AdminReservationWeekListResponse)
def list_admin_reservation_weeks(
    farm_id: int = Query(
        ...,
        description="対象の farm_id。ここで農家を 1 つに絞り込む（必須）。",
    ),
    limit: int = Query(
        100,
        ge=1,
        le=1000,
        description="新しい順に何件の受け渡しイベントを返すか（デフォルト100）。",
    ),
    service: AdminReservationService = Depends(get_admin_reservation_service),
) -> AdminReservationWeekListResponse:
    """
    管理者用：受け渡しイベント一覧 API。

    - ここでの 1 件 = 「ある農家の、ある pickup_slot_code の、ある週の受け渡しイベント」
    - FarmerReservationTable / Export と同じロジックで event_start/event_end を算出し、
      それをユニークキーにして集計する。
    - 返却結果の event_start を /api/admin/reservations の event_start にそのまま渡すと、
      その受け渡し回に属する予約だけが一覧で取得できる。
    """
    raw_items = service.list_weeks_for_farm(farm_id=farm_id)

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
