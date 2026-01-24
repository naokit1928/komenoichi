from fastapi import APIRouter, Request, HTTPException, status
from typing import Any, Dict
import sqlite3
import json

from app_v2.db.core import resolve_db_path

router = APIRouter(
    prefix="/api/reservations",
    tags=["reservations"],
)

# ============================================================
# GET /api/reservations/pending/me
# ============================================================

@router.get("/pending/me")
def get_my_pending_reservation(request: Request) -> Dict[str, Any]:
    """
    この consumer の進行中 (PENDING) 予約を 1 件返す。
    ConfirmPage の唯一の真実のデータソース。
    単価は farms テーブルから size_kg ごとに補完する。
    """

    consumer_id = request.session.get("consumer_id")
    if not consumer_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="consumer session is required",
        )

    conn = sqlite3.connect(resolve_db_path())
    conn.row_factory = sqlite3.Row

    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
                r.reservation_id,
                r.farm_id,
                r.items_json,
                r.rice_subtotal,
                r.service_fee,
                r.pickup_slot_code,
                r.pickup_display,
                r.created_at,

                f.price_5kg,
                f.price_10kg,
                f.price_25kg
            FROM reservations r
            JOIN farms f ON f.farm_id = r.farm_id
            WHERE
                r.consumer_id = ?
                AND r.status = 'PENDING'
            ORDER BY r.created_at DESC
            LIMIT 1
            """,
            (consumer_id,),
        )
        row = cur.fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="pending reservation not found",
            )

        # items_json: [{ size_kg, quantity }, ...]
        raw_items = json.loads(row["items_json"] or "[]")

        # size_kg ごとの単価辞書
        price_by_kg = {
            5: row["price_5kg"],
            10: row["price_10kg"],
            25: row["price_25kg"],
        }

        # ConfirmPage が期待する形式に変換
        items = []
        for it in raw_items:
            size = it.get("size_kg")
            qty = it.get("quantity")

            unit_price = price_by_kg.get(size)
            if unit_price is None:
                unit_price = 0

            items.append(
                {
                    "size_kg": size,
                    "quantity": qty,
                    "unit_price": unit_price,
                }
            )

        rice_subtotal = row["rice_subtotal"] or 0
        service_fee = row["service_fee"] or 0
        total = rice_subtotal + service_fee

        return {
            "reservation_id": row["reservation_id"],
            "farm_id": row["farm_id"],
            "items": items,
            "rice_subtotal": rice_subtotal,
            "service_fee": service_fee,
            "total": total,
            "pickup_slot_code": row["pickup_slot_code"],
            "pickup_display": row["pickup_display"],
        }

    finally:
        conn.close()
