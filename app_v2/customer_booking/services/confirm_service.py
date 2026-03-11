from __future__ import annotations

from datetime import datetime
import sqlite3
from fastapi import HTTPException

from app_v2.customer_booking.dtos import (
    ReservationFormDTO,
    ReservationResultDTO,
)
from app_v2.customer_booking.utils.pickup_time_utils import (
    JST,
    compute_next_pickup,
    parse_slot_code,               # ★ 追加
    format_event_display_label,    # ★ 追加
)
from app_v2.customer_booking.repository.confirm_repo import (
    create_pending_reservation,
)

class ConfirmService:
    SERVICE_FEE = 300
    CURRENCY = "jpy"

    def create_pending_reservation(
        self,
        payload: ReservationFormDTO,
        consumer_id: int,   
        conn: sqlite3.Connection | None = None,  
    ) -> ReservationResultDTO:

        now = self._now_jst()

        # 1. クライアント側の期限チェック
        self._check_client_deadline(
            now=now,
            client_deadline_iso=payload.client_next_pickup_deadline_iso,
        )

        # 2. サーバー側の期限チェック
        self._check_server_deadline(
            now=now,
            pickup_slot_code=payload.pickup_slot_code,
        )

        # =========================================================
        # 3. 表示文字列（pickup_display）のサーバー側再生成（改ざん防止）
        # =========================================================
        try:
            _, start_hour, end_hour = parse_slot_code(payload.pickup_slot_code)
            start_dt, _ = compute_next_pickup(now, payload.pickup_slot_code)
            end_dt = start_dt.replace(hour=end_hour)
            
            # サーバー側で計算した「正しい文字列」
            safe_pickup_display = format_event_display_label(start_dt, end_dt)
        except Exception:
            raise HTTPException(status_code=400, detail="不正な pickup_slot_code です")

        # 4. DBへの保存（上書きした safe_pickup_display を渡す）
        result = create_pending_reservation(
            farm_id=payload.farm_id,
            pickup_slot_code=payload.pickup_slot_code,
            pickup_display=safe_pickup_display,  # ★ フロントの値を捨てて上書き
            items=payload.items,
            service_fee=self.SERVICE_FEE,
            currency=self.CURRENCY,
            consumer_id=consumer_id,
            conn=conn,
        )

        return result

    def _now_jst(self) -> datetime:
        return datetime.now(JST)

    def _check_client_deadline(
        self,
        *,
        now: datetime,
        client_deadline_iso: str | None,
    ) -> None:
        if not client_deadline_iso:
            return

        try:
            client_deadline = datetime.fromisoformat(client_deadline_iso)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid client_next_pickup_deadline_iso format",
            )

        if client_deadline.tzinfo is None:
            client_deadline = client_deadline.replace(tzinfo=JST)
        else:
            client_deadline = client_deadline.astimezone(JST)

        if now >= client_deadline:
            raise HTTPException(
                status_code=409,
                detail="この予約画面の有効期限が切れました。",
            )

    def _check_server_deadline(
        self,
        *,
        now: datetime,
        pickup_slot_code: str,
    ) -> None:
        if not pickup_slot_code or not pickup_slot_code.strip():
            raise HTTPException(status_code=400, detail="pickup_slot_code is required")

        _start_dt, deadline_dt = compute_next_pickup(now, pickup_slot_code)

        if now >= deadline_dt:
            raise HTTPException(
                status_code=409,
                detail="申し訳ありません、この受取日時の予約受付は終了しました。",
            )