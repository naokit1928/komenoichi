from __future__ import annotations

from typing import Optional, Dict
from datetime import datetime

from app_v2.admin.services.admin_reservation_service import (
    AdminReservationService,
)


# ============================================================
# Admin Reservation Usecase
# reservation_id -> (farm_id, event_start) 解決
# ============================================================

def resolve_event_context_by_reservation_id(
    *,
    reservation_id: int,
    service: Optional[AdminReservationService] = None,
) -> Optional[Dict[str, object]]:
    """
    reservation_id から、
    AdminReservationEventDetailPage に遷移するための
    最小コンテキストを返す。

    戻り値:
      {
        "reservation_id": int,
        "farm_id": int,
        "event_start": datetime,
      }
    """

    svc = service or AdminReservationService()

    items, _ = svc.list_for_admin(
        reservation_id=reservation_id,
        limit=1,
        offset=0,
    )

    if not items:
        return None

    r = items[0]

    # ★ DTO 上の正しい週軸は pickup_start
    event_start: datetime = r.pickup_start

    return {
        "reservation_id": r.reservation_id,
        "farm_id": r.farm_id,
        "event_start": event_start,
    }
