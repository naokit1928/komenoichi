// src/types/adminReservations.ts
// ⚠️ バックエンド admin_reservation_dtos.py の完全ミラー

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

  customer_user_id?: number | null;

  owner_last_name?: string | null;
  owner_first_name?: string | null;
  owner_last_kana?: string | null;
  owner_first_kana?: string | null;
  owner_postcode?: string | null;
  owner_address_line?: string | null;
  owner_phone?: string | null;

  pickup_start: string;   // datetime → ISO string
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

  notification_summary: NotificationStatusSummaryDTO;

  created_at: string;
  updated_at?: string | null;
}

export interface AdminReservationListResponse {
  items: AdminReservationListItemDTO[];
}
