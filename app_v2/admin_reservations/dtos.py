# app_v2/admin_reservations/dtos.py

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


# 管理画面用：通知ステータスのサマリ
class NotificationStatusSummaryDTO(BaseModel):
    """
    1つの予約に紐づく通知ジョブ(line_notification_jobs)の状態を、
    種類ごとにざっくりまとめたDTO。

    値は以下の5種類のいずれか:
      - "NONE"     : 該当kindのジョブが1件も存在しない（本来あるべきなのに無い場合は異常）
      - "PENDING"  : PENDING のジョブが存在する（まだ送信待ち）
      - "SENT"     : SENT のジョブが存在し、FAILED は存在しない
      - "FAILED"   : FAILED のジョブが1件以上存在する
      - "DASH"     : NotificationDomainV2 の仕様上「ジョブを作らないのが正しい」ケース
                     （例：48時間未満のリマインダーや未キャンセル予約のキャンセル完了など）
    """

    confirmation: Literal["NONE", "PENDING", "SENT", "FAILED", "DASH"]
    reminder: Literal["NONE", "PENDING", "SENT", "FAILED", "DASH"]
    cancel_template: Literal["NONE", "PENDING", "SENT", "FAILED", "DASH"]
    cancel_completed: Literal["NONE", "PENDING", "SENT", "FAILED", "DASH"]


class AdminReservationListItemDTO(BaseModel):
    """
    /admin/reservations 一覧の1行分（= 1予約）を表すDTO。

    ポイント:
      - 「タイムラインとして眺めたい情報」を1つにまとめる
      - API としては詳細情報も含むが、UI側はそのうち一部だけを一覧カラムに使う
      - 新しい DB カラムや V1 由来の概念は一切導入しない
    """

    # --- 識別子 / 紐付け ---
    reservation_id: int  # reservations.id
    farm_id: int         # reservations.farm_id

    # 予約者（customer）の紐付け
    # いったん Optional にしておき、service/repo 実装後に必須扱いにしてもよい。
    customer_user_id: Optional[int] = None  # reservations.user_id

    # --- 農家オーナー情報（Registration 由来） ---
    # Registration / OwnerDTO のフィールドに対応。UI側でフルネーム/ふりがなを組み立てる想定。
    owner_last_name: Optional[str] = None
    owner_first_name: Optional[str] = None
    owner_last_kana: Optional[str] = None
    owner_first_kana: Optional[str] = None
    owner_postcode: Optional[str] = None
    owner_address_line: Optional[str] = None

    # --- 受け渡し日時 ---
    pickup_start: datetime  # 受け渡し開始
    pickup_end: datetime    # 受け渡し終了
    pickup_display: str     # 例: "12/10(水) 19:00–20:00"（NotificationDomainと同一フォーマット）

    # --- 受け渡し場所情報（NotificationDomain と同一ロジック） ---
    # NotificationContextDTO と同じ名前にして、ロジックの再利用をしやすくする。
    pickup_place_name: Optional[str] = None
    pickup_map_url: Optional[str] = None
    pickup_detail_memo: Optional[str] = None

    # --- 内容（お米の内訳の表示用） ---
    items_display: str      # 例: "10kg×1 / 5kg×1"（rice_items_displayと同一ロジック）

    # --- 金額 ---
    rice_subtotal: int      # お米代の合計（現地払い）
    service_fee: int        # Stripeで決済する運営サポート費
    total_amount: int       # rice_subtotal + service_fee（サービス層で計算）

    # --- 予約ステータス ---
    reservation_status: str  # reservations.status（"pending" / "confirmed" / "cancelled" など）

    # --- 通知ステータス（ざっくりサマリ） ---
    notification_summary: NotificationStatusSummaryDTO

    # --- メタ情報 ---
    created_at: datetime
    updated_at: Optional[datetime] = None


__all__ = [
    "NotificationStatusSummaryDTO",
    "AdminReservationListItemDTO",
]
