import sqlite3
import os
from typing import Optional, Dict, Any


def _get_db_path() -> str:
    env_path = os.getenv("APP_DB_PATH")
    return env_path if env_path else "app.db"


def get_reservation_by_id(reservation_id: int) -> Optional[Dict[str, Any]]:
    conn = sqlite3.connect(_get_db_path())
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            r.id,
            u.line_user_id AS line_user_id,
            r.farm_id,
            r.created_at,
            r.pickup_slot_code,
            r.items_json,
            r.rice_subtotal,
            r.status
        FROM reservations AS r
        LEFT JOIN users AS u
          ON u.id = r.user_id
        WHERE r.id = ?
        """,
        (reservation_id,),
    )

    row = cur.fetchone()
    conn.close()

    if row is None:
        return None

    return dict(row)


def cancel_reservation_db(reservation_id: int) -> bool:
    conn = sqlite3.connect(_get_db_path())
    cur = conn.cursor()

    cur.execute(
        """
        UPDATE reservations
        SET status = 'cancelled'
        WHERE id = ?
        """,
        (reservation_id,),
    )

    conn.commit()
    conn.close()
    return True


# ============================================================
# ★ 新規追加：最後に confirmed した農家を返す関数
# ============================================================

def get_last_confirmed_farm_id(user_id: int) -> Optional[int]:
    conn = sqlite3.connect(_get_db_path())
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute(
        """
        SELECT farm_id
          FROM reservations
         WHERE user_id = ?
           AND status = 'confirmed'
         ORDER BY payment_succeeded_at DESC, id DESC
         LIMIT 1;
        """,
        (user_id,),
    )

    row = cur.fetchone()
    conn.close()

    return row["farm_id"] if row else None
