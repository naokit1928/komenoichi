// frontend/src/lib/reservationBooked.ts

export type ReservationBookedResponse = {
  reservation_id: number;
  reservation_status: string;
  context: {
    pickup_display: string;
    pickup_place_name?: string;
    pickup_map_url?: string;
    pickup_detail_memo?: string;

    qty_5: number;
    qty_10: number;
    qty_25: number;

    label_5kg: string;
    label_10kg: string;
    label_25kg: string;

    rice_subtotal: number;
    pickup_code: string;

    cancel_token?: string;
  };
  is_expired_for_display?: boolean;
};

const API_BASE = import.meta.env.VITE_API_BASE;

// ============================================================
// 既存互換：reservation_id 指定版（残す）
// GET /api/reservations/booked?reservation_id=xx
// ============================================================

export async function fetchReservationBooked(
  reservationId: number
): Promise<ReservationBookedResponse> {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE is not defined");
  }

  const res = await fetch(
    `${API_BASE}/api/reservations/booked?reservation_id=${reservationId}`,
    {
      credentials: "include",
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to fetch reservation booked: ${res.status} ${text}`
    );
  }

  return res.json();
}

// ============================================================
// 新正式：consumer セッション基点版
// GET /api/reservations/booked/me
// ============================================================

export async function fetchReservationBookedMe(): Promise<ReservationBookedResponse> {
  if (!API_BASE) {
    throw new Error("VITE_API_BASE is not defined");
  }

  const res = await fetch(
    `${API_BASE}/api/reservations/booked/me`,
    {
      credentials: "include",
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to fetch my reservation booked: ${res.status} ${text}`
    );
  }

  return res.json();
}
