// frontend/src/types/adminReservations.ts

// --- 通知サマリ DTO ---
// app_v2/admin_reservations/dtos.py: NotificationStatusSummaryDTO に対応
export type NotificationStatusValue = "NONE" | "PENDING" | "SENT" | "FAILED";

export interface NotificationStatusSummaryDTO {
  confirmation: NotificationStatusValue;
  reminder: NotificationStatusValue;
  cancel_template: NotificationStatusValue;
  cancel_completed: NotificationStatusValue;
}

// --- /api/admin/reservations (一覧1件分) ---
// app_v2/admin_reservations/dtos.py: AdminReservationListItemDTO に対応
export interface AdminReservationListItemDTO {
  // 識別子 / 紐付け
  reservation_id: number;
  farm_id: number;

  // 予約者（customer）
  // Python 側では Optional[int] = None なので、TS 側も optional にしておく
  customer_user_id?: number;

  // 農家オーナー情報（Registration 由来）
  // OwnerDTO のフィールドに対応。UI 側でフルネーム/ふりがなを組み立てる想定。
  owner_last_name?: string;
  owner_first_name?: string;
  owner_last_kana?: string;
  owner_first_kana?: string;
  owner_postcode?: string;
  owner_address_line?: string;

  // 受け渡し日時（JSONでは ISO 文字列）
  pickup_start: string;
  pickup_end: string;
  pickup_display: string;

  // 受け渡し場所情報（NotificationDomain と同一ロジック）
  pickup_place_name?: string;
  pickup_map_url?: string;
  pickup_detail_memo?: string;

  // 内容（お米の内訳表示用）
  items_display: string;

  // 金額
  rice_subtotal: number;
  service_fee: number;
  total_amount: number;

  // 予約ステータス（"pending" / "confirmed" / "cancelled" など）
  reservation_status: string;

  // 通知ステータス（ざっくりサマリ）
  notification_summary: NotificationStatusSummaryDTO;

  // メタ情報
  created_at: string;
  updated_at: string;
}

// /api/admin/reservations のレスポンス全体
export interface AdminReservationListResponse {
  items: AdminReservationListItemDTO[];
  total_count: number;
}

// --- /api/admin/reservations/weeks (週ごとの受け渡し回サマリ1件分) ---
// app_v2/admin_reservations/admin_reservation_api.py: AdminReservationWeekSummary に対応
export interface AdminReservationWeekSummary {
  farm_id: number;
  pickup_slot_code: string;

  // 実際の受け渡し日時（ISO文字列）
  event_start: string;
  event_end: string;

  // 表示用ラベル（例: "12月10日（水）19:00〜20:00"）
  pickup_display: string;

  // 件数・ステータス別件数
  reservation_count: number;
  pending_count: number;
  confirmed_count: number;
  cancelled_count: number;

  // 合計金額（お米部分のみ）
  rice_subtotal: number;
}

// /api/admin/reservations/weeks のレスポンス全体
export interface AdminReservationWeekListResponse {
  items: AdminReservationWeekSummary[];
}
