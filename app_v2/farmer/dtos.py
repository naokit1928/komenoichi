# app_v2/farmer/dtos.py
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ============================================================
# Owner DTOs
#   Registration で確定した「オーナー情報」の正規形
#   organize_data.md / V2BluePrint.md に完全準拠
# ============================================================


class OwnerDTO(BaseModel):
    """
    農家オーナーの固定情報（Registration 完了後は原則不変）。
    """

    owner_user_id: int = Field(..., description="users.id に対応するオーナー ID")
    line_user_id: str = Field(..., description="紐づく LINE ユーザー ID")

    owner_last_name: str = Field(..., description="姓（例: 山田）")
    owner_first_name: str = Field(..., description="名（例: 太郎）")

    owner_last_kana: str = Field(..., description="姓かな（例: やまだ）")
    owner_first_kana: str = Field(..., description="名かな（例: たろう）")

    owner_postcode: str = Field(..., description="郵便番号7桁（ハイフンなしを基本とする）")
    owner_pref: str = Field(..., description="都道府県名（セレクト）")
    owner_city: str = Field(..., description="市区町村＋町域まで（UI そのまま）")
    owner_addr_line: str = Field(..., description="番地＋建物名（1フィールドに統合）")

    owner_phone: str = Field(..., description="携帯電話番号")


# ============================================================
# Farm / Pickup DTOs
#   Pickup Settings の本体となる Farm 情報
# ============================================================


class FarmPickupDTO(BaseModel):
    """
    Farm テーブルのうち、Pickup Settings で編集するカラムだけを表現。

    Registration の段階ではまだ farm_id が存在しないため、
    farm_id は Optional[int] とし、登録完了後の世界では必ず値が入る前提。
    """

    farm_id: Optional[int] = Field(
        None,
        description="farm の主キー（Registration 完了後は必ず値が入る）",
    )

    pickup_lat: float = Field(..., description="受け渡し場所の緯度")
    pickup_lng: float = Field(..., description="受け渡し場所の経度")

    pickup_place_name: str = Field(..., description="受け渡し場所の名称（自宅前の納屋 など）")
    pickup_notes: Optional[str] = Field(
        None,
        description="受け渡し補足メモ（駐車場の案内など。空でも可）",
    )

    # 将来スロット構成を変えられるよう str としておく（Enum で固定しない）
    pickup_time: str = Field(
        ...,
        description='受け渡し時間スロット（例: "WED_19_20" など）',
    )


class PickupStatusDTO(BaseModel):
    """
    Pickup Settings 画面専用の「今週の予約状態」。
    """

    active_reservations_count: int = Field(
        ...,
        description="今週の有効な予約件数（キャンセル除く）",
    )
    can_edit_pickup: bool = Field(
        ...,
        description="場所・時間を編集可能かどうか（400m ルール＆予約有無で決定）",
    )


class PickupSettingsResponseDTO(BaseModel):
    """
    Pickup Settings Page 用 API レスポンス。
    farm 本体の情報 + 今週の予約状態のセット。
    """

    farm: FarmPickupDTO
    status: PickupStatusDTO


# ============================================================
# Farmer Settings DTOs
#   公開プロフィール / 価格 / 画像など
#   「編集可能」と「自動計算」を同じ DTO にフラットに保持
# ============================================================


class PRImageDTO(BaseModel):
    """
    PR 画像 1枚分。
    Cloudinary 等のストレージ上の ID と URL を保持し、order で並び順を制御。
    """

    id: str = Field(..., description="ストレージ上の public_id など")
    url: str = Field(..., description="画像のフル URL")
    order: int = Field(..., description="表示順。0 が最優先")


class FarmerSettingsDTO(BaseModel):
    """
    Farmer Settings Page で扱う設定＋派生情報のフルスナップショット。
    organize_data.md / V2BluePrint の仕様に従い、
    表示優先度・意味ごとにフィールドを整理した。
    """

    # ========================================================
    # ★ 最重要フラグ（UI の ON/OFF 判定で最初に見る項目）
    # ========================================================
    is_accepting_reservations: bool = Field(
        False,
        description="予約受付 ON/OFF（公開条件を満たしている場合のみ ON 許可）",
    )
    is_ready_to_publish: bool = Field(
        False,
        description="公開に必要な最低条件が揃っているか",
    )
    active_flag: int = Field(
        1,
        description="BAN 用マスタースイッチ。1=通常, 0=BAN（運営用・UIでは非表示）",
    )

    # ========================================================
    # ★ テキスト情報（農家の基本情報・紹介）
    # ========================================================
    rice_variety_label: Optional[str] = Field(
        None,
        description="品種ラベル（例: コシヒカリ）。未設定なら None",
    )

    pr_title: Optional[str] = Field(
        None,
        description="PRタイトル（公開ページのキャッチコピー）",
    )
    pr_text: Optional[str] = Field(
        None,
        description="PR本文（長めの紹介文）",
    )

    # ========================================================
    # ★ 価格（10kg を基準に 5kg/25kg は自動計算）
    # ========================================================
    price_10kg: Optional[int] = Field(
        None,
        description="10kg の販売価格（円）",
    )
    price_5kg: Optional[int] = Field(
        None,
        description="5kg の価格（自動計算）",
    )
    price_25kg: Optional[int] = Field(
        None,
        description="25kg の価格（自動計算）",
    )

    # ========================================================
    # ★ URL 系（1枚画像：顔／カバー）
    # ========================================================
    face_image_url: Optional[str] = Field(
        None,
        description="顔写真の URL（公開条件では必須扱い）",
    )
    cover_image_url: Optional[str] = Field(
        None,
        description="カバー画像の URL（公開条件では必須扱い）",
    )

    # ========================================================
    # ★ 複数 PR 画像（order付き）
    # ========================================================
    pr_images: List[PRImageDTO] = Field(
        default_factory=list,
        description="PR画像の配列（order で並び順を制御）",
    )

    # ========================================================
    # ★ 自動計算系（UI からは編集不可）
    # ========================================================
    harvest_year: Optional[int] = Field(
        None,
        description="収穫年度。9–12月→当年、1–8月→前年で自動算出",
    )

    monthly_upload_bytes: int = Field(
        0,
        description="当月アップロード済みバイト数合計",
    )
    monthly_upload_limit: int = Field(
        0,
        description="月間アップロード上限バイト数",
    )
    next_reset_at: Optional[datetime] = Field(
        None,
        description="アップロードリセット日時",
    )

    missing_fields: List[str] = Field(
        default_factory=list,
        description="is_ready_to_publish=False の場合、何が不足しているかの一覧",
    )

    thumbnail_url: Optional[str] = Field(
        None,
        description="一覧ページ用サムネイル URL（自動生成）",
    )


# ============================================================
# Reservations Export DTOs
#   「当日の予約一覧」画面で使う構造
# ============================================================


class ReservationBundleItemDTO(BaseModel):
    """
    予約 1件の中に含まれる「商品別数量」の1行分。
    5kg / 10kg / 25kg などの単位で集計された情報。
    """

    item: str = Field(..., description='商品種別（例: "5kg", "10kg", "25kg"）')
    quantity: int = Field(..., description="個数")
    unit_price: int = Field(..., description="その商品の単価（予約時点の価格）")
    line_total: int = Field(..., description="小計（quantity × unit_price）")


class ReservationExportRowDTO(BaseModel):
    """
    Export 用に整形された「予約 1件分」の情報。
    テーブル 1行 + モーダル詳細に必要なデータをすべて含む。
    """

    # --- コア情報（内部的に保持される） -------------------

    reservation_id: int = Field(..., description="内部予約ID（DBの主キー）")
    user_id: int = Field(..., description="予約したユーザーのID")
    farm_id: int = Field(..., description="対象農家のID")
    status: str = Field(..., description='予約ステータス（例: "confirmed", "canceled"）')
    created_at: datetime = Field(..., description="予約作成日時")

    bundle_items: List[ReservationBundleItemDTO] = Field(
        default_factory=list,
        description="5kg / 10kg / 25kg などの商品別集計",
    )

    # --- Export 表示用の派生データ ------------------------

    pickup_code: str = Field(
        ...,
        description="受け渡し時に使う4桁PIN（v2ではランダム4桁を一度生成して保存）",
    )

    count_5kg: int = Field(
        0,
        description="5kg の合計数量（table の表示用）",
    )
    count_10kg: int = Field(
        0,
        description="10kg の合計数量（table の表示用）",
    )
    count_25kg: int = Field(
        0,
        description="25kg の合計数量（table の表示用）",
    )

    total_amount: int = Field(
        0,
        description="予約全体の合計金額（円）",
    )


class ReservationsExportDTO(BaseModel):
    """
    Reservations Export ページ用のレスポンスルート。
    1農家・指定条件に対する予約一覧をまとめる。
    """

    farm_id: int = Field(..., description="対象の farm_id")
    reservations: List[ReservationExportRowDTO] = Field(
        default_factory=list,
        description="整形済みの予約行一覧",
    )


# ============================================================
# 共通レスポンスラッパ
# ============================================================


class OkResponse(BaseModel):
    ok: bool = True


class DataResponse(BaseModel):
    ok: bool = True
    data: dict = Field(default_factory=dict)
