import sqlite3
import os
from typing import Optional, Dict, Any


def _get_db_path() -> str:
    env_path = os.getenv("APP_DB_PATH")
    return env_path if env_path else "app.db"


def get_reservation_by_id(reservation_id: int) -> Optional[Dict[str, Any]]:
    """
    reservation_id から予約情報を取得する。
    新テーブル（reservations / consumers）前提。
    """
    conn = sqlite3.connect(_get_db_path())
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            r.reservation_id        AS reservation_id,
            r.consumer_id           AS consumer_id,
            c.line_consumer_id      AS line_consumer_id,
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
    conn.close()

    if row is None:
        return None

    return dict(row)


def cancel_reservation_db(reservation_id: int) -> bool:
    """
    reservation_id を指定して予約をキャンセル状態に更新する。
    """
    conn = sqlite3.connect(_get_db_path())
    cur = conn.cursor()

    cur.execute(
        """
        UPDATE reservations
        SET status = 'cancelled'
        WHERE reservation_id = ?
        """,
        (reservation_id,),
    )

    conn.commit()
    conn.close()
    return True


# ============================================================
# 最後に confirmed した農家を返す
# ============================================================

def get_last_confirmed_farm_id(consumer_id: int) -> Optional[int]:
    """
    consumer_id に紐づく、直近で confirmed 状態の farm_id を返す。
    """
    conn = sqlite3.connect(_get_db_path())
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute(
        """
        SELECT farm_id
          FROM reservations
         WHERE consumer_id = ?
           AND status = 'confirmed'
         ORDER BY payment_succeeded_at DESC, reservation_id DESC
         LIMIT 1
        """,
        (consumer_id,),
    )

    row = cur.fetchone()
    conn.close()

    return row["farm_id"] if row else None
