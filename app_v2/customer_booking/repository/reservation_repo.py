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
    - confirm / booked / cancel / admin などで
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

                -- 基本情報
                r.status                AS status,
                r.items_json            AS items_json,
                r.rice_subtotal         AS rice_subtotal,

                -- 表示・時刻（DB が唯一の正）
                r.pickup_display        AS pickup_display,
                r.event_start_at        AS event_start_at,
                r.event_end_at          AS event_end_at

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
