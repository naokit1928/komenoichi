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

    設計原則：
    - 「管理者が一覧で把握したい情報」を 1 オブジェクトに集約
    - DB の生値をそのまま持たず、意味のある単位に整形済み
    """

    # --------------------------------------------------------
    # 識別子 / 紐付け
    # --------------------------------------------------------
    reservation_id: int
    farm_id: int

    # 予約者（consumer）
    customer_user_id: Optional[int] = None

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

    # --------------------------------------------------------
    # 受け渡し日時
    # --------------------------------------------------------
    pickup_start: datetime
    pickup_end: datetime
    pickup_display: str
    # 例: "12/10(水) 19:00–20:00"

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
    # 例: "10kg×1 / 5kg×1"

    # --------------------------------------------------------
    # 金額
    # --------------------------------------------------------
    rice_subtotal: int
    service_fee: int
    total_amount: int
    # rice_subtotal + service_fee（service 層で算出）

    # --------------------------------------------------------
    # 予約ステータス
    # --------------------------------------------------------
    reservation_status: str
    # reservations.status をそのまま使用
    # 例: "confirmed" / "cancelled"

    # --------------------------------------------------------
    # メタ情報
    # --------------------------------------------------------
    created_at: datetime
    updated_at: Optional[datetime] = None


__all__ = [
    "AdminReservationListItemDTO",
]
