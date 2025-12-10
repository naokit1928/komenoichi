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
    owner_label: str           # "山田太郎さんのお米"
    owner_address_label: str   # "徳島県阿南市見能林の農家"
    owner_full_name: str       # "山田太郎"

    # 代表価格（10kg）
    price_10kg: int            # 税込価格（円）

    # 画像・PR
    face_image_url: HttpUrl
    pr_images: List[HttpUrl]   # PR画像（0枚以上・順序保持）
    pr_title: str              # PRタイトル（必須運用）

    # 受け渡しスロット
    pickup_slot_code: str      # 例: "WED_19_20"

    # 次回受け渡し日時（締切3時間前ルールを反映済み）
    next_pickup_display: str   # 例: "11/27（水）19:00–20:00"
    next_pickup_start: str     # ISO文字列 "2025-11-27T19:00:00+09:00"
    next_pickup_deadline: str  # ISO文字列 "2025-11-27T16:00:00+09:00"

    # 位置情報（地図ピン用）
    pickup_lat: float
    pickup_lng: float


class PublicFarmListResponse(BaseModel):
    """
    Public Farm List API のレスポンスラッパー
    """
    ok: bool = True
    page: int
    page_size: int
    total_count: int
    has_next: bool
    no_farms_within_100km: bool
    farms: List[PublicFarmCardDTO]


class PublicFarmDetailDTO(BaseModel):
    """
    農家詳細ページ（/farms/{farm_id}）専用の DTO。
    一覧カードと共通の項目 + 詳細ページ専用の追加情報をすべて含める。
    """

    # --- 基本識別子 ---
    farm_id: int

    # --- オーナー情報（表示用ラベル）---
    owner_full_name: str        # 例: "山田太郎"
    owner_label: str            # 例: "山田太郎さんのお米"
    owner_address_label: str    # 例: "徳島県阿南市見能林の農家"
    pickup_address_label: str   # 例: "徳島県徳島市伊月町付近の受け渡し場所"

    # --- 画像 ---
    face_image_url: HttpUrl     # 丸アイコン用
    cover_image_url: HttpUrl    # 詳細ページ上部カバー写真
    pr_images: List[HttpUrl]    # PR画像すべて（0枚以上・順序保持）

    # --- お米の情報 ---
    rice_variety_label: str     # 例: "コシヒカリ"
    harvest_year: int           # 例: 2025（公開条件を満たす想定なので int 固定）

    # --- 価格---
    price_5kg: int
    price_10kg: int
    price_25kg: int

    # --- PR テキスト ---
    pr_title: str               # PRタイトル（必須）
    pr_text: str                # PR本文（任意）

    # --- 受け渡しスロット / 次回日時 ---
    pickup_slot_code: str
    next_pickup_display: str
    next_pickup_start: str
    next_pickup_deadline: str

    # --- 受け渡し場所 ---
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
    items: List[ReservationItemInput]

    # ConfirmPage から送られてくる
    # 「画面を開いた時点での next_pickup_deadline（ISO文字列）」
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
    event_start: str
    event_end: str
    deadline: str
    grace_until: str
    display_label: str


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
# Reservation Cancel DTO（V2 正式版）
# ============================================================

class CancelPageResponse(BaseModel):
    """
    キャンセル確認ページ（GET）の返却 DTO  
    ※ 仕様書に基づき OK フラグは返さない（余計な情報禁止）。
    """
    reservation_id: int
    pickup_display: str
    qty_5: int
    qty_10: int
    qty_25: int
    rice_subtotal: int
    is_cancellable: bool


class CancelResultResponse(BaseModel):
    """
    キャンセル実行（POST）の返却 DTO  
    フロント側は固定メッセージを使用するため最小情報のみ返す。
    """
    ok: bool = True
    reservation_id: int

class LastConfirmedFarmResponse(BaseModel):
    ok: bool = True
    farm_id: Optional[int]
