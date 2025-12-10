// src/lib/stripe.ts
const API_BASE =
  import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

/** 予約を作成して reservation_id を返す */
export async function createReservation(params: {
  user_id: number;      // 当面はダミーでもOK（1など）
  farm_id: number;
  item: "5kg" | "10kg" | "25kg";
  quantity: number;
}) {
  const res = await fetch(`${API_BASE}/reservations/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`createReservation failed: ${res.status} ${t}`);
  }
  const data = await res.json();
  return Number(data?.reservation_id);
}

/** Stripe Checkout を開始して checkout_url を返す */
export async function startCheckout(reservationId: number) {
  const res = await fetch(`${API_BASE}/stripe/checkout/${reservationId}`, {
    method: "POST",
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`startCheckout failed: ${res.status} ${t}`);
  }
  const data = await res.json();
  const url = data?.checkout_url;
  if (!url) throw new Error("checkout_url not found");
  return String(url);
}
