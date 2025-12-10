# app_v2/customer_booking/api/reservations_api.py

import sqlite3
import json
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app_v2.customer_booking.dtos import (
    ReservationFormDTO,
    ReservationResultDTO,
    ReservationResultItemDTO,
)
from app_v2.customer_booking.utils.pickup_time_utils import (
    JST,
    compute_next_pickup,
)

# Swagger 上では "reservations_v2" というタグで表示
router = APIRouter(tags=["reservations_v2"])


# -------------------------
# 時刻ユーティリティ（JST）
# -------------------------


def _now_jst() -> datetime:
    return datetime.now(JST)


# -------------------------
# DB ヘルパー
# -------------------------


def get_db():
    con = sqlite3.connect("app.db")
    con.row_factory = sqlite3.Row
    return con


def fetch_price(con, farm_id: int, size_kg: int) -> int:
    """
    farms テーブルから価格を取得する。
    size_kg は 5 / 10 / 25 のいずれか。
    """
    cur = con.cursor()

    if size_kg == 5:
        col = "price_5kg"
    elif size_kg == 10:
        col = "price_10kg"
    elif size_kg == 25:
        col = "price_25kg"
    else:
        raise HTTPException(status_code=400, detail="Invalid size_kg")

    cur.execute(f"SELECT {col} FROM farms WHERE id = ?", (farm_id,))
    row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Farm not found")

    price = row[col]
    if price is None:
        raise HTTPException(status_code=400, detail="Price not set for this size")
    return int(price)


# -------------------------
# pickup_slot_code → next_pickup_deadline 解決
# -------------------------


def _resolve_next_pickup_deadline(pickup_slot_code: str) -> datetime:
    """
    pickup_slot_code（例: "WED_19_20"）と現在時刻から、
    共通ロジック compute_next_pickup により
    「次回スロットの deadline（開始3時間前）」を取得する。
    """
    if not pickup_slot_code or not pickup_slot_code.strip():
        raise HTTPException(status_code=400, detail="pickup_slot_code is required")

    now = _now_jst()
    # UI と同一ロジックで次回枠を決定
    _start_dt, deadline_dt = compute_next_pickup(now, pickup_slot_code.strip())
    return deadline_dt


# -------------------------
# POST /api/reservations
# -------------------------


@router.post("/reservations", response_model=ReservationResultDTO)
def create_reservation(payload: ReservationFormDTO):
    """
    Confirm Page → pending 予約を作成する API（V2）。

    - reservations テーブルには V2 用カラムだけを書き込む
      (pickup_slot_code, items_json, rice_subtotal, service_fee, currency, status, created_at)
    - V1 由来の item / quantity / amount などは一切触らない
    """

    if not payload.items:
        raise HTTPException(status_code=400, detail="No items specified")

    if not payload.pickup_slot_code or not payload.pickup_slot_code.strip():
        raise HTTPException(status_code=400, detail="pickup_slot_code is required")

    now = _now_jst()

    # -------------------------
    # ① クライアント側が見ていた deadline を優先チェック
    #    （Detail / Confirm を開いたときに決まっていた締切）
    # -------------------------
    client_deadline_iso = getattr(payload, "client_next_pickup_deadline_iso", None)
    if client_deadline_iso:
        try:
            client_deadline = datetime.fromisoformat(client_deadline_iso)
        except ValueError:
            # フォーマットがおかしい場合は 400 にしてしまう（安全側）
            raise HTTPException(
                status_code=400,
                detail="Invalid client_next_pickup_deadline_iso format",
            )

        # tz情報がなければ JST とみなす
        if client_deadline.tzinfo is None:
            client_deadline = client_deadline.replace(tzinfo=JST)
        else:
            client_deadline = client_deadline.astimezone(JST)

        if now >= client_deadline:
            # 「このConfirm画面は古いです。開き直してください」系のメッセージ
            raise HTTPException(
                status_code=409,
                detail=(
                    "この予約画面の有効期限が切れました。ページを開き直して、"
                    "最新の受け渡し日時でもう一度予約を行ってください。"
                ),
            )

    # -------------------------
    # ② サーバー側の共通ロジックでも締切をチェック
    #    （ここでは「今この瞬間に新規で予約を始めた場合」に使う締切）
    # -------------------------
    deadline = _resolve_next_pickup_deadline(payload.pickup_slot_code.strip())
    if now >= deadline:
        # 旧フロント（client_deadline なし）や、slot_code 改ざんなどもここで弾ける
        raise HTTPException(
            status_code=409,
            detail=(
                "今週分の予約受付は締め切りました。ページを開き直して、"
                "来週分の予約を行ってください。"
            ),
        )

    con = get_db()
    try:
        cur = con.cursor()

        service_fee = 300  # 運営サポート費
        items_detail = []  # ReservationResultItemDTO に変換するためのリスト
        rice_subtotal = 0

        # ---- 内訳（items_json）を構築しながら小計を計算 ----
        for item in payload.items:
            if item.quantity <= 0:
                raise HTTPException(status_code=400, detail="Quantity must be positive")

            unit_price = fetch_price(con, payload.farm_id, item.size_kg)
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

        # ---- items_json（保存用） ----
        items_json = json.dumps(items_detail, ensure_ascii=False)

        # ---- reservations に INSERT（pending, V2カラムのみ） ----
        cur.execute(
            """
            INSERT INTO reservations
            (
                user_id,
                farm_id,
                pickup_slot_code,
                items_json,
                rice_subtotal,
                service_fee,
                currency,
                status,
                created_at
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
            )
            """,
            (
                1,  # 当面 user_id=1 で固定運用
                payload.farm_id,
                payload.pickup_slot_code,
                items_json,
                rice_subtotal,
                service_fee,
                "jpy",
                "pending",
            ),
        )

        con.commit()
        reservation_id = cur.lastrowid

    finally:
        con.close()

    # ---- DTO形式で返す ----
    result_items_dto = [
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
        farm_id=payload.farm_id,
        items=result_items_dto,
        rice_subtotal=rice_subtotal,
        service_fee=service_fee,
        currency="jpy",
    )
