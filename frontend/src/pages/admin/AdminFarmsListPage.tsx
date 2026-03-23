import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "@/config/api";

const C = {
  ink:       "#0f172a",
  ink2:      "#334155",
  ink3:      "#475569",
  border:    "#cbd5e1",
  bg:        "#f8fafc",
  cardBg:    "#ffffff",
  red:       "#dc2626",
  redBorder: "#fecaca",
  focus:     "#0f172a",
  statusGreen: "#10B981", 
  statusGray:  "#94A3B8", 
} as const;

const formatNumber = (n: number) =>
  new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(n);

const getCancelRateStyle = (rate: number | null): React.CSSProperties => {
  if (rate == null) return { color: C.ink3 };
  if (rate >= 30) return { color: C.red, fontWeight: 700 };
  if (rate >= 10) return { color: C.ink, fontWeight: 700 };
  return { color: C.ink2 };
};

type FarmItem = {
  farm_id: number;
  owner_full_name: string;
  owner_full_kana: string;
  owner_email: string;
  owner_phone: string;
  owner_address_line: string;
  is_accepting_reservations: number;
  is_public: number;
  registration_status: string;
  active_flag?: number; 
  first_reservation_at?: string; 
  total_confirmed_6m?: number;
  total_cancelled_6m?: number;
  total_sales_6m?: number;
  net_active_hours?: number;
};

type SortKey = "id" | "sales" | "velocity" | "cancelRate";

const AdminFarmsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [farms, setFarms] = useState<FarmItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ★ 追加: ソート状態の管理
  const [sortKey, setSortKey] = useState<SortKey>("id");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/farms/`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setFarms(data.farms ?? []);
      } catch (e) {
        setError("農家一覧の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggleBan = async (farmId: number, currentFlag?: number) => {
    const safeFlag = currentFlag ?? 1; 
    const nextFlag = safeFlag === 1 ? 0 : 1;
    const actionName = nextFlag === 0 ? "利用停止 (BAN)" : "BANを解除";
    
    if (!window.confirm(`農家ID: ${farmId} を ${actionName} しますか？`)) return;

    const secret = window.prompt(`[${actionName}] 実行のためのシークレットキー(ADMIN_SECRET)を入力してください:`);
    if (!secret) return;

    try {
      const res = await fetch(`${API_BASE}/api/farmer/settings-v2/admin/active-flag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Secret": secret,
        },
        body: JSON.stringify({ farm_id: farmId, active_flag: nextFlag }),
      });

      if (!res.ok) {
        if (res.status === 403) {
          alert("シークレットキーが間違っています。");
        } else {
          alert("エラーが発生しました。");
        }
        return;
      }
      
      setFarms(prev => prev.map(f => f.farm_id === farmId ? { ...f, active_flag: nextFlag } : f));
    } catch (e) {
      alert("通信エラーが発生しました。");
    }
  };

  // ★ 追加: ソートされた配列を生成
  const sortedFarms = useMemo(() => {
    return [...farms].sort((a, b) => {
      if (sortKey === "id") {
        return b.farm_id - a.farm_id;
      }

      const confA = a.total_confirmed_6m ?? 0;
      const cancA = a.total_cancelled_6m ?? 0;
      const salesA = a.total_sales_6m ?? 0;
      const denomA = confA + cancA;
      const netHoursA = a.net_active_hours ?? 0;

      const confB = b.total_confirmed_6m ?? 0;
      const cancB = b.total_cancelled_6m ?? 0;
      const salesB = b.total_sales_6m ?? 0;
      const denomB = confB + cancB;
      const netHoursB = b.net_active_hours ?? 0;

      if (sortKey === "sales") {
        return salesB - salesA;
      }

      if (sortKey === "velocity") {
        const velA = netHoursA > 0 ? (confA / netHoursA) * 100 : -1;
        const velB = netHoursB > 0 ? (confB / netHoursB) * 100 : -1;
        return velB - velA;
      }

      if (sortKey === "cancelRate") {
        // 20件以下の農家は参考外として一番下に送る (-1)
        const rateA = denomA > 20 ? (cancA / denomA) * 100 : -1;
        const rateB = denomB > 20 ? (cancB / denomB) * 100 : -1;
        return rateB - rateA;
      }

      return 0;
    });
  }, [farms, sortKey]);

  return (
    <>
      <style>{`
        .desktop-only { display: block; }
        .mobile-only { display: none; }
        .admin-page-header { display: flex; justify-content: center; align-items: center; position: relative; margin-bottom: 24px; }
        .admin-page-back-btn-container { position: absolute; left: 0; }
        .admin-page-title-container { text-align: center; }
        .admin-page-sort-container { position: absolute; right: 0; display: flex; align-items: center; gap: 8px; }

        @media (max-width: 960px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; flex-direction: column; gap: 12px; }
        }

        @media (max-width: 640px) {
          .admin-page-header { flex-direction: column; align-items: flex-start; margin-bottom: 16px !important; }
          .admin-page-back-btn-container { position: static; width: 100%; text-align: left; margin-bottom: 12px; }
          .admin-page-title-container { width: 100%; text-align: left; margin-bottom: 12px; }
          .admin-page-sort-container { position: static !important; width: 100%; justify-content: flex-start; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif", padding: "20px 16px", color: C.ink }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          
          <div className="admin-page-header">
            <div className="admin-page-back-btn-container">
              <button type="button" onClick={() => navigate("/admin")} style={{ fontSize: 12, fontWeight: 700, color: C.ink, background: "transparent", border: "none", cursor: "pointer", transition: "0.2s" }}>
                ← ダッシュボード
              </button>
            </div>
            <div className="admin-page-title-container">
              <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: C.ink2 }}>農家一覧</h1>
            </div>
            {/* ★ 追加: ソートUI */}
            <div className="admin-page-sort-container">
              <span style={{ fontSize: 11, fontWeight: 700, color: C.ink3 }}>並び順:</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                style={{
                  fontSize: 12, padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.border}`,
                  background: "#fff", color: C.ink, outline: "none", cursor: "pointer", fontWeight: 600
                }}
              >
                <option value="id">登録順 (新着)</option>
                <option value="sales">お米代 (高い順)</option>
                <option value="velocity">販売速度 (速い順)</option>
                <option value="cancelRate">キャンセル率 (高い順)</option>
              </select>
            </div>
          </div>

          {error && <div style={{ marginBottom: 16, background: "#fef2f2", color: C.red, padding: "10px", borderRadius: 6, fontSize: 13, fontWeight: 600 }}>{error}</div>}
          {loading && <div style={{ marginBottom: 16, fontSize: 13, color: C.ink3 }}>読み込み中...</div>}

          {!loading && sortedFarms.length > 0 && (
            <>
              {/* PC用: 超高密度テーブル */}
              <div className="desktop-only" style={{ background: C.cardBg, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 2px 10px rgba(15,23,42,0.02)" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980, textAlign: "left" }}>
                    <thead style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                      <tr>
                        <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: C.ink3, width: "220px" }}>FARM</th>
                        <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: C.ink3 }}>連絡先</th>
                        <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: C.ink3 }}>STATUS</th>
                        <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: C.ink3, minWidth: "380px" }}>PERFORMANCE (過去6ヶ月)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* ★ 変更: farms ではなく sortedFarms をマップする */}
                      {sortedFarms.map((f) => {
                        const conf = f.total_confirmed_6m ?? 0;
                        const canc = f.total_cancelled_6m ?? 0;
                        const sales = f.total_sales_6m ?? 0;
                        const denom = conf + canc;
                        
                        const cancelRate = denom > 20 ? Math.round((canc / denom) * 100) : null;

                        const safeActiveFlag = f.active_flag ?? 1;
                        const isBanned = safeActiveFlag === 0;

                        let statusColor = "";
                        if (isBanned) statusColor = C.red;
                        else if (f.is_accepting_reservations) statusColor = C.statusGreen;
                        else statusColor = C.statusGray;

                        const netHours = f.net_active_hours ?? 0;
                        const velocity100 = netHours > 0 ? (conf / netHours) * 100 : 0;
                        const displayVelocity = netHours > 100 ? `${velocity100.toFixed(1)}件` : "—";
                        const displayHours = netHours > 0 ? netHours.toFixed(1) : "0.0";

                        return (
                          <tr 
                            key={f.farm_id} 
                            onClick={() => navigate(`/admin/reservations/weeks?farm_id=${f.farm_id}`)}
                            style={{ borderBottom: `1px solid ${C.border}`, opacity: isBanned ? 0.6 : 1, cursor: "pointer" }} 
                            onMouseOver={(e) => e.currentTarget.style.background = C.bg} 
                            onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                          >
                            <td style={{ padding: "10px 12px", verticalAlign: "middle", borderLeft: `4px solid ${statusColor}` }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: C.ink, background: C.border, padding: "1px 4px", borderRadius: 3 }}>ID:{f.farm_id}</span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{f.owner_full_name}</span>
                                <span style={{ fontSize: 10, color: C.ink3 }}>{f.owner_full_kana}</span>
                              </div>
                              <div style={{ fontSize: 10, color: C.ink3 }}>
                                初予約: {f.first_reservation_at ? f.first_reservation_at.slice(0, 10).replace(/-/g, "/") : "なし"}
                              </div>
                            </td>

                            <td 
                              style={{ padding: "10px 12px", verticalAlign: "middle", cursor: "text" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div style={{ fontSize: 11, color: C.ink2, lineHeight: 1.5 }}>
                                <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px" }}>✉ {f.owner_email || "—"}</div>
                                <div>📞 {f.owner_phone || "—"}</div>
                              </div>
                            </td>

                            <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                              <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
                                {isBanned ? (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: C.red, padding: "2px 6px", borderRadius: 3 }}>BAN</span>
                                ) : (
                                  <>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: f.is_public ? C.ink : C.ink3, border: `1px solid ${f.is_public ? C.ink : C.border}`, background: f.is_public ? "transparent" : C.bg, padding: "1px 6px", borderRadius: 3 }}>{f.is_public ? "公開" : "非公開"}</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: f.is_accepting_reservations ? "#fff" : C.ink3, background: f.is_accepting_reservations ? C.statusGreen : C.border, padding: "2px 6px", borderRadius: 3 }}>{f.is_accepting_reservations ? "受付中" : "停止中"}</span>
                                  </>
                                )}
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleToggleBan(f.farm_id, safeActiveFlag); }} 
                                style={{ fontSize: 10, fontWeight: 700, color: isBanned ? C.ink3 : C.red, background: "none", border: "none", textDecoration: "underline", padding: 0, cursor: "pointer" }}
                              >
                                {isBanned ? "BAN解除" : "BANする"}
                              </button>
                            </td>

                            <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", width: "100%", fontSize: 11 }}>
                                <div>
                                  <div style={{ color: C.ink3, marginBottom: 2 }}>お米代(確)</div>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>¥{formatNumber(sales)}</div>
                                </div>
                                <div>
                                  <div style={{ color: C.ink3, marginBottom: 2 }}>販売速度 (件/100h)</div>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>
                                    {displayVelocity} <span style={{ fontSize: 11, color: C.ink3, fontWeight: 500 }}>({displayHours}h)</span>
                                  </div>
                                </div>
                                <div>
                                  <div style={{ color: C.ink3, marginBottom: 2 }}>Cancel Rate</div>
                                  <div style={{ fontSize: 16, ...getCancelRateStyle(cancelRate) }}>
                                    {cancelRate == null ? "—" : `${cancelRate}%`} <span style={{ fontSize: 11, color: C.ink3, fontWeight: 500 }}>(確{conf}/キ{canc})</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* スマホ用: 高密度カード */}
              <div className="mobile-only">
                {sortedFarms.map((f) => {
                  const conf = f.total_confirmed_6m ?? 0;
                  const canc = f.total_cancelled_6m ?? 0;
                  const sales = f.total_sales_6m ?? 0;
                  const denom = conf + canc;
                  
                  const cancelRate = denom > 20 ? Math.round((canc / denom) * 100) : null;
                  const safeActiveFlag = f.active_flag ?? 1;
                  const isBanned = safeActiveFlag === 0;

                  let statusColor = "";
                  if (isBanned) statusColor = C.red;
                  else if (f.is_accepting_reservations) statusColor = C.statusGreen;
                  else statusColor = C.statusGray;

                  const netHours = f.net_active_hours ?? 0;
                  const velocity100 = netHours > 0 ? (conf / netHours) * 100 : 0;
                  const displayVelocity = netHours > 100 ? `${velocity100.toFixed(1)}件` : "—";
                  const displayHours = netHours > 0 ? netHours.toFixed(1) : "0.0";

                  return (
                    <div 
                      key={f.farm_id} 
                      onClick={() => navigate(`/admin/reservations/weeks?farm_id=${f.farm_id}`)}
                      style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderLeft: `4px solid ${statusColor}`, borderRadius: 6, padding: "12px", opacity: isBanned ? 0.7 : 1, cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: C.ink, background: C.border, padding: "1px 4px", borderRadius: 3 }}>ID:{f.farm_id}</span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{f.owner_full_name}</span>
                          </div>
                          <div style={{ fontSize: 10, color: C.ink3 }}>初予約: {f.first_reservation_at ? f.first_reservation_at.slice(0, 10).replace(/-/g, "/") : "なし"}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            {isBanned ? (
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: C.red, padding: "2px 6px", borderRadius: 3 }}>BAN</span>
                            ) : (
                              <>
                                <span style={{ fontSize: 10, fontWeight: 700, color: f.is_public ? C.ink : C.ink3, border: `1px solid ${f.is_public ? C.ink : C.border}`, background: f.is_public ? "transparent" : C.bg, padding: "1px 4px", borderRadius: 3 }}>{f.is_public ? "公開" : "非公開"}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: f.is_accepting_reservations ? "#fff" : C.ink3, background: f.is_accepting_reservations ? C.statusGreen : C.border, padding: "2px 4px", borderRadius: 3 }}>{f.is_accepting_reservations ? "受付中" : "停止中"}</span>
                              </>
                            )}
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleToggleBan(f.farm_id, safeActiveFlag); }} 
                            style={{ fontSize: 10, fontWeight: 700, color: isBanned ? C.ink3 : C.red, background: "none", border: "none", textDecoration: "underline", padding: 0 }}
                          >
                            {isBanned ? "BAN解除" : "BANする"}
                          </button>
                        </div>
                      </div>
                      
                      <div 
                        style={{ fontSize: 11, color: C.ink2, display: "flex", gap: 12, marginBottom: 12, cursor: "text" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div>✉ {f.owner_email || "—"}</div>
                        <div>📞 {f.owner_phone || "—"}</div>
                      </div>

                      <div style={{ background: C.bg, padding: "10px 12px", borderRadius: 6, display: "grid", gridTemplateColumns: "1fr", gap: "10px", fontSize: 11 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                          <span style={{ color: C.ink3 }}>お米代(確)</span>
                          <span style={{ fontSize: 15, fontWeight: 700 }}>¥{formatNumber(sales)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                          <span style={{ color: C.ink3 }}>販売速度 (件/100h)</span>
                          <span>
                            <span style={{ fontSize: 15, fontWeight: 700 }}>{displayVelocity}</span>
                            <span style={{ fontSize: 11, color: C.ink3, marginLeft: 4 }}>({displayHours}h)</span>
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                          <span style={{ color: C.ink3 }}>Cancel Rate</span>
                          <span>
                            <span style={{ fontSize: 15, ...getCancelRateStyle(cancelRate) }}>{cancelRate == null ? "—" : `${cancelRate}%`}</span>
                            <span style={{ fontSize: 11, color: C.ink3, marginLeft: 4 }}>(確{conf}/キ{canc})</span>
                          </span>
                        </div>
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

export default AdminFarmsListPage;