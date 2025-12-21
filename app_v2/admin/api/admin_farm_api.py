from __future__ import annotations

from typing import List

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app_v2.admin.usecases.resolve_farm_by_owner_kana import (
    resolve_farm_by_owner_kana,
)

router = APIRouter(
    prefix="/api/admin/farms",
    tags=["admin_farms"],
)


# ============================================================
# Response DTO
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


# ============================================================
# API
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
    """
    管理者用：
    農家オーナー名（ひらがな）から farm_id 候補を解決する API
    """

    return resolve_farm_by_owner_kana(
        owner_kana_query=query
    )
