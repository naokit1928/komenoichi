# app_v2/admin/usecases/resolve_farm_by_owner_kana.py
from __future__ import annotations

from typing import Dict, List, Optional

from app_v2.admin.repository.admin_farm_repo import (
    AdminFarmRepository,
)


def resolve_farm_by_owner_kana(
    *,
    owner_kana_query: str,
    repo: Optional[AdminFarmRepository] = None,
) -> Dict[str, List[Dict[str, object]]]:
    """
    農家オーナー名（ひらがな）から farm_id 候補を解決する

    - 表示用 DTO を返す
    - weeks / reservations の取得は行わない
    """

    repository = repo or AdminFarmRepository()

    rows = repository.find_farms_by_owner_kana(
        owner_kana_query=owner_kana_query,
    )

    matches: List[Dict[str, object]] = []
    for r in rows:
        matches.append(
            {
                "farm_id": r["farm_id"],
                "owner_full_name": r["owner_full_name"],
                "owner_full_kana": r["owner_full_kana"],
                "owner_postcode": r["owner_postcode"],
                "owner_address_line": r["owner_address_line"],
                "owner_phone": r["owner_phone"],
            }
        )

    return {"matches": matches}
