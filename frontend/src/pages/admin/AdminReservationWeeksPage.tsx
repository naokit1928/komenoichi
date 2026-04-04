// frontend/src/pages/admin/AdminReservationWeeksPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE } from "@/config/api";
import type { AdminReservationWeekSummary, AdminReservationWeekListResponse } from "../../types/adminReservations";

// ── Brand tokens ──
const C = {
  ink:       "#0f172a",
  ink2:      "#334155",
  ink3:      "#475569",
  border:    "#cbd5e1",
  bg:        "#f8fafc",
  cardBg:    "#ffffff",
  red:       "#dc2626",
  redLight:  "#fef2f2",
  redBorder: "#fecaca",
  focus:     "#0f172a",
  barChart:  "#94a3b8",
  statusGreen: "#10B981", 
  statusGray:  "#94A3B8", 
} as const;

const formatNumber = (n: number) => new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(n);

const getCancelRateStyle = (rate: number | null): React.CSSProperties => {
  if (rate == null) return { color: C.ink3 };
  if (rate >= 30) return { color: C.red, fontWeight: 700 };
  if (rate >= 10) return { color: C.ink, fontWeight: 700 };
  return { color: C.ink2 };
};

type FarmDetailData = {
  farm_id: number;
  owner_full_name: string;
  owner_full_kana: string;
  owner_email: string;
  owner_phone: string;
  owner_address_line: string;
  first_reservation_at?: string;
  total_confirmed_6m?: number;
  total_cancelled_6m?: number;
  total_sales_6m?: number;
  net_active_hours?: number;
  is_public?: number;
  is_accepting_reservations?: number;
  active_flag?: number;
  cancel_count_a?: number;
  cancel_count_b?: number;
};

// ★ 新しい属性（emergency_cancel_reason）を含めるように型を拡張
type ExtendedWeekSummary = AdminReservationWeekSummary & {
  emergency_cancel_reason?: "A" | "B" | null;
};

// ★ カウント表示用バッジコンポーネント
const CancelCountBadges: React.FC<{ countA: number, countB: number, showWarning?: boolean }> = ({ countA, countB, showWarning }) => (
  <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
    {showWarning && (
      <span style={{ fontSize: 10, fontWeight: 700, color: C.red, background: "#fff", border: `1px solid ${C.redBorder}`, padding: "1px 4px", borderRadius: 4 }}>
        ⚠️要注意
      </span>
    )}
    <div style={{ display: "flex", alignItems: "center", gap: 3, background: "#fff", border: `1px solid ${C.border}`, padding: "1px 5px", borderRadius: 4 }}>
      <span style={{ fontSize: 9, color: C.ink3, fontWeight: 700 }}>災害</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: C.ink }}>{countA}</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 3, background: countB > 0 ? C.redLight : "#fff", border: `1px solid ${countB > 0 ? C.redBorder : C.border}`, padding: "1px 5px", borderRadius: 4 }}>
      <span style={{ fontSize: 9, color: countB > 0 ? C.red : C.ink3, fontWeight: 700 }}>自己都合</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: countB > 0 ? C.red : C.ink }}>{countB}</span>
    </div>
  </div>
);


const AdminReservationWeeksPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const farmIdParam = searchParams.get("farm_id");
  const farmId = farmIdParam ? Number(farmIdParam) : null;
  
  const [weeks, setWeeks] = useState<ExtendedWeekSummary[]>([]);
  const [farmData, setFarmData] = useState<FarmDetailData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!farmId) return;
    const controller = new AbortController();
    
    const fetchAll = async () => {
      setLoading(true); setError(null);
      try {
        const weeksParams = new URLSearchParams({ farm_id: String(farmId) });
        const weeksReq = fetch(`${API_BASE}/api/admin/reservations/weeks?` + weeksParams.toString(), { signal: controller.signal, credentials: "include" });
        const farmsReq = fetch(`${API_BASE}/api/admin/farms/`, { signal: controller.signal, credentials: "include" });

        const [weeksRes, farmsRes] = await Promise.all([weeksReq, farmsReq]);
        
        if (!weeksRes.ok || !farmsRes.ok) throw new Error("API通信に失敗しました");

        const weeksJson = await weeksRes.json();
        const sorted = [...(weeksJson.items ?? [])].sort((a: any, b: any) => new Date(b.event_start).getTime() - new Date(a.event_start).getTime());
        setWeeks(sorted);

        const farmsJson = await farmsRes.json();
        const targetFarm = farmsJson.farms?.find((f: any) => f.farm_id === farmId);
        if (targetFarm) setFarmData(targetFarm);

      } catch (e: any) {
        if (e.name === "AbortError") return;
        setError("データの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
    return () => controller.abort();
  }, [farmId]);

  const handleToggleBan = async (targetFarmId: number, currentFlag: number) => {
    const nextFlag = currentFlag === 1 ? 0 : 1;
    const actionName = nextFlag === 0 ? "利用停止 (BAN)" : "BANを解除";
    
    if (!window.confirm(`農家ID: ${targetFarmId} を ${actionName} しますか？`)) return;

    const secret = window.prompt(`[${actionName}] 実行のためのシークレットキー(ADMIN_SECRET)を入力してください:`);
    if (!secret) return;

    try {
      const res = await fetch(`${API_BASE}/api/farmer/settings-v2/admin/active-flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Secret": secret },
        body: JSON.stringify({ farm_id: targetFarmId, active_flag: nextFlag }),
      });

      if (!res.ok) {
        if (res.status === 403) alert("シークレットキーが間違っています。");
        else alert("エラーが発生しました。");
        return;
      }
      
      setFarmData(prev => prev ? { ...prev, active_flag: nextFlag } : null);
    } catch (e) {
      alert("通信エラーが発生しました。");
    }
  };

  const conf = farmData?.total_confirmed_6m ?? 0;
  const canc = farmData?.total_cancelled_6m ?? 0;
  const sales = farmData?.total_sales_6m ?? 0;
  const denom = conf + canc;
  
  const cancelRate = denom > 20 ? Math.round((canc / denom) * 100) : null;
  const netHours = farmData?.net_active_hours ?? 0;
  const velocity100 = netHours > 0 ? (conf / netHours) * 100 : 0;
  const displayVelocity = netHours > 100 ? `${velocity100.toFixed(1)}件` : "—";
  const displayHours = netHours > 0 ? netHours.toFixed(1) : "0.0";

  const safeActiveFlag = farmData?.active_flag ?? 1;
  const isBanned = safeActiveFlag === 0;

  const monthlyTrends = useMemo(() => {
    const result = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      result.push({
        year: d.getFullYear(), month: d.getMonth() + 1, label: `${d.getFullYear()}年${d.getMonth() + 1}月`,
        sales: 0, count: 0, cancelled: 0,
      });
    }

    weeks.forEach(w => {
      const d = new Date(w.event_start);
      const bucket = result.find(b => b.year === d.getFullYear() && b.month === d.getMonth() + 1);
      if (bucket) {
        bucket.sales += w.rice_subtotal;
        bucket.count += w.confirmed_count;
        bucket.cancelled += w.cancelled_count;
      }
    });

    return result.map(b => {
      const d = b.count + b.cancelled;
      return { ...b, cancelRate: d > 0 ? Math.round((b.cancelled / d) * 100) : 0 };
    });
  }, [weeks]);

  const maxSales = Math.max(...monthlyTrends.map(m => m.sales), 5000); 
  const maxCount = Math.max(...monthlyTrends.map(m => m.count), 5);
  const eCancels = (farmData?.cancel_count_a ?? 0) + (farmData?.cancel_count_b ?? 0);

  if (!farmId) return null;

  return (
    <>
      <style>{`
        .desktop-only { display: block; }
        .mobile-only { display: none; }
        .admin-page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        
        .admin-top-cards { 
          display: grid; 
          grid-template-columns: 1fr 1fr 1.5fr; 
          gap: 12px; 
          margin-bottom: 16px; 
          align-items: stretch; 
        }
        
        .chart-container { position: relative; flex: 1; display: flex; align-items: flex-end; padding-top: 16px; min-height: 120px; }
        .chart-bar-col { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; position: relative; cursor: crosshair; }
        
        .chart-tooltip { 
          position: absolute; background: #0f172a; color: #fff; padding: 8px 12px; 
          border-radius: 6px; font-size: 11px; white-space: nowrap; opacity: 0; 
          pointer-events: none; z-index: 20; box-shadow: 0 4px 12px rgba(0,0,0,0.2); 
          transform: translateY(4px); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          text-align: left;
        }
        .chart-tooltip::after { 
          content: ""; position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); 
          border-width: 5px 5px 0; border-style: solid; border-color: #0f172a transparent transparent transparent; 
        }
        .chart-bar-col:hover .chart-tooltip { opacity: 1; transform: translateY(0); }

        @media (max-width: 800px) {
          .admin-top-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .admin-trend-card { grid-column: span 2; }
        }

        @media (max-width: 640px) {
          .admin-page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
          .admin-top-cards { grid-template-columns: minmax(0, 1fr); gap: 12px; }
          .admin-trend-card { grid-column: span 1; }
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; flex-direction: column; gap: 8px; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif", padding: "16px", color: C.ink }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          
          <div className="admin-page-header">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button type="button" onClick={() => navigate(-1)} style={{ fontSize: 12, fontWeight: 700, color: C.ink, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                ← 戻る
              </button>
              <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: C.ink }}>農家詳細データ (ID: {farmId})</h1>
            </div>

            {farmData && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {isBanned ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: C.red, padding: "2px 8px", borderRadius: 4 }}>利用停止 (BAN)</span>
                ) : (
                  <>
                    <span style={{ fontSize: 11, fontWeight: 700, color: farmData.is_public ? C.ink : C.ink3, border: `1px solid ${farmData.is_public ? C.ink : C.border}`, background: farmData.is_public ? "transparent" : C.bg, padding: "2px 8px", borderRadius: 4 }}>
                      {farmData.is_public ? "公開中" : "非公開"}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: farmData.is_accepting_reservations ? "#fff" : C.ink3, background: farmData.is_accepting_reservations ? C.statusGreen : C.border, padding: "3px 8px", borderRadius: 4 }}>
                      {farmData.is_accepting_reservations ? "予約受付中" : "受付停止中"}
                    </span>
                  </>
                )}
                <button 
                  onClick={() => handleToggleBan(farmId, safeActiveFlag)} 
                  style={{ fontSize: 11, fontWeight: 700, color: isBanned ? C.ink3 : C.red, background: "none", border: "none", textDecoration: "underline", padding: 0, cursor: "pointer", marginLeft: 4 }}
                >
                  {isBanned ? "BAN解除" : "BANする"}
                </button>
              </div>
            )}
          </div>

          {error && <div style={{ marginBottom: 12, background: C.redLight, color: C.red, padding: "8px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{error}</div>}

          <div className="admin-top-cards">
            
            {/* 1. 農家情報 */}
            <div style={{ background: C.cardBg, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ background: C.ink, padding: "6px 12px", fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.05em" }}>PROFILE</div>
              <div style={{ padding: "12px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                
                {/* ★ ここにカウントバッジを表示 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{farmData?.owner_full_name || "—"}</span>
                  {eCancels > 0 && (
                    <CancelCountBadges countA={farmData?.cancel_count_a ?? 0} countB={farmData?.cancel_count_b ?? 0} showWarning={eCancels >= 2} />
                  )}
                </div>

                <div style={{ fontSize: 10, color: C.ink3, marginBottom: 12 }}>{farmData?.owner_full_kana || "—"}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: C.ink2 }}>
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>✉ {farmData?.owner_email || "—"}</div>
                  <div>📞 {farmData?.owner_phone || "—"}</div>
                  <div style={{ lineHeight: 1.4 }}>🏠 {farmData?.owner_address_line || "—"}</div>
                </div>
              </div>
            </div>

            {/* 2. パフォーマンス */}
            <div style={{ background: C.cardBg, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ background: C.ink, padding: "6px 12px", fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.05em" }}>PERFORMANCE (過去6ヶ月)</div>
              <div style={{ padding: "12px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: `1px solid ${C.border}`, paddingBottom: 4 }}>
                  <span style={{ fontSize: 11, color: C.ink3 }}>お米代(確)</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>¥{formatNumber(sales)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: `1px solid ${C.border}`, paddingBottom: 4 }}>
                  <span style={{ fontSize: 11, color: C.ink3 }}>販売速度 (件/100h)</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{displayVelocity} <span style={{ fontSize: 11, color: C.ink3, fontWeight: 500 }}>({displayHours}h)</span></span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <span style={{ fontSize: 11, color: C.ink3 }}>Cancel Rate</span>
                  <span style={{ fontSize: 18, ...getCancelRateStyle(cancelRate) }}>{cancelRate == null ? "—" : `${cancelRate}%`} <span style={{ fontSize: 11, color: C.ink3, fontWeight: 500 }}>(確{conf} / キ{canc})</span></span>
                </div>
              </div>
            </div>

            {/* 3. 統合トレンドグラフ */}
            {!loading && weeks.length > 0 && (
              <div className="admin-trend-card" style={{ background: C.cardBg, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ background: C.ink, padding: "6px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.05em" }}>MONTHLY TRENDS (過去1年間)</span>
                </div>
                <div style={{ padding: "8px 12px", flex: 1, display: "flex", flexDirection: "column" }}>
                  
                  {/* 凡例（レジェンド） */}
                  <div style={{ display: "flex", gap: "16px", fontSize: 9, color: C.ink3, paddingBottom: 6, borderBottom: `1px dashed ${C.border}` }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, background: C.barChart, borderRadius: 2 }}></div>売上
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 2, background: C.ink }}></div>件数
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 2, background: C.red, borderTop: `2px dotted ${C.red}` }}></div>キャンセル率
                    </span>
                  </div>

                  {/* 統合グラフ描画エリア */}
                  <div className="chart-container">
                    <svg style={{ position: "absolute", top: 16, left: 0, width: "100%", height: "calc(100% - 36px)", overflow: "visible", pointerEvents: "none", zIndex: 10 }}>
                      {monthlyTrends.map((m, i) => {
                        if (i === monthlyTrends.length - 1) return null;
                        const next = monthlyTrends[i + 1];
                        return <line key={`cr-line-${i}`} x1={`${(i + 0.5) * (100 / 12)}%`} y1={`${100 - m.cancelRate * 0.85}%`} x2={`${(i + 1.5) * (100 / 12)}%`} y2={`${100 - next.cancelRate * 0.85}%`} stroke={C.red} strokeWidth="1.5" strokeDasharray="3 3" opacity={0.6} />;
                      })}
                      {monthlyTrends.map((m, i) => {
                        if (i === monthlyTrends.length - 1) return null;
                        const next = monthlyTrends[i + 1];
                        return <line key={`cnt-line-${i}`} x1={`${(i + 0.5) * (100 / 12)}%`} y1={`${100 - (m.count / maxCount) * 85}%`} x2={`${(i + 1.5) * (100 / 12)}%`} y2={`${100 - (next.count / maxCount) * 85}%`} stroke={C.ink} strokeWidth="1.5" />;
                      })}
                      {monthlyTrends.map((m, i) => (
                        <circle key={`cr-circle-${i}`} cx={`${(i + 0.5) * (100 / 12)}%`} cy={`${100 - m.cancelRate * 0.85}%`} r="2.5" fill="#fff" stroke={C.red} strokeWidth="1.5" opacity={0.8} />
                      ))}
                      {monthlyTrends.map((m, i) => (
                        <circle key={`cnt-circle-${i}`} cx={`${(i + 0.5) * (100 / 12)}%`} cy={`${100 - (m.count / maxCount) * 85}%`} r="3" fill="#fff" stroke={C.ink} strokeWidth="1.5" />
                      ))}
                    </svg>

                    {monthlyTrends.map((m, i) => {
                      const isHover = hoverIndex === i;
                      return (
                        <div key={`bar-${i}`} className="chart-bar-col" onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)}>
                          {isHover && (
                            <div className="chart-tooltip" style={{ top: -60 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: 4 }}>{m.label}</div>
                              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 10 }}>
                                <span style={{ color: C.border }}>売上:</span><span style={{ fontWeight: 700 }}>¥{formatNumber(m.sales)}</span>
                                <span style={{ color: C.border }}>件数:</span><span style={{ fontWeight: 700 }}>{m.count}件</span>
                                <span style={{ color: "#fecaca" }}>ｷｬﾝｾﾙ:</span><span style={{ color: "#fecaca", fontWeight: 700 }}>{m.cancelRate}%</span>
                              </div>
                            </div>
                          )}
                          <div style={{ width: "60%", maxWidth: 16, height: `${(m.sales / maxSales) * 85}%`, background: isHover ? C.ink2 : C.barChart, borderRadius: "2px 2px 0 0", opacity: 0.85, transition: "background 0.2s" }} />
                          <div style={{ height: 4 }} />
                          <div style={{ fontSize: 9, color: isHover ? C.ink : C.ink3, fontWeight: 700, marginTop: 2, height: 12 }}>{m.month}</div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              </div>
            )}
          </div>

          {/* ── 下段：極薄テーブル（リスト） ── */}
          {!loading && weeks.length > 0 && (
            <>
              {/* PC用リスト */}
              <div className="desktop-only" style={{ background: C.cardBg, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640, textAlign: "left" }}>
                  <thead style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                    <tr>
                      <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: C.ink3 }}>受け渡し日時</th>
                      <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: C.ink3 }}>Status (確 / キ)</th>
                      <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 700, color: C.ink3, textAlign: "right" }}>Sales (確定のみ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((w) => {
                      // ★ 追加: キャンセル理由に応じた行の背景色
                      let rowBg = "transparent";
                      let hoverBg = C.bg;
                      if (w.emergency_cancel_reason === "A") { rowBg = "#eff6ff"; hoverBg = "#dbeafe"; }
                      else if (w.emergency_cancel_reason === "B") { rowBg = "#fef2f2"; hoverBg = "#fee2e2"; }

                      return (
                        <tr 
                          key={`${w.pickup_slot_code}-${w.event_start}`} 
                          onClick={() => navigate(`/admin/reservations/event?farm_id=${farmId}&event_start=${encodeURIComponent(w.event_start)}`)}
                          style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer", transition: "background 0.2s", background: rowBg }} 
                          onMouseOver={(e) => e.currentTarget.style.background = hoverBg} 
                          onMouseOut={(e) => e.currentTarget.style.background = rowBg}
                        >
                          <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700, color: C.ink }}>
                            {w.pickup_display}
                            {/* ★ 追加: 行の中のバッジ */}
                            {w.emergency_cancel_reason === "A" && <span style={{ marginLeft: 8, fontSize: 10, background: "#bfdbfe", color: "#1e40af", padding: "2px 6px", borderRadius: 4 }}>災害で停止</span>}
                            {w.emergency_cancel_reason === "B" && <span style={{ marginLeft: 8, fontSize: 10, background: "#fecaca", color: "#b91c1c", padding: "2px 6px", borderRadius: 4 }}>自己都合で停止</span>}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", gap: 8, fontSize: 13 }}>
                              <span style={{ color: C.ink }}>確: <span style={{ fontWeight: 700 }}>{w.confirmed_count}</span></span>
                              <span style={{ color: C.border }}>/</span>
                              <span style={{ color: C.ink3 }}>キ: {w.cancelled_count}</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 15, fontWeight: 700, color: C.ink, textAlign: "right" }}>¥{formatNumber(w.rice_subtotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* スマホ用リスト */}
              <div className="mobile-only">
                {weeks.map((w) => {
                  let rowBg = C.cardBg;
                  let hoverBg = C.bg;
                  if (w.emergency_cancel_reason === "A") { rowBg = "#eff6ff"; hoverBg = "#dbeafe"; }
                  else if (w.emergency_cancel_reason === "B") { rowBg = "#fef2f2"; hoverBg = "#fee2e2"; }

                  return (
                    <div 
                      key={`mobile-${w.pickup_slot_code}-${w.event_start}`} 
                      onClick={() => navigate(`/admin/reservations/event?farm_id=${farmId}&event_start=${encodeURIComponent(w.event_start)}`)}
                      style={{ background: rowBg, border: `1px solid ${w.emergency_cancel_reason ? (w.emergency_cancel_reason === "A" ? "#bfdbfe" : "#fecaca") : C.border}`, borderRadius: 8, padding: "12px 16px", cursor: "pointer", transition: "background 0.2s" }}
                      onMouseOver={(e) => e.currentTarget.style.background = hoverBg}
                      onMouseOut={(e) => e.currentTarget.style.background = rowBg}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                          {w.pickup_display}
                          {w.emergency_cancel_reason === "A" && <span style={{ marginLeft: 8, fontSize: 10, background: "#bfdbfe", color: "#1e40af", padding: "2px 6px", borderRadius: 4 }}>災害</span>}
                          {w.emergency_cancel_reason === "B" && <span style={{ marginLeft: 8, fontSize: 10, background: "#fecaca", color: "#b91c1c", padding: "2px 6px", borderRadius: 4 }}>自己都合</span>}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                        <div>
                          <span style={{ color: C.ink }}>確: <b>{w.confirmed_count}</b></span>
                          <span style={{ color: C.border, margin: "0 8px" }}>/</span>
                          <span style={{ color: C.ink3 }}>キ: {w.cancelled_count}</span>
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>¥{formatNumber(w.rice_subtotal)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
};

export default AdminReservationWeeksPage;