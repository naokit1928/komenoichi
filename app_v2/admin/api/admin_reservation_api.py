# app_v2/admin/api/admin_reservation_api.py
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query, HTTPException, Depends
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
from app_v2.admin.services.admin_reservation_service import (
    AdminReservationService,
)
from app_v2.admin.repository.admin_reservation_repo import (
    AdminReservationRepository,
)
from app_v2.admin.dependencies import verify_admin_session

router = APIRouter(
    prefix="/api/admin/reservations",
    tags=["admin_reservations"],
    dependencies=[Depends(verify_admin_session)]
)

class AdminReservationListResponse(BaseModel):
    items: List[AdminReservationListItemDTO]
    total_count: int

class AdminAlertsResponse(BaseModel):
    payment_anomalies: List[AdminReservationListItemDTO]
    zombies: List[AdminReservationListItemDTO]
    emergency_cancels: Optional[List[Dict[str, Any]]] = None
    warning_farms: Optional[List[Dict[str, Any]]] = None

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
    emergency_cancel_reason: Optional[str] = None

class AdminReservationWeekListResponse(BaseModel):
    items: List[AdminReservationWeekSummary]


@router.get("", response_model=AdminReservationListResponse)
def list_admin_reservations(
    reservation_id: Optional[int] = Query(default=None),
    farm_id: Optional[int] = Query(default=None),
    status: Optional[str] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    event_start: Optional[datetime] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> AdminReservationListResponse:

    if reservation_id is not None:
        item = get_admin_reservation_by_id(reservation_id=reservation_id)
        if item is None:
            return AdminReservationListResponse(items=[], total_count=0)
        return AdminReservationListResponse(items=[item], total_count=1)

    items, total_count = list_admin_reservations_by_farm(
        farm_id=farm_id, limit=limit, offset=offset, event_start=event_start,
    )
    return AdminReservationListResponse(items=items, total_count=total_count)


@router.get("/weeks", response_model=AdminReservationWeekListResponse)
def list_admin_reservation_weeks(
    farm_id: int = Query(..., description="対象の farm_id"),
) -> AdminReservationWeekListResponse:

    raw_items = list_admin_reservation_weeks_by_farm(farm_id=farm_id)
    items: List[AdminReservationWeekSummary] = []
    for b in raw_items:
        items.append(AdminReservationWeekSummary(
            farm_id=b["farm_id"], pickup_slot_code=b["pickup_slot_code"],
            event_start=b["event_start"], event_end=b["event_end"], pickup_display=b["pickup_display"],
            reservation_count=b["reservation_count"], pending_count=b["pending_count"],
            confirmed_count=b["confirmed_count"], cancelled_count=b["cancelled_count"], rice_subtotal=b["rice_subtotal"],
            emergency_cancel_reason=b.get("emergency_cancel_reason"),
        ))
    return AdminReservationWeekListResponse(items=items)


class AdminReservationResolveEventResponse(BaseModel):
    reservation_id: int
    farm_id: int
    event_start: datetime

@router.get("/resolve-by-reservation-id", response_model=AdminReservationResolveEventResponse)
def resolve_event_by_reservation_id(
    reservation_id: int = Query(..., ge=1),
):
    ctx = resolve_event_context_by_reservation_id(reservation_id=reservation_id)
    if ctx is None:
        raise HTTPException(status_code=404, detail="Reservation not found")

    return AdminReservationResolveEventResponse(
        reservation_id=ctx["reservation_id"], farm_id=ctx["farm_id"], event_start=ctx["event_start"],
    )

@router.get("/alerts", response_model=AdminAlertsResponse)
def get_admin_alerts():
    svc = AdminReservationService()
    alerts = svc.get_alerts_for_admin()
    
    return AdminAlertsResponse(
        payment_anomalies=alerts["payment_anomalies"],
        zombies=alerts["zombies"],
        emergency_cancels=alerts.get("emergency_cancels", []),
        warning_farms=alerts.get("warning_farms", [])
    )


# ------------------------------------------------------------------
# 緊急停止アラート（1件ごと）の確認・履歴
# ------------------------------------------------------------------
@router.post("/alerts/emergency-cancel/{log_id}/check")
def check_emergency_cancel(log_id: int):
    repo = AdminReservationRepository()
    repo.mark_emergency_cancel_checked(log_id)
    return {"status": "success"}

@router.get("/alerts/emergency-cancel/archive")
def get_emergency_cancel_archive():
    repo = AdminReservationRepository()
    items = repo.list_archived_emergency_cancels(limit=100)
    return {"items": items}


# ------------------------------------------------------------------
# ★ 新規追加：要注意農家（回数ベース）の確認・履歴
# ------------------------------------------------------------------
class CheckWarningRequest(BaseModel):
    current_count: int

@router.post("/alerts/warning-farms/{farm_id}/check")
def check_warning_farm(farm_id: int, payload: CheckWarningRequest):
    """要注意農家のアラートを（現在の回数を記憶することで）確認済みにする"""
    repo = AdminReservationRepository()
    repo.mark_warning_farm_checked(farm_id, payload.current_count)
    return {"status": "success"}

@router.get("/alerts/warning-farms/archive")
def get_warning_farms_archive():
    """過去に要注意になった農家のリスト（アーカイブ）を取得する"""
    repo = AdminReservationRepository()
    items = repo.list_archived_warning_farms()
    return {"items": items}