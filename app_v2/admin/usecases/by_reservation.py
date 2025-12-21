from __future__ import annotations

from typing import Optional, Tuple, List

from app_v2.admin.services.admin_reservation_service import (
    AdminReservationService,
)
from app_v2.admin.dto.admin_reservation_dtos import (
    AdminReservationListItemDTO,
)


# ============================================================
# Admin Reservation Usecase : by reservation_id
# ============================================================

def get_admin_reservation_by_id(
    *,
    reservation_id: int,
    service: Optional[AdminReservationService] = None,
) -> Optional[AdminReservationListItemDTO]:
    """
    管理画面用：
    reservation_id を指定して、単一の予約を取得する usecase。

    - reservation_id は一意前提
    - 見つからなければ None を返す
    - ロジックは service に完全委譲
    """

    svc = service or AdminReservationService()

    items, _ = svc.list_for_admin(
        reservation_id=reservation_id,
        limit=1,
        offset=0,
    )

    if not items:
        return None

    return items[0]


def list_admin_reservations_by_reservation_ids(
    *,
    reservation_ids: List[int],
    service: Optional[AdminReservationService] = None,
) -> List[AdminReservationListItemDTO]:
    """
    管理画面用：
    複数 reservation_id を指定して予約を取得する usecase。

    - 主に将来の一括調査・内部用途向け
    """

    if not reservation_ids:
        return []

    svc = service or AdminReservationService()

    items, _ = svc.list_for_admin(
        reservation_ids=reservation_ids,
        limit=len(reservation_ids),
        offset=0,
    )

    return items
