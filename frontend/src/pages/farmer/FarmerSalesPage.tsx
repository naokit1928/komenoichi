import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFarmerSales } from "./hooks/useFarmerSales";
import { formatYen } from "./FarmerReservationTable/hooks/useFarmerReservations";

export default function FarmerSalesPage() {
  const navigate = useNavigate();
  
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, loading, error } = useFarmerSales(year, month);

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  const isFutureMonth = 
    year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F9FAFB", paddingBottom: 80 }}>
      {/* ── ヘッダー ── */}
      <header style={{ display: "flex", alignItems: "center", padding: "16px", backgroundColor: "#FFFFFF", borderBottom: "1px solid #E5E7EB", position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: "0 8px 0 0", color: "#111827" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#111827", flex: 1, textAlign: "center", paddingRight: 32 }}>売上・予約履歴</h1>
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
        
        {/* ── 月切り替えナビゲーション ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <button onClick={handlePrevMonth} style={{ padding: 12, borderRadius: "50%", border: "1px solid #E5E7EB", background: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#374151" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111827", letterSpacing: "0.05em" }}>
            {year}年 {month}月
          </div>
          <button onClick={handleNextMonth} disabled={isFutureMonth} style={{ padding: 12, borderRadius: "50%", border: "1px solid #E5E7EB", background: "#FFFFFF", cursor: isFutureMonth ? "not-allowed" : "pointer", opacity: isFutureMonth ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#374151" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>

        {/* ── Airbnb風 巨大サマリーカード ── */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", border: "1px solid #E5E7EB", marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: "#6B7280", fontWeight: 600, marginBottom: 8 }}>{month}月の総売上</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", marginBottom: 16 }}>
            {loading ? "---" : formatYen(data?.total_sales ?? 0)}
          </div>
          <div style={{ display: "flex", gap: 16, borderTop: "1px solid #F3F4F6", paddingTop: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>販売重量</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{loading ? "-" : data?.total_kg ?? 0} <span style={{ fontSize: 14, fontWeight: 500 }}>kg</span></div>
            </div>
          </div>
        </div>

        {/* ── 免責事項 ── */}
        <div style={{ backgroundColor: "#F3F4F6", padding: "12px 16px", borderRadius: 12, fontSize: 13, color: "#4B5563", lineHeight: 1.6, marginBottom: 32 }}>
          ※事前にキャンセルされた予約は上記の金額から除外されていますが、連絡なく受け取りに来られなかった予約（無断キャンセル）分は含まれたままとなります。本画面の数字はあくまで「予約ベースの合計金額」であり、実際の現金売上とは異なる場合がありますのでご注意ください。
        </div>

        {/* ── 日別リスト ── */}
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 16 }}>受け渡し日ごとの内訳</h2>
        
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#6B7280" }}>読み込み中...</div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: 40, color: "#DC2626" }}>{error}</div>
        ) : !data?.daily_sales || data.daily_sales.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, backgroundColor: "#FFFFFF", borderRadius: 16, border: "1px dashed #D1D5DB", color: "#9CA3AF", fontSize: 15 }}>
            この月の受け渡し記録はありません。
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.daily_sales.map((day) => (
              <div key={day.date} style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: "16px 20px", border: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{day.display_date}</div>
                  <div style={{ fontSize: 13, color: "#6B7280" }}>{day.reservation_count}件の予約 • {day.kg}kg</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
                  {formatYen(day.sales)}
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}