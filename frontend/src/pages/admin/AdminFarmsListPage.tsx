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
  redLight:  "#fef2f2",
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

const extractPrefecture = (address?: string) => {
  if (!address) return "未設定";
  const match = address.match(/^(.{2,3}?[都道府県])/);
  return match ? match[1] : "その他";
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
  cancel_count_a?: number;
  cancel_count_b?: number;
};

type ThisWeekSlot = {
  slot_code: string;
  event_display: string;
  event_start_iso: string;
  farm_ids: number[];
};

type SortKey = "id" | "sales" | "velocity" | "cancelRate";

// コンパクトな回数バッジ
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

const AdminFarmsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [farms, setFarms] = useState<FarmItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("id");

  const [thisWeekSlots, setThisWeekSlots] = useState<ThisWeekSlot[]>([]);
  const [selectedSlotCode, setSelectedSlotCode] = useState<string | null>(null);

  const [selectedPrefecture, setSelectedPrefecture] = useState<string>("");
  const [showWarningOnly, setShowWarningOnly] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const [farmsRes, slotsRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/farms/`, { credentials: "include" }),
          fetch(`${API_BASE}/api/admin/farms/this-week-slots`, { credentials: "include" }),
        ]);

        if (!farmsRes.ok) throw new Error(`HTTP ${farmsRes.status}`);
        const farmsData = await farmsRes.json();
        setFarms(farmsData.farms ?? []);

        if (slotsRes.ok) {
          const slotsData = await slotsRes.json();
          setThisWeekSlots(slotsData.slots ?? []);
        }
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
        headers: { "Content-Type": "application/json", "X-Admin-Secret": secret },
        body: JSON.stringify({ farm_id: farmId, active_flag: nextFlag }),
      });

      if (!res.ok) {
        if (res.status === 403) alert("シークレットキーが間違っています。");
        else alert("エラーが発生しました。");
        return;
      }
      setFarms(prev => prev.map(f => f.farm_id === farmId ? { ...f, active_flag: nextFlag } : f));
    } catch (e) {
      alert("通信エラーが発生しました。");
    }
  };

  const prefecturesList = useMemo(() => {
    const prefs = new Set(farms.map(f => extractPrefecture(f.owner_address_line)));
    return Array.from(prefs).sort();
  }, [farms]);

  const filteredFarms = useMemo(() => {
    return farms.filter(f => {
      if (selectedSlotCode) {
        const slot = thisWeekSlots.find(s => s.slot_code === selectedSlotCode);
        if (slot && !slot.farm_ids.includes(f.farm_id)) return false;
      }
      if (selectedPrefecture && extractPrefecture(f.owner_address_line) !== selectedPrefecture) {
        return false;
      }
      if (showWarningOnly && ((f.cancel_count_a ?? 0) + (f.cancel_count_b ?? 0)) < 2) {
        return false;
      }
      return true;
    });
  }, [farms, selectedSlotCode, thisWeekSlots, selectedPrefecture, showWarningOnly]);

  const sortedFarms = useMemo(() => {
    return [...filteredFarms].sort((a, b) => {
      if (sortKey === "id") return b.farm_id - a.farm_id;
      const confA = a.total_confirmed_6m ?? 0; const cancA = a.total_cancelled_6m ?? 0;
      const salesA = a.total_sales_6m ?? 0; const netHoursA = a.net_active_hours ?? 0;
      const confB = b.total_confirmed_6m ?? 0; const cancB = b.total_cancelled_6m ?? 0;
      const salesB = b.total_sales_6m ?? 0; const netHoursB = b.net_active_hours ?? 0;

      if (sortKey === "sales") return salesB - salesA;
      if (sortKey === "velocity") {
        const velA = netHoursA > 0 ? (confA / netHoursA) * 100 : -1;
        const velB = netHoursB > 0 ? (confB / netHoursB) * 100 : -1;
        return velB - velA;
      }
      if (sortKey === "cancelRate") {
        const rateA = (confA + cancA) > 20 ? (cancA / (confA + cancA)) * 100 : -1;
        const rateB = (confB + cancB) > 20 ? (cancB / (confB + cancB)) * 100 : -1;
        return rateB - rateA;
      }
      return 0;
    });
  }, [filteredFarms, sortKey]);

  return (
    <>
      <style>{`
        .desktop-only { display: block; }
        .mobile-only { display: none; }
        @media (max-width: 960px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; flex-direction: column; gap: 12px; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif", padding: "20px 16px", color: C.ink }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button type="button" onClick={() => navigate("/admin")} style={{ fontSize: 12, fontWeight: 700, color: C.ink, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                ← ダッシュボード
              </button>
              <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: C.ink2 }}>農家一覧</h1>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.ink3 }}>都道府県:</span>
                <select value={selectedPrefecture} onChange={(e) => setSelectedPrefecture(e.target.value)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#fff", outline: "none", cursor: "pointer", fontWeight: 600 }}>
                  <option value="">すべて</option>
                  {prefecturesList.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", background: showWarningOnly ? C.redLight : "#fff", border: `1px solid ${showWarningOnly ? C.redBorder : C.border}`, padding: "4px 10px", borderRadius: 6, transition: "0.2s" }}>
                <input type="checkbox" checked={showWarningOnly} onChange={(e) => setShowWarningOnly(e.target.checked)} style={{cursor: "pointer"}}/>
                <span style={{ fontSize: 12, fontWeight: 700, color: showWarningOnly ? C.red : C.ink }}>要注意 (1年で2回以上停止)</span>
              </label>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.ink3 }}>並び順:</span>
                <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#fff", color: C.ink, outline: "none", cursor: "pointer", fontWeight: 600 }}>
                  <option value="id">登録順 (新着)</option>
                  <option value="sales">お米代 (高い順)</option>
                  <option value="velocity">販売速度 (速い順)</option>
                  <option value="cancelRate">キャンセル率 (高い順)</option>
                </select>
              </div>
            </div>
          </div>

          {thisWeekSlots.length > 0 && (
            <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.ink3, whiteSpace: "nowrap" }}>今週の予約:</span>
              <button
                onClick={() => setSelectedSlotCode(null)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 9999,
                  border: `1px solid ${!selectedSlotCode ? C.ink : C.border}`,
                  background: !selectedSlotCode ? C.ink : C.cardBg, color: !selectedSlotCode ? "#fff" : C.ink2,
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                すべて ({farms.length})
              </button>
              {thisWeekSlots.map(slot => (
                <button
                  key={slot.slot_code}
                  onClick={() => setSelectedSlotCode(selectedSlotCode === slot.slot_code ? null : slot.slot_code)}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 9999,
                    border: `1px solid ${selectedSlotCode === slot.slot_code ? C.ink : C.border}`,
                    background: selectedSlotCode === slot.slot_code ? C.ink : C.cardBg, color: selectedSlotCode === slot.slot_code ? "#fff" : C.ink2,
                    cursor: "pointer", transition: "all 0.15s", opacity: slot.farm_ids.length === 0 ? 0.45 : 1,
                  }}
                >
                  {slot.event_display} ({slot.farm_ids.length}件)
                </button>
              ))}
            </div>
          )}

          {error && <div style={{ marginBottom: 16, background: "#fef2f2", color: C.red, padding: "10px", borderRadius: 6, fontSize: 13, fontWeight: 600 }}>{error}</div>}
          
          <div style={{ marginBottom: 12, fontSize: 12, color: C.ink3, fontWeight: 600 }}>
            {loading ? "読み込み中..." : `該当農家：${sortedFarms.length} 件`}
          </div>

          {!loading && sortedFarms.length > 0 && (
            <>
              {/* PC用テーブル */}
              <div className="desktop-only" style={{ background: C.cardBg, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 2px 10px rgba(15,23,42,0.02)" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980, textAlign: "left" }}>
                    <thead style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                      <tr>
                        <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: C.ink3, width: "240px" }}>FARM</th>
                        <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: C.ink3 }}>連絡先</th>
                        <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: C.ink3 }}>STATUS</th>
                        <th style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: C.ink3, minWidth: "380px" }}>PERFORMANCE (過去6ヶ月)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFarms.map((f) => {
                        const conf = f.total_confirmed_6m ?? 0;
                        const canc = f.total_cancelled_6m ?? 0;
                        const sales = f.total_sales_6m ?? 0;
                        const denom = conf + canc;
                        const cancelRate = denom > 20 ? Math.round((canc / denom) * 100) : null;
                        
                        const safeActiveFlag = f.active_flag ?? 1;
                        const isBanned = safeActiveFlag === 0;
                        const statusColor = isBanned ? C.red : f.is_accepting_reservations ? C.statusGreen : C.statusGray;
                        
                        const eCancels = (f.cancel_count_a ?? 0) + (f.cancel_count_b ?? 0);
                        const netHours = f.net_active_hours ?? 0;
                        const velocity100 = netHours > 0 ? (conf / netHours) * 100 : 0;
                        const displayVelocity = netHours > 100 ? `${velocity100.toFixed(1)}件` : "—";
                        const displayHours = netHours > 0 ? netHours.toFixed(1) : "0.0";

                        return (
                          <tr key={f.farm_id} onClick={() => navigate(`/admin/reservations/weeks?farm_id=${f.farm_id}`)} style={{ borderBottom: `1px solid ${C.border}`, opacity: isBanned ? 0.6 : 1, cursor: "pointer", background: eCancels >= 2 ? "#fff1f2" : "transparent" }} onMouseOver={(e) => e.currentTarget.style.background = eCancels >= 2 ? "#ffe4e6" : C.bg} onMouseOut={(e) => e.currentTarget.style.background = eCancels >= 2 ? "#fff1f2" : "transparent"}>
                           <td style={{ padding: "10px 12px", verticalAlign: "middle", borderLeft: `4px solid ${statusColor}` }}>
                              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: C.ink, background: C.border, padding: "1px 4px", borderRadius: 3 }}>ID:{f.farm_id}</span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{f.owner_full_name}</span>
                                {eCancels > 0 && (
                                  <CancelCountBadges countA={f.cancel_count_a ?? 0} countB={f.cancel_count_b ?? 0} showWarning={eCancels >= 2} />
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: C.ink3 }}>
                                <span>{extractPrefecture(f.owner_address_line)}</span>
                                <span style={{ color: C.border }}>|</span>
                                <span>初予約: {f.first_reservation_at ? f.first_reservation_at.slice(0, 10).replace(/-/g, "/") : "なし"}</span>
                              </div>
                            </td>  
                            <td style={{ padding: "10px 12px", verticalAlign: "middle", cursor: "text" }} onClick={(e) => e.stopPropagation()}>
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
                              <button onClick={(e) => { e.stopPropagation(); handleToggleBan(f.farm_id, safeActiveFlag); }} style={{ fontSize: 10, fontWeight: 700, color: isBanned ? C.ink3 : C.red, background: "none", border: "none", textDecoration: "underline", padding: 0, cursor: "pointer" }}>{isBanned ? "BAN解除" : "BANする"}</button>
                            </td>
                            <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", width: "100%", fontSize: 11 }}>
                                <div>
                                  <div style={{ color: C.ink3, marginBottom: 2 }}>お米代(確)</div>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>¥{formatNumber(sales)}</div>
                                </div>
                                <div>
                                  <div style={{ color: C.ink3, marginBottom: 2 }}>販売速度</div>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>
                                    {displayVelocity}
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

              {/* スマホ用 */}
              <div className="mobile-only">
                {sortedFarms.map((f) => {
                  const conf = f.total_confirmed_6m ?? 0;
                  const canc = f.total_cancelled_6m ?? 0;
                  const sales = f.total_sales_6m ?? 0;
                  const denom = conf + canc;
                  const cancelRate = denom > 20 ? Math.round((canc / denom) * 100) : null;
                  
                  const safeActiveFlag = f.active_flag ?? 1;
                  const isBanned = safeActiveFlag === 0;
                  const statusColor = isBanned ? C.red : f.is_accepting_reservations ? C.statusGreen : C.statusGray;
                  
                  const eCancels = (f.cancel_count_a ?? 0) + (f.cancel_count_b ?? 0);
                  const netHours = f.net_active_hours ?? 0;
                  const velocity100 = netHours > 0 ? (conf / netHours) * 100 : 0;
                  const displayVelocity = netHours > 100 ? `${velocity100.toFixed(1)}件` : "—";
                  const displayHours = netHours > 0 ? netHours.toFixed(1) : "0.0";

                  return (
                    <div key={f.farm_id} onClick={() => navigate(`/admin/reservations/weeks?farm_id=${f.farm_id}`)} style={{ background: eCancels >= 2 ? "#fff1f2" : C.cardBg, border: `1px solid ${eCancels >= 2 ? C.redBorder : C.border}`, borderLeft: `4px solid ${statusColor}`, borderRadius: 6, padding: "12px", opacity: isBanned ? 0.7 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: C.ink, background: C.border, padding: "1px 4px", borderRadius: 3 }}>ID:{f.farm_id}</span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{f.owner_full_name}</span>
                          </div>
                          <div style={{ fontSize: 11, color: C.ink3, display: "flex", alignItems: "center", gap: 6, marginBottom: eCancels > 0 ? 6 : 0 }}>
                            <span>{extractPrefecture(f.owner_address_line)}</span>
                            <span style={{ color: C.border }}>|</span>
                            <span>初予約: {f.first_reservation_at ? f.first_reservation_at.slice(0, 10).replace(/-/g, "/") : "なし"}</span>
                          </div>
                          {eCancels > 0 && (
                            <CancelCountBadges countA={f.cancel_count_a ?? 0} countB={f.cancel_count_b ?? 0} showWarning={eCancels >= 2} />
                          )}
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

                      <div style={{ fontSize: 11, color: C.ink2, display: "flex", gap: 12, marginBottom: 12, cursor: "text" }} onClick={(e) => e.stopPropagation()}>
                        <div>✉ {f.owner_email || "—"}</div>
                        <div>📞 {f.owner_phone || "—"}</div>
                      </div>

                      <div style={{ background: eCancels >= 2 ? "#ffe4e6" : C.bg, padding: "10px 12px", borderRadius: 6, display: "grid", gridTemplateColumns: "1fr", gap: "10px", fontSize: 11 }}>
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