from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


# ============================================================
# 管理画面用：通知ステータスのサマリ
# ============================================================

class NotificationStatusSummaryDTO(BaseModel):
    """
    1つの予約に紐づく notification_jobs の状態を、
    通知種別ごとに「人間が判断しやすい粒度」でまとめた DTO。

    各フィールドは以下いずれかの値を取る：

    - "DASH"
        NotificationDomain の正式仕様として
        「そもそもジョブを作らないのが正しい」状態。
        例：
          - 48時間未満で確定した予約の REMINDER
          - 未キャンセル予約の CANCEL_COMPLETED

    - "NONE"
        本来ジョブが存在してもおかしくないのに、
        該当 kind のジョブが 1 件も存在しない状態。
        （異常・未生成・設計漏れの可能性）

    - "PENDING"
        PENDING のジョブが存在する（送信待ち）

    - "SENT"
        SENT のジョブが存在し、FAILED が存在しない

    - "FAILED"
        FAILED のジョブが 1 件以上存在する
    """

    confirmation: Literal["DASH", "NONE", "PENDING", "SENT", "FAILED"]
    reminder: Literal["DASH", "NONE", "PENDING", "SENT", "FAILED"]
    cancel_completed: Literal["DASH", "NONE", "PENDING", "SENT", "FAILED"]


# ============================================================
# 管理画面用：予約一覧の 1 行分 DTO
# ============================================================

class AdminReservationListItemDTO(BaseModel):
    """
    /admin/reservations 一覧の 1 行分（= 1 予約）を表す DTO。

    設計原則：
    - 「管理者が一覧で把握したい情報」を 1 オブジェクトに集約
    - DB の生値をそのまま持たず、意味のある単位に整形済み
    - notification の意味付けは NotificationStatusSummaryDTO に委譲
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
    # NotificationDomain と同一フォーマット

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
    # 通知ステータス（サマリ）
    # --------------------------------------------------------
    notification_summary: NotificationStatusSummaryDTO

    # --------------------------------------------------------
    # メタ情報
    # --------------------------------------------------------
    created_at: datetime
    updated_at: Optional[datetime] = None


__all__ = [
    "NotificationStatusSummaryDTO",
    "AdminReservationListItemDTO",
]
