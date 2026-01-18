from typing import List, Literal, Optional
from pydantic import BaseModel, HttpUrl, conint

# ============================================================
# Public Farm List / Detail DTO
# ============================================================

class PublicFarmCardDTO(BaseModel):
    """
    農家一覧ページ / 地図モーダル共通のカードDTO
    （Public Farm List 用）
    """
    farm_id: int

    # 表示ラベル
    owner_label: str
    owner_address_label: str
    owner_full_name: str

    # 代表価格（10kg）
    price_10kg: int

    # 画像・PR
    face_image_url: HttpUrl
    pr_images: List[HttpUrl]
    pr_title: str

    # 受け渡しスロット
    pickup_slot_code: str

    # 次回受け渡し日時
    next_pickup_display: str
    next_pickup_start: str
    next_pickup_deadline: str

    # 位置情報
    pickup_lat: float
    pickup_lng: float


class PublicFarmListResponse(BaseModel):
    ok: bool = True
    page: int
    page_size: int
    total_count: int
    has_next: bool
    no_farms_within_100km: bool
    farms: List[PublicFarmCardDTO]


class PublicFarmDetailDTO(BaseModel):
    farm_id: int

    owner_full_name: str
    owner_label: str
    owner_address_label: str
    pickup_address_label: str

    face_image_url: HttpUrl
    cover_image_url: HttpUrl
    pr_images: List[HttpUrl]

    rice_variety_label: str
    harvest_year: int

    price_5kg: int
    price_10kg: int
    price_25kg: int

    pr_title: str
    pr_text: str

    pickup_slot_code: str
    next_pickup_display: str
    next_pickup_start: str
    next_pickup_deadline: str

    pickup_place_name: str
    pickup_notes: str
    pickup_lat: float
    pickup_lng: float


# ============================================================
# Confirm Page DTO
# ============================================================

class ReservationItemInput(BaseModel):
    size_kg: Literal[5, 10, 25]
    quantity: conint(ge=1)


class ReservationFormDTO(BaseModel):
    farm_id: int
    pickup_slot_code: str

    # ★ 追加：Confirmでconsumerが同意した表示用日時（JST文字列）
    pickup_display: str

    items: List[ReservationItemInput]
    client_next_pickup_deadline_iso: Optional[str] = None


class ReservationResultItemDTO(BaseModel):
    size_kg: Literal[5, 10, 25]
    quantity: int
    unit_price: int
    subtotal: int


class ReservationResultDTO(BaseModel):
    reservation_id: int
    farm_id: int
    items: List[ReservationResultItemDTO]
    rice_subtotal: int
    service_fee: int
    currency: str = "jpy"


# ============================================================
# Export Page V2 DTO
# ============================================================

class ExportEventMetaDTO(BaseModel):
    pickup_slot_code: str

    # ★ 表示の正：Confirmでユーザーが同意した文字列のみ
    pickup_display: str



class ExportReservationItemDTO(BaseModel):
    size_kg: int
    quantity: int
    unit_price: int
    line_total: int


class ExportReservationRowDTO(BaseModel):
    reservation_id: int
    pickup_code: str
    created_at: str
    items: List[ExportReservationItemDTO]
    rice_subtotal: int


class ExportBundleItemSummaryDTO(BaseModel):
    size_kg: int
    total_quantity: int
    total_kg: int
    rice_subtotal: int


class ExportBundleSummaryDTO(BaseModel):
    items: List[ExportBundleItemSummaryDTO]
    total_rice_subtotal: int


class ExportReservationsResponseDTO(BaseModel):
    ok: bool
    event_meta: Optional[ExportEventMetaDTO]
    rows: List[ExportReservationRowDTO]
    bundle_summary: ExportBundleSummaryDTO


# ============================================================
# Reservation Cancel DTO（V2）
# ============================================================

class CancelPageResponse(BaseModel):
    reservation_id: int
    pickup_display: str
    qty_5: int
    qty_10: int
    qty_25: int
    rice_subtotal: int
    is_cancellable: bool


class CancelResultResponse(BaseModel):
    ok: bool = True
    reservation_id: int


class LastConfirmedFarmResponse(BaseModel):
    ok: bool = True
    farm_id: Optional[int]


# ============================================================
# Reservation Context DTO（ReservationBooked / Web Cancel 用）
# ============================================================

class ReservationContextDTO(BaseModel):
    """
    ReservationBooked ページおよび Web キャンセル導線専用の Context DTO
    """

    reservation_id: int
    consumer_id: Optional[int] = None

    # 表示用
    pickup_display: str
    pickup_place_name: Optional[str] = None
    pickup_map_url: Optional[str] = None
    pickup_detail_memo: Optional[str] = None

    # 数量
    qty_5: int = 0
    qty_10: int = 0
    qty_25: int = 0

    # ラベル
    label_5kg: str
    label_10kg: str
    label_25kg: str

    # 金額・コード
    rice_subtotal: int
    pickup_code: str

    # キャンセル
    cancel_token_exp: int
    cancel_token: Optional[str] = None


class BookingContextDTO(BaseModel):
    """
    ReservationBooked（予約完了ページ）専用 Context DTO
    - 表示専用（副作用ゼロ）
    """

    reservation_id: int

    # 表示用
    pickup_display: str
    pickup_place_name: Optional[str] = None
    pickup_map_url: Optional[str] = None
    pickup_detail_memo: Optional[str] = None

    # 数量
    qty_5: int = 0
    qty_10: int = 0
    qty_25: int = 0

    # ラベル
    label_5kg: str
    label_10kg: str
    label_25kg: str

    # 金額・コード
    rice_subtotal: int
    pickup_code: str
