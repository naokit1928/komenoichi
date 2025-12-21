from __future__ import annotations

from datetime import date, datetime
from typing import List, Tuple, Optional

from app_v2.admin.services.admin_reservation_service import (
    AdminReservationService,
)
from app_v2.admin.dto.admin_reservation_dtos import (
    AdminReservationListItemDTO,
)


# ============================================================
# Admin Reservation Usecase : by farm
# ============================================================

def list_admin_reservations_by_farm(
    *,
    farm_id: int,
    limit: int = 200,
    offset: int = 0,
    status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    event_start: Optional[datetime] = None,
    service: Optional[AdminReservationService] = None,
) -> Tuple[List[AdminReservationListItemDTO], int]:
    """
    管理画面用：
    特定 farm_id に紐づく予約一覧を取得する usecase。

    - 検索軸は farm_id に限定
    - ロジックは service に委譲
    """

    svc = service or AdminReservationService()

    return svc.list_for_admin(
        farm_id=farm_id,
        limit=limit,
        offset=offset,
        status=status,
        date_from=date_from,
        date_to=date_to,
        event_start=event_start,
    )


def list_admin_reservation_weeks_by_farm(
    *,
    farm_id: int,
    service: Optional[AdminReservationService] = None,
):
    """
    管理画面用：
    特定 farm_id に紐づく予約を「週（受け渡し単位）」で集約する usecase。
    """

    svc = service or AdminReservationService()

    return svc.list_weeks_for_farm(farm_id=farm_id)
