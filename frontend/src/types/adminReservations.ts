// frontend/src/types/adminReservations.ts
export type NotificationStatusValue =
  | "DASH"
  | "NONE"
  | "PENDING"
  | "SENT"
  | "FAILED";

export interface NotificationStatusSummaryDTO {
  confirmation: NotificationStatusValue;
  reminder: NotificationStatusValue;
  cancel_completed: NotificationStatusValue;
}

export interface AdminReservationListItemDTO {
  reservation_id: number;
  farm_id: number;
  pickup_slot_code: string; 
  pickup_code: string; // ★ 追加

  customer_user_id?: number | null;

  consumer_email?: string | null;
  payment_intent_id?: string | null;
  payment_status?: string | null;
  confirm_session_id?: string | null;

  owner_last_name?: string | null;
  owner_first_name?: string | null;
  owner_last_kana?: string | null;
  owner_first_kana?: string | null;
  owner_postcode?: string | null;
  owner_address_line?: string | null;
  owner_phone?: string | null;
  owner_email?: string | null;

  pickup_start: string;
  pickup_end: string;
  pickup_display: string;

  pickup_place_name?: string | null;
  pickup_map_url?: string | null;
  pickup_detail_memo?: string | null;

  items_display: string;

  rice_subtotal: number;
  service_fee: number;
  total_amount: number;

  reservation_status: string;

  notification_summary?: NotificationStatusSummaryDTO;

  created_at: string;
  updated_at?: string | null;
}

export interface AdminReservationListResponse {
  items: AdminReservationListItemDTO[];
  total_count: number;
}

export interface AdminReservationWeekSummary {
  farm_id: number;
  pickup_slot_code: string;
  event_start: string;
  event_end: string;
  pickup_display: string;
  reservation_count: number;
  pending_count: number;
  confirmed_count: number;
  cancelled_count: number;
  rice_subtotal: number;
}

export interface AdminReservationWeekListResponse {
  items: AdminReservationWeekSummary[];
}

export interface AdminAlertsResponse {
  payment_anomalies: AdminReservationListItemDTO[];
  zombies: AdminReservationListItemDTO[];
}