from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


class LineNotificationJobDTO(BaseModel):
    """
    line_notification_jobs テーブル 1行分を表す DTO。
    Repository から dict を受け取り、Service 層で利用する想定。
    """

    id: Optional[int] = None
    reservation_id: int
    farm_id: int
    customer_line_user_id: str
    kind: Literal["CONFIRMATION", "REMINDER"]
    scheduled_at: datetime
    status: Literal["PENDING", "SENDING", "SENT", "FAILED"] = "PENDING"
    message_text: str
    attempt_count: int = 0
    last_error: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class NotificationContextDTO(BaseModel):
    """
    予約確定メッセージ / リマインダーの文面を組み立てるための元データ。

    - reservations / farms / users などから集約したものを保持し、
      LineMessageBuilder がこの DTO だけを見てテキストを生成する。
    """

    # 予約・農家・ユーザー
    reservation_id: int
    farm_id: int
    customer_line_user_id: str

    # 受け渡し情報
    pickup_display: str           # 「4/5(金) 18:00〜19:00」などの表示用文字列
    pickup_place_name: str        # 受け渡し場所名
    pickup_map_url: str           # Google Maps の URL
    pickup_detail_memo: Optional[str] = None  # 補足メモ（任意）
    pickup_code: str              # 4桁の予約コード

    # 個数・金額
    qty_5: int
    qty_10: int
    qty_25: int
    subtotal_5: int
    subtotal_10: int
    subtotal_25: int
    rice_subtotal: int            # お米代合計

    # ラベル（将来 3kg / 8kg など増えてもここを変えればよい）
    label_5kg: str = "5kg"
    label_10kg: str = "10kg"
    label_25kg: str = "25kg"

    # キャンセルリンク用
    # 「注文締切＝イベント開始の3時間前」の Unix秒をそのまま格納する。
    cancel_token_exp: Optional[int] = None
    # 基本はデフォルトURLを使うが、将来ホスト名を変えたい場合に上書きできるようにしておく。
    cancel_base_url: Optional[str] = None


class LineMessagePayloadDTO(BaseModel):
    """
    文面ビルダーが組み立てた最終テキストを表す DTO。
    将来、rich message（Flex など）を使いたくなった場合にも拡張しやすくする。
    """

    text: str
