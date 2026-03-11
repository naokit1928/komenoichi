import { useEffect, useState } from "react";
import { API_BASE } from "@/config/api";

/* =========================
   型定義
   ========================= */

export type EventMeta = {
  pickup_slot_code: string;
  pickup_display: string;
};

export type ReservationItem = {
  size_kg: number;
  quantity: number;
  unit_price: number | null;
  line_total: number | null;
};

export type ReservationRow = {
  reservation_id: number;
  pickup_code: string;
  created_at: string;
  rice_subtotal: number | null;
  items: ReservationItem[];
};

type SummaryItem = {
  size_kg: number;
  total_quantity: number;
  total_kg: number;
  rice_subtotal: number;
};

type BundleSummary = {
  items: SummaryItem[];
  total_rice_subtotal: number | null;
};

export type ExpandedReservationResponse = {
  ok?: boolean;
  event_meta: EventMeta | null;
  rows: ReservationRow[];
  bundle_summary?: BundleSummary | null;
};

export const SIZE_COLUMNS = [5, 10, 25] as const;

/* =========================
   ユーティリティ
   ========================= */

export function formatYen(
  value: number | string | null | undefined
): string {
  let num: number;

  if (typeof value === "number") {
    num = value;
  } else if (typeof value === "string") {
    const parsed = Number(value);
    num = Number.isNaN(parsed) ? 0 : parsed;
  } else {
    num = 0;
  }

  try {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `¥${num}`;
  }
}

function quantityForSizeFromRows(
  rows: Pick<ReservationRow, "items">[],
  sizeKg: number
): number {
  return rows.reduce((sum, row) => {
    const found = row.items.find((i) => i.size_kg === sizeKg);
    return sum + (found ? found.quantity : 0);
  }, 0);
}

function totalRiceSubtotalFromRows(rows: ReservationRow[]): number {
  return rows.reduce((sum, row) => {
    const v = typeof row.rice_subtotal === "number" ? row.rice_subtotal : 0;
    return sum + v;
  }, 0);
}

/* =========================
   Hook 本体
   ========================= */

// ★ offset（何週間ずらすか）を引数として受け取る
export function useFarmerReservations(offset: number = 0) {
  const [data, setData] = useState<ExpandedReservationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---------- Farmer データ取得 ---------- */
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // ★ クエリパラメータに offset を付与
        const res = await fetch(`${API_BASE}/reservations/expanded?offset=${offset}`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as ExpandedReservationResponse;

        if (!cancelled) {
          setData(json);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("fetch /reservations/expanded failed", e);
          setError(
            "予約一覧の取得に失敗しました。時間をおいて再度お試しください。"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [offset]); // ★ offset が変わるたびに再取得する

  /* ---------- 派生データ ---------- */

  const hasRows = !!data && Array.isArray(data.rows) && data.rows.length > 0;

  const totalBySize = SIZE_COLUMNS.map((size) => {
    if (!data || !hasRows) return 0;

    if (
      data.bundle_summary &&
      Array.isArray(data.bundle_summary.items) &&
      data.bundle_summary.items.length > 0
    ) {
      const found = data.bundle_summary.items.find((i) => i.size_kg === size);
      if (found) return found.total_quantity;
    }

    return quantityForSizeFromRows(data.rows, size);
  });

  const totalAmount =
    data && hasRows
      ? typeof data.bundle_summary?.total_rice_subtotal === "number"
        ? data.bundle_summary.total_rice_subtotal
        : totalRiceSubtotalFromRows(data.rows)
      : 0;

  return {
    data,
    loading,
    error,
    hasRows,
    totalBySize,
    totalAmount,
    formatYen,
  };
}