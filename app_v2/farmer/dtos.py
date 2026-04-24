from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ============================================================
# Owner DTOs
#   Registration で確定した「オーナー情報」の正規形
#   ※ 新DBでは users / line_user への依存は廃止
# ============================================================


class OwnerDTO(BaseModel):
    """
    農家オーナーの固定情報（Registration 完了後は原則不変）。
    新DBでは users / line_user_id を保持しない。
    """

    owner_last_name: str = Field(..., description="姓（例: 山田）")
    owner_first_name: str = Field(..., description="名（例: 太郎）")

    owner_last_kana: str = Field(..., description="姓かな（例: やまだ）")
    owner_first_kana: str = Field(..., description="名かな（例: たろう）")

    owner_postcode: str = Field(..., description="郵便番号7桁（ハイフンなし）")
    owner_pref: str = Field(..., description="都道府県名")
    owner_city: str = Field(..., description="市区町村＋町域")
    owner_addr_line: str = Field(..., description="番地＋建物名")

    owner_phone: str = Field(..., description="携帯電話番号")


# ============================================================
# Farm / Pickup DTOs
# ============================================================


class FarmPickupDTO(BaseModel):
    farm_id: Optional[int] = Field(
        None,
        description="farm の主キー（Registration 完了後に確定）",
    )

    pickup_lat: float
    pickup_lng: float

    pickup_place_name: str
    pickup_notes: Optional[str] = None

    pickup_time: str = Field(
        ...,
        description='受け渡し時間スロット（例: "WED_19_20"）',
    )


class PickupStatusDTO(BaseModel):
    active_reservations_count: int
    can_edit_pickup: bool


class PickupSettingsResponseDTO(BaseModel):
    farm: FarmPickupDTO
    status: PickupStatusDTO


# ============================================================
# Farmer Settings DTOs
# ============================================================


class PRImageDTO(BaseModel):
    id: str
    url: str
    order: int

class SnsLinkDTO(BaseModel):
    platform: str
    account_id: str
    display_label: Optional[str] = None

class FarmerSettingsDTO(BaseModel):
    farm_id: int  # ★ ここを追加しました
    is_accepting_reservations: bool = False
    is_ready_to_publish: bool = False
    active_flag: int = 1

    rice_variety_label: Optional[str] = None
    pr_title: Optional[str] = None
    pr_text: Optional[str] = None

    price_10kg: Optional[int] = None
    price_5kg: Optional[int] = None
    price_25kg: Optional[int] = None

    face_image_url: Optional[str] = None
    cover_image_url: Optional[str] = None

    pr_images: List[PRImageDTO] = Field(default_factory=list)
    sns_links: List[SnsLinkDTO] = Field(default_factory=list)

    harvest_year: Optional[int] = None

    monthly_upload_bytes: int = 0
    monthly_upload_limit: int = 0
    next_reset_at: Optional[datetime] = None

    missing_fields: List[str] = Field(default_factory=list)
    thumbnail_url: Optional[str] = None


# ============================================================
# Reservations Export DTOs
# ============================================================


class ReservationBundleItemDTO(BaseModel):
    item: str
    quantity: int
    unit_price: int
    line_total: int


class ReservationExportRowDTO(BaseModel):
    reservation_id: int
    consumer_id: int
    farm_id: int
    status: str
    created_at: datetime

    bundle_items: List[ReservationBundleItemDTO] = Field(default_factory=list)

    pickup_code: str

    count_5kg: int = 0
    count_10kg: int = 0
    count_25kg: int = 0

    total_amount: int = 0


class ReservationsExportDTO(BaseModel):
    farm_id: int
    reservations: List[ReservationExportRowDTO] = Field(default_factory=list)


# ============================================================
# 共通レスポンス
# ============================================================


class OkResponse(BaseModel):
    ok: bool = True


class DataResponse(BaseModel):
    ok: bool = True
    data: dict = Field(default_factory=dict)

# ============================================================
# Farmer Sales DTOs（売上・予約履歴）
# ============================================================

class DailySalesDTO(BaseModel):
    date: str              # 例: "2026-03-04"
    display_date: str      # 例: "3月4日(水)"
    sales: int             # その日の合計売上
    kg: int                # その日の合計販売量
    reservation_count: int # 予約件数


class MonthlySalesResponseDTO(BaseModel):
    ok: bool = True
    year: int
    month: int
    total_sales: int
    total_kg: int
    daily_sales: List[DailySalesDTO] = Field(default_factory=list)