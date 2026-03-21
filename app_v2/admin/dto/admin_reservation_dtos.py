# app_v2/admin/dto/admin_reservation_dtos.py
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ============================================================
# 管理画面用：予約一覧の 1 行分 DTO
# ============================================================

class AdminReservationListItemDTO(BaseModel):
    """
    /admin/reservations 一覧の 1 行分（= 1 予約）を表す DTO。
    """

    # --------------------------------------------------------
    # 識別子 / 紐付け
    # --------------------------------------------------------
    reservation_id: int
    farm_id: int
    pickup_slot_code: str
    pickup_code: str  # ★ 追加：正しい4桁の受渡番号

    # 予約者（consumer）
    customer_user_id: Optional[int] = None
    
    # 追跡用データ
    consumer_email: Optional[str] = None
    payment_intent_id: Optional[str] = None
    payment_status: Optional[str] = None
    confirm_session_id: Optional[str] = None

    # --------------------------------------------------------
    # 農家オーナー情報
    # --------------------------------------------------------
    owner_last_name: Optional[str] = None
    owner_first_name: Optional[str] = None
    owner_last_kana: Optional[str] = None
    owner_first_kana: Optional[str] = None
    owner_postcode: Optional[str] = None
    owner_address_line: Optional[str] = None
    owner_phone: Optional[str] = None
    owner_email: Optional[str] = None

    # --------------------------------------------------------
    # 受け渡し日時
    # --------------------------------------------------------
    pickup_start: datetime
    pickup_end: datetime
    pickup_display: str

    # --------------------------------------------------------
    # 受け渡し場所情報
    # --------------------------------------------------------
    pickup_place_name: Optional[str] = None
    pickup_map_url: Optional[str] = None
    pickup_detail_memo: Optional[str] = None

    # --------------------------------------------------------
    # 予約内容（一覧表示用に整形済み）
    # --------------------------------------------------------
    items_display: str

    # --------------------------------------------------------
    # 金額
    # --------------------------------------------------------
    rice_subtotal: int
    service_fee: int
    total_amount: int

    # --------------------------------------------------------
    # 予約ステータス
    # --------------------------------------------------------
    reservation_status: str

    # --------------------------------------------------------
    # メタ情報
    # --------------------------------------------------------
    created_at: datetime
    updated_at: Optional[datetime] = None


__all__ = [
    "AdminReservationListItemDTO",
]