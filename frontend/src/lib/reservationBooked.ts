// frontend/src/lib/reservationBooked.ts

// ---- 型定義 ----

export type ReservationBookedContext = {
  reservation_id: number;
  farm_id: number;
  customer_line_user_id: string;
  pickup_display: string;
  pickup_place_name: string | null;
  pickup_map_url: string | null;
  pickup_detail_memo: string | null;
  pickup_code: string | null;
  qty_5: number;
  qty_10: number;
  qty_25: number;
  subtotal_5: number;
  subtotal_10: number;
  subtotal_25: number;
  rice_subtotal: number;
  label_5kg: string;
  label_10kg: string;
  label_25kg: string;
  cancel_token_exp: number;
  cancel_base_url: string;
};

export type ReservationBookedResponse = {
  reservation_id: number;
  context: ReservationBookedContext;
  confirmation_text: string;
  cancel_template_json: {
    type: string;
    altText: string;
    template: {
      type: string;
      text: string;
      actions: {
        type: string;
        label: string;
        uri: string;
      }[];
    };
  };
  reminder_text: string | null;
  event_start: string;
  confirmed_at: string;
};

// ---- API 呼び出し ----

export async function fetchReservationBooked(
  reservationId: number
): Promise<ReservationBookedResponse> {
  const res = await fetch(
    `/api/reservations/booked?reservation_id=${reservationId}`
  );

  if (!res.ok) {
    throw new Error("予約の取得に失敗しました");
  }

  const data = await res.json();
  return data as ReservationBookedResponse;
}
