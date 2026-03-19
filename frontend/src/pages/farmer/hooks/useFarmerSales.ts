import { useEffect, useState } from "react";
import { API_BASE } from "@/config/api";

export type DailySales = {
  date: string;
  display_date: string;
  sales: number;
  kg: number;
  reservation_count: number;
};

export type MonthlySalesResponse = {
  ok: boolean;
  year: number;
  month: number;
  total_sales: number;
  total_kg: number;
  daily_sales: DailySales[];
};

export function useFarmerSales(year: number, month: number) {
  const [data, setData] = useState<MonthlySalesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/farmer/sales?year=${year}&month=${month}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("売上データの取得に失敗しました");
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  return { data, loading, error };
}