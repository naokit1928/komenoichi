from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app_v2.admin.usecases.resolve_farm_by_owner_kana import (
    resolve_farm_by_owner_kana,
)
from app_v2.admin.repository.admin_farm_repo import AdminFarmRepository

router = APIRouter(
    prefix="/api/admin/farms",
    tags=["admin_farms"],
)

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
    
    # ★ 追加: 正味稼働時間
    net_active_hours: float = 0.0

class AdminFarmListResponse(BaseModel):
    farms: List[AdminFarmListItemDTO]

@router.get("/", response_model=AdminFarmListResponse)
def list_all_farms():
    """管理者用：全農家一覧"""
    repo = AdminFarmRepository()
    rows = repo.list_all_farms()
    return AdminFarmListResponse(
        farms=[AdminFarmListItemDTO(**row) for row in rows]
    )

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
    return resolve_farm_by_owner_kana(
        owner_kana_query=query
    )