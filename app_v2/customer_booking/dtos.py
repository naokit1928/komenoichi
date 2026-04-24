from typing import List, Literal, Optional
from pydantic import BaseModel, HttpUrl, conint, Field # ★ Field を追加しました

# ============================================================
# Public Farm List / Detail DTO
# ============================================================

class PublicFarmCardDTO(BaseModel):
    farm_id: int
    owner_label: str
    owner_address_label: str
    owner_full_name: str
    price_10kg: int
    face_image_url: HttpUrl
    pr_images: List[HttpUrl]
    pr_title: str
    pickup_slot_code: str
    next_pickup_display: str
    next_pickup_start: str
    next_pickup_deadline: str
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

class SnsLinkDTO(BaseModel):
    platform: str
    account_id: str
    display_label: str

class PublicFarmDetailDTO(BaseModel):
    farm_id: int
    owner_full_name: str
    owner_label: str
    owner_address_label: str
    pickup_address_label: str
    face_image_url: HttpUrl
    cover_image_url: HttpUrl
    pr_images: List[HttpUrl]
    sns_links: List[SnsLinkDTO] = Field(default_factory=list)
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
    is_accepting_reservations: bool = True

# ============================================================
# Confirm Page DTO
# ============================================================

class ReservationItemInput(BaseModel):
    size_kg: Literal[5, 10, 25]
    quantity: conint(ge=1)

class ReservationFormDTO(BaseModel):
    farm_id: int
    pickup_slot_code: str
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
    pickup_display: str
    event_end_at: str

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
    status: str

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
    reservation_id: int
    consumer_id: Optional[int] = None
    pickup_display: str
    pickup_place_name: Optional[str] = None
    pickup_map_url: Optional[str] = None
    pickup_detail_memo: Optional[str] = None
    qty_5: int = 0
    qty_10: int = 0
    qty_25: int = 0
    label_5kg: str
    label_10kg: str
    label_25kg: str
    rice_subtotal: int
    pickup_code: str
    cancel_token_exp: int
    cancel_token: Optional[str] = None
    farmer_phone: Optional[str] = None # ★ 追加

class BookingContextDTO(BaseModel):
    reservation_id: int
    pickup_display: str
    pickup_place_name: Optional[str] = None
    pickup_map_url: Optional[str] = None
    pickup_detail_memo: Optional[str] = None
    qty_5: int = 0
    qty_10: int = 0
    qty_25: int = 0
    label_5kg: str
    label_10kg: str
    label_25kg: str
    rice_subtotal: int
    pickup_code: str
    farmer_phone: Optional[str] = None # ★ 追加