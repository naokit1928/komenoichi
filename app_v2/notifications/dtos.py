from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


# ============================================================
# notification_jobs table DTO（DB事実）
# ============================================================

class NotificationJobDTO(BaseModel):
    """
    notification_jobs テーブル 1 行分を表す DTO。

    【設計原則】
    - DB に保存されている「事実」だけを表す
    - 送信先 / 文面 / UI 表示ロジックは一切含めない
    """

    job_id: Optional[int] = None

    reservation_id: int

    kind: Literal["CONFIRMATION", "REMINDER", "CANCEL_COMPLETED"]

    scheduled_at: datetime
    status: Literal["PENDING", "SENT", "FAILED"] = "PENDING"

    attempt_count: int = 0
    last_error: Optional[str] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ============================================================
# Notification Context DTO（LINE 文面生成専用）
# ============================================================

class NotificationContextDTO(BaseModel):
    """
    LINE 通知文面を組み立てるための最小 Context DTO。

    【設計原則】
    - notification_jobs（DB）とは独立
    - 「そのまま文面に出る情報」だけを持つ
    - UI / Web / cancel / token とは完全分離
    """

    # 識別子
    reservation_id: int

    # 受け渡し情報（文面用）
    pickup_display: str
    pickup_place_name: Optional[str] = None
    pickup_map_url: Optional[str] = None
    pickup_detail_memo: Optional[str] = None

    # 数量（文面用）
    qty_5: int = 0
    qty_10: int = 0
    qty_25: int = 0

    # ラベル（文面用）
    label_5kg: str = "5kg"
    label_10kg: str = "10kg"
    label_25kg: str = "25kg"

    # 金額・コード（文面用）
    rice_subtotal: int
    pickup_code: str

    # 送信先（Service が解決して渡す）
    customer_line_user_id: str
