from __future__ import annotations

import sqlite3
from typing import Optional, Dict, Any

from app_v2.db.core import resolve_db_path


# ============================================================
# Reservation Read Repository（最小責務・V2 正式）
# ============================================================

def get_reservation_by_id(
    reservation_id: int,
) -> Optional[Dict[str, Any]]:
    """
    reservation_id から予約情報を取得する（read-only）。

    用途:
    - confirm / booked / admin などで
      「予約1件の素の情報」が必要な場合の共通入口

    注意:
    - status 更新は行わない
    - cancel / confirm の判断は service 層の責務
    """

    conn = sqlite3.connect(resolve_db_path())
    conn.row_factory = sqlite3.Row
    try:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                r.reservation_id        AS reservation_id,
                r.consumer_id           AS consumer_id,
                c.email                 AS consumer_email,
                r.farm_id               AS farm_id,
                r.created_at            AS created_at,
                r.pickup_slot_code      AS pickup_slot_code,
                r.items_json            AS items_json,
                r.rice_subtotal         AS rice_subtotal,
                r.status                AS status
            FROM reservations AS r
            LEFT JOIN consumers AS c
              ON c.consumer_id = r.consumer_id
            WHERE r.reservation_id = ?
            """,
            (reservation_id,),
        )

        row = cur.fetchone()
        if row is None:
            return None

        return dict(row)

    finally:
        conn.close()
