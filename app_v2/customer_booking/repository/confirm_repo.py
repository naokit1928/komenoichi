from __future__ import annotations

import json
import sqlite3
from typing import List, TypedDict

from fastapi import HTTPException

from app_v2.db.core import resolve_db_path
from app_v2.customer_booking.dtos import (
    ReservationItemInput,
    ReservationResultDTO,
    ReservationResultItemDTO,
)

# ============================================================
# DB Connection（V2 正式ルール）
# ============================================================

def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(resolve_db_path())
    conn.row_factory = sqlite3.Row
    return conn


# ============================================================
# Internal types
# ============================================================

class _ItemCalcResult(TypedDict):
    size_kg: int
    quantity: int
    unit_price: int
    subtotal: int


# ============================================================
# Public API（confirm_service から呼ばれる唯一の関数）
# ============================================================

def create_pending_reservation(
    *,
    farm_id: int,
    pickup_slot_code: str,
    pickup_display: str,
    items: List[ReservationItemInput],
    service_fee: int,
    currency: str,
    consumer_id: int,  # ★ 必須（B方式）
    conn: sqlite3.Connection | None = None,   # ★ 追加（外部トランザクション対応）
) -> ReservationResultDTO:
    

    owns_conn = False
    if conn is None:
        conn = _get_conn()
        owns_conn = True

    try:
        cur = conn.cursor()

        # -------------------------
        # items 計算
        # -------------------------
        items_detail: List[_ItemCalcResult] = []
        rice_subtotal = 0

        for item in items:
            if item.quantity <= 0:
                raise HTTPException(status_code=400, detail="Quantity must be positive")

            unit_price = _fetch_farm_price(
                conn=conn,
                farm_id=farm_id,
                size_kg=item.size_kg,
            )

            subtotal = unit_price * item.quantity
            rice_subtotal += subtotal

            items_detail.append(
                {
                    "size_kg": item.size_kg,
                    "quantity": item.quantity,
                    "unit_price": unit_price,
                    "subtotal": subtotal,
                }
            )

        items_json = json.dumps(items_detail, ensure_ascii=False)

        # -------------------------
        # INSERT（consumer_id 付き）
        # -------------------------
        cur.execute(
            """
            INSERT INTO reservations
            (
                consumer_id,
                farm_id,
                pickup_slot_code,
                pickup_display,
                items_json,
                rice_subtotal,
                service_fee,
                currency,
                status,
                created_at
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
            )
            """,
            (
                consumer_id,
                farm_id,
                pickup_slot_code,
                pickup_display,
                items_json,
                rice_subtotal,
                service_fee,
                currency,
                "PENDING",
            ),
        )

        reservation_id = cur.lastrowid

        if owns_conn:
            conn.commit()

    finally:
        if owns_conn:
            conn.close()

    result_items = [
        ReservationResultItemDTO(
            size_kg=i["size_kg"],
            quantity=i["quantity"],
            unit_price=i["unit_price"],
            subtotal=i["subtotal"],
        )
        for i in items_detail
    ]

    return ReservationResultDTO(
        reservation_id=reservation_id,
        farm_id=farm_id,
        items=result_items,
        rice_subtotal=rice_subtotal,
        service_fee=service_fee,
        currency=currency,
    )


# ============================================================
# Internal helpers
# ============================================================

def _fetch_farm_price(
    *,
    conn: sqlite3.Connection,
    farm_id: int,
    size_kg: int,
) -> int:
    if size_kg == 5:
        col = "price_5kg"
    elif size_kg == 10:
        col = "price_10kg"
    elif size_kg == 25:
        col = "price_25kg"
    else:
        raise HTTPException(status_code=400, detail="Invalid size_kg")

    cur = conn.execute(f"SELECT {col} FROM farms WHERE farm_id = ?", (farm_id,))
    row = cur.fetchone()

    if row is None or row[col] is None:
        raise HTTPException(status_code=400, detail="Price not set for this size")

    return int(row[col])
