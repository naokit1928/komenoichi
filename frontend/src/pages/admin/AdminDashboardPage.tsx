import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ReactDOM from "react-dom";
import { API_BASE } from "@/config/api";
import type { AdminAlertsResponse, AdminReservationListItemDTO } from "../../types/adminReservations";

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
  green:     "#10b981",
  focus:     "#0f172a",
} as const;

type FarmOwnerMatch = { farm_id: number; owner_full_name: string; owner_full_kana: string; };
type HistoryItem = { reservation_id: number; status: string; is_late_cancel: number; created_at: string; farm_name: string; };
type ConsumerSearchResult = { consumer_id: number; email: string; penalty_status: string; penalty_count: number; no_show_count: number; late_cancel_count: number; history: HistoryItem[]; };

type EmergencyCancelAlert = { log_id: number; farm_id: number; farm_name: string; reason: "A" | "B"; created_at: string; cancel_count_a: number; cancel_count_b: number; };
type WarningFarm = { farm_id: number; farm_name: string; active_flag: number; cancel_count_a: number; cancel_count_b: number; warning_checked_count: number; };
type ArchiveItem = { log_id: number; farm_id: number; farm_name: string; reason: "A" | "B"; created_at: string; is_checked: number; cancel_count_a: number; cancel_count_b: number; };

type ExtendedAdminAlertsResponse = AdminAlertsResponse & {
  emergency_cancels?: EmergencyCancelAlert[];
  warning_farms?: WarningFarm[];
};

const adjustId = (setter: React.Dispatch<React.SetStateAction<string>>, delta: number) => {
  setter(prev => {
    const num = parseInt(prev || "0", 10);
    const next = num + delta;
    if (next < 1) return prev || "";
    return String(next);
  });
};

function useSpin(setter: React.Dispatch<React.SetStateAction<string>>, delta: number) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const stop = useCallback(() => { if (timeoutRef.current) clearTimeout(timeoutRef.current); if (intervalRef.current) clearInterval(intervalRef.current); }, []);
  const start = useCallback(() => { stop(); adjustId(setter, delta); timeoutRef.current = setTimeout(() => { intervalRef.current = setInterval(() => { adjustId(setter, delta); }, 80); }, 400); }, [setter, delta, stop]);
  return { onMouseDown: start, onMouseUp: stop, onMouseLeave: stop, onTouchStart: start, onTouchEnd: stop, onContextMenu: (e: React.MouseEvent) => e.preventDefault(), };
}

const CancelCountBadges: React.FC<{ countA: number, countB: number }> = ({ countA, countB }) => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 4, background: C.bg, border: `1px solid ${C.border}`, padding: "2px 6px", borderRadius: 4 }}>
      <span style={{ fontSize: 10, color: C.ink3, fontWeight: 700 }}>災害</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{countA}</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 4, background: countB > 0 ? C.redLight : C.bg, border: `1px solid ${countB > 0 ? C.redBorder : C.border}`, padding: "2px 6px", borderRadius: 4 }}>
      <span style={{ fontSize: 10, color: countB > 0 ? C.red : C.ink3, fontWeight: 700 }}>自己都合</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: countB > 0 ? C.red : C.ink }}>{countB}</span>
    </div>
  </div>
);

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState<ExtendedAdminAlertsResponse | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [alertError, setAlertError] = useState<string | null>(null);

  const [farmIdInput, setFarmIdInput] = useState("");
  const [reservationIdInput, setReservationIdInput] = useState("");
  const farmIdMinus = useSpin(setFarmIdInput, -1);
  const farmIdPlus  = useSpin(setFarmIdInput, 1);
  const resIdMinus  = useSpin(setReservationIdInput, -1);
  const resIdPlus   = useSpin(setReservationIdInput, 1);

  const [ownerKanaInput, setOwnerKanaInput] = useState("");
  const [ownerKanaMatches, setOwnerKanaMatches] = useState<FarmOwnerMatch[]>([]);
  const [isSearchingKana, setIsSearchingKana] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [consumerQueryMode, setConsumerQueryMode] = useState<"email" | "reservation_id">("reservation_id");
  const [consumerInputValue, setConsumerInputValue] = useState("");
  const [loadingConsumer, setLoadingConsumer] = useState(false);
  const [consumerError, setConsumerError] = useState<string | null>(null);
  const [consumerResult, setConsumerResult] = useState<ConsumerSearchResult | null>(null);

  const [showArchive, setShowArchive] = useState(false);
  const [archiveItems, setArchiveItems] = useState<ArchiveItem[]>([]);
  const [loadingArchive, setLoadingArchive] = useState(false);

  // ★ 新規: 要注意農家のアーカイブ用 State
  const [showWarningArchive, setShowWarningArchive] = useState(false);
  const [warningArchiveItems, setWarningArchiveItems] = useState<WarningFarm[]>([]);
  const [loadingWarningArchive, setLoadingWarningArchive] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/reservations/alerts`, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setAlerts(await res.json());
      } catch {
        setAlertError("アラートの取得に失敗しました。");
      } finally {
        setLoadingAlerts(false);
      }
    })();
  }, []);

  useEffect(() => {
    const q = ownerKanaInput.trim();
    if (!q) { setOwnerKanaMatches([]); setIsSearchingKana(false); setSearchError(null); return; }
    const controller = new AbortController();
    setIsSearchingKana(true); setSearchError(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/farms/resolve-by-owner-kana?query=${encodeURIComponent(q)}`, { signal: controller.signal, credentials: "include" });
        if (!res.ok) throw new Error("API Error");
        const data = await res.json();
        setOwnerKanaMatches(Array.isArray(data.matches) ? data.matches : []);
      } catch (e: any) { if (e.name !== "AbortError") setSearchError("検索中にエラーが発生しました。"); } finally { setIsSearchingKana(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [ownerKanaInput]);

  const handleFarmSearch = () => {
    const n = Number(farmIdInput);
    if (!Number.isFinite(n) || n <= 0) { setSearchError("Farm ID が不正です。"); return; }
    navigate(`/admin/reservations/weeks?farm_id=${n}`);
  };

  const handleReservationSearch = async () => {
    const n = Number(reservationIdInput);
    if (!Number.isFinite(n) || n <= 0) { setSearchError("システム照会ID が不正です。"); return; }
    setSearchError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/reservations/resolve-by-reservation-id?reservation_id=${n}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not Found");
      const data = await res.json();
      navigate(`/admin/reservations/event?farm_id=${data.farm_id}&event_start=${encodeURIComponent(data.event_start)}&highlight_reservation_id=${data.reservation_id}`);
    } catch {
      setSearchError("該当する予約が見つかりませんでした。");
    }
  };

  const handleConsumerSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consumerInputValue.trim()) return;
    setLoadingConsumer(true); setConsumerError(null); setConsumerResult(null);
    try {
      const param = consumerQueryMode === "email" ? `email=${encodeURIComponent(consumerInputValue)}` : `reservation_id=${consumerInputValue}`;
      const res = await fetch(`${API_BASE}/api/admin/consumers/penalty-search?${param}`, { credentials: "include" });
      if (!res.ok) { const errData = await res.json().catch(() => ({})); throw new Error(errData.detail || "ユーザーが見つかりませんでした"); }
      setConsumerResult(await res.json());
    } catch (err: any) { setConsumerError(err.message); } finally { setLoadingConsumer(false); }
  };

  const handleRevertStatus = async (reservationId: number, newStatus: string) => {
    const actionName = newStatus === "confirmed" ? "【通常予約に戻す（ノーショー解除）】" : "【キャンセル扱いに変更】";
    if (!window.confirm(`照会ID: ${reservationId} を ${actionName} します。よろしいですか？`)) return;
    const secret = window.prompt(`[${actionName}] 実行のためのシークレットキー(ADMIN_SECRET)を入力してください:`);
    if (!secret) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/consumers/reservations/${reservationId}/revert-status`, { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Secret": secret }, body: JSON.stringify({ new_status: newStatus }), credentials: "include", });
      if (!res.ok) { if (res.status === 403) throw new Error("シークレットキーが間違っています。"); throw new Error("失敗しました"); }
      alert("ステータスを変更しました。"); setConsumerResult(null);
    } catch (err: any) { alert(err.message); }
  };

  const handleClearLateCancel = async (reservationId: number) => {
    if (!window.confirm(`照会ID: ${reservationId} の遅延キャンセルフラグを解除しますか？`)) return;
    const secret = window.prompt("シークレットキー(ADMIN_SECRET)を入力してください:");
    if (!secret) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/consumers/reservations/${reservationId}/clear-late-cancel`, { method: "POST", headers: { "X-Admin-Secret": secret }, credentials: "include" });
      if (!res.ok) { if (res.status === 403) throw new Error("シークレットキーが間違っています。"); throw new Error("失敗しました"); }
      alert("遅延キャンセルフラグを解除しました。"); setConsumerResult(null);
    } catch (err: any) { alert(err.message); }
  };

  const handleGoToHistoryEvent = async (reservationId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/reservations/resolve-by-reservation-id?reservation_id=${reservationId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not Found");
      const data = await res.json();
      navigate(`/admin/reservations/event?farm_id=${data.farm_id}&event_start=${encodeURIComponent(data.event_start)}&highlight_reservation_id=${data.reservation_id}`);
    } catch { alert("該当する予約のイベント情報が見つかりませんでした。"); }
  };

  const handleCheckEmergencyCancel = async (logId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/reservations/alerts/emergency-cancel/${logId}/check`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("エラー");
      setAlerts(prev => {
        if (!prev) return prev;
        return { ...prev, emergency_cancels: prev.emergency_cancels?.filter(a => a.log_id !== logId) };
      });
    } catch { alert("確認済みの更新に失敗しました。"); }
  };

  // ★ 新規: 要注意農家を確認済みにする
  const handleCheckWarning = async (farmId: number, currentCount: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/reservations/alerts/warning-farms/${farmId}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_count: currentCount }),
        credentials: "include"
      });
      if (!res.ok) throw new Error("エラー");
      setAlerts(prev => {
        if (!prev) return prev;
        return { ...prev, warning_farms: prev.warning_farms?.filter(f => f.farm_id !== farmId) };
      });
    } catch { alert("確認済みの更新に失敗しました。"); }
  };

  const handleOpenArchive = async () => {
    setShowArchive(true); setLoadingArchive(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/reservations/alerts/emergency-cancel/archive`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setArchiveItems(data.items || []);
    } catch { alert("履歴の取得に失敗しました"); setShowArchive(false); } finally { setLoadingArchive(false); }
  };

  // ★ 新規: 要注意農家のアーカイブを開く
  const handleOpenWarningArchive = async () => {
    setShowWarningArchive(true); setLoadingWarningArchive(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/reservations/alerts/warning-farms/archive`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setWarningArchiveItems(data.items || []);
    } catch { alert("履歴の取得に失敗しました"); setShowWarningArchive(false); } finally { setLoadingWarningArchive(false); }
  };

  const getConsumerStatusLabel = (status: string) => {
    if (status === "banned") return <span style={{ color: C.red, fontWeight: 700 }}>完全BAN（利用停止）</span>;
    return <span style={{ color: C.green, fontWeight: 700 }}>通常（制限なし）</span>;
  };

  const anomalyCount = alerts?.payment_anomalies?.length ?? 0;
  const unreadEmergencyCount = alerts?.emergency_cancels?.length ?? 0;
  const warningFarmCount = alerts?.warning_farms?.length ?? 0;

  const renderAlertRow = (r: AdminReservationListItemDTO) => (
    <div key={r.reservation_id} style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 10, background: C.cardBg }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ background: C.redLight, color: C.red, padding: "4px 8px", borderRadius: 6, fontSize: 13, fontWeight: 700, border: `1px solid ${C.redBorder}` }}>#{r.reservation_id}</span>
          <span style={{ fontSize: 13, color: C.ink2, fontWeight: 700 }}>Farm ID: {r.farm_id}</span>
        </div>
        <span style={{ fontSize: 12, color: C.ink3 }}>{r.created_at ? new Date(r.created_at).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}</span>
      </div>
      <div style={{ fontSize: 14, color: C.ink, display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
        <div><span style={{ color: C.ink3, fontSize: 12, marginRight: 6 }}>Email:</span>{r.consumer_email || "—"}</div>
        <div><span style={{ color: C.ink3, fontSize: 12, marginRight: 6 }}>Status:</span><span style={{ color: C.red, fontWeight: 700 }}>{r.payment_status || "—"}</span></div>
      </div>
      <button onClick={() => navigate(`/admin/reservations/event?farm_id=${r.farm_id}&event_start=${encodeURIComponent(r.pickup_start)}&highlight_reservation_id=${r.reservation_id}`)} style={{ fontSize: 13, fontWeight: 600, color: C.ink, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px", cursor: "pointer", marginTop: 6, width: "100%", transition: "0.2s" }} onMouseOver={(e) => e.currentTarget.style.background = C.border} onMouseOut={(e) => e.currentTarget.style.background = C.bg}>詳細を処理する →</button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif", padding: "24px 16px 64px", color: C.ink }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: C.ink2 }}>管理ダッシュボード</h1>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 24, alignItems: "start" }}>

          {/* ＝ 左カラム：農家検索 ＋ 消費者調査 ＝ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 48, maxWidth: 380, margin: "0 auto", width: "100%" }}>
            
            {/* 農家検索 */}
            <div>
              <div style={{ marginBottom: 16, borderBottom: `2px solid ${C.ink2}`, paddingBottom: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: C.ink2 }}>農家・予約管理</h2>
              </div>
              {searchError && <div style={{ marginBottom: 20, background: C.redLight, border: `1px solid ${C.redBorder}`, color: C.red, padding: "12px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>{searchError}</div>}

              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ background: C.cardBg, borderRadius: 12, padding: 20, border: `1px solid ${C.border}`, position: "relative", boxShadow: "0 4px 20px rgba(15,23,42,0.03)" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink2, marginBottom: 12 }}>農家を検索</div>
                  <div style={{ position: "relative" }}>
                    <input type="text" value={ownerKanaInput} onChange={(e) => setOwnerKanaInput(e.target.value)} placeholder="ひらがなで入力..." style={{ width: "100%", padding: "12px 12px 12px 40px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 15, color: C.ink, outline: "none", boxSizing: "border-box" }} onFocus={(e) => { e.target.style.borderColor = C.focus; e.target.style.boxShadow = `0 0 0 1px ${C.focus}`; }} onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = "none"; }} />
                    <svg viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 12, top: 13, width: 18, height: 18 }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  </div>
                  {ownerKanaInput.trim() !== "" && !isSearchingKana && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, marginTop: 6, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", background: C.cardBg, boxShadow: "0 8px 24px rgba(15,23,42,0.12)", maxHeight: 240, overflowY: "auto" }}>
                      {ownerKanaMatches.length > 0 ? (
                        ownerKanaMatches.map((m) => (
                          <div key={m.farm_id} onClick={() => navigate(`/admin/reservations/weeks?farm_id=${m.farm_id}`)} style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onMouseOver={(e) => e.currentTarget.style.background = C.bg} onMouseOut={(e) => e.currentTarget.style.background = "transparent"}>
                            <div><div style={{ fontSize: 14, fontWeight: 700 }}>{m.owner_full_name}</div><div style={{ fontSize: 12, color: C.ink3, marginTop: 2 }}>{m.owner_full_kana}</div></div>
                            <div style={{ fontSize: 12, color: C.ink3, background: C.border, padding: "4px 8px", borderRadius: 4, fontWeight: 600 }}>ID: {m.farm_id}</div>
                          </div>
                        ))
                      ) : ( <div style={{ padding: "16px", textAlign: "center", fontSize: 14, color: C.ink3 }}>見つかりません</div> )}
                    </div>
                  )}
                </div>

                <div style={{ background: C.cardBg, borderRadius: 12, padding: 20, border: `1px solid ${C.border}`, boxShadow: "0 4px 20px rgba(15,23,42,0.03)" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink2, marginBottom: 16 }}>IDで直接開く</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink3, marginBottom: 6 }}>システム照会ID</div>
                      <div style={{ display: "flex", gap: 8, height: 40 }}>
                        <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
                          <button type="button" {...resIdMinus} style={{ width: 36, background: C.bg, border: "none", borderRight: `1px solid ${C.border}`, cursor: "pointer", color: C.ink, fontSize: 16, userSelect: "none" }}>-</button>
                          <input type="text" inputMode="numeric" value={reservationIdInput} onChange={(e) => setReservationIdInput(e.target.value.replace(/[^0-9]/g, ""))} style={{ width: 64, textAlign: "center", border: "none", outline: "none", fontSize: 15, color: C.ink }} />
                          <button type="button" {...resIdPlus} style={{ width: 36, background: C.bg, border: "none", borderLeft: `1px solid ${C.border}`, cursor: "pointer", color: C.ink, fontSize: 16, userSelect: "none" }}>+</button>
                        </div>
                        <button onClick={handleReservationSearch} disabled={!reservationIdInput} style={{ flex: 1, background: reservationIdInput ? C.ink : C.border, color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: reservationIdInput ? "pointer" : "not-allowed", transition: "0.2s" }}>開く</button>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink3, marginBottom: 6 }}>Farm ID</div>
                      <div style={{ display: "flex", gap: 8, height: 40 }}>
                        <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
                          <button type="button" {...farmIdMinus} style={{ width: 36, background: C.bg, border: "none", borderRight: `1px solid ${C.border}`, cursor: "pointer", color: C.ink, fontSize: 16, userSelect: "none" }}>-</button>
                          <input type="text" inputMode="numeric" value={farmIdInput} onChange={(e) => setFarmIdInput(e.target.value.replace(/[^0-9]/g, ""))} style={{ width: 64, textAlign: "center", border: "none", outline: "none", fontSize: 15, color: C.ink }} />
                          <button type="button" {...farmIdPlus} style={{ width: 36, background: C.bg, border: "none", borderLeft: `1px solid ${C.border}`, cursor: "pointer", color: C.ink, fontSize: 16, userSelect: "none" }}>+</button>
                        </div>
                        <button onClick={handleFarmSearch} disabled={!farmIdInput} style={{ flex: 1, background: farmIdInput ? C.ink : C.border, color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: farmIdInput ? "pointer" : "not-allowed", transition: "0.2s" }}>開く</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div onClick={() => navigate("/admin/farms")} style={{ background: C.cardBg, borderRadius: 12, padding: "16px 20px", border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "0.2s", boxShadow: "0 4px 20px rgba(15,23,42,0.03)" }} onMouseOver={(e) => { e.currentTarget.style.borderColor = C.focus; e.currentTarget.style.color = C.focus; }} onMouseOut={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.ink; }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "inherit" }}>すべての農家一覧を見る</div>
                  <div style={{ fontSize: 18, color: "inherit", fontWeight: 700 }}>→</div>
                </div>
              </div>
            </div>

            {/* 消費者・ペナルティ調査 */}
            <div>
              <div style={{ marginBottom: 16, borderBottom: `2px solid ${C.ink2}`, paddingBottom: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: C.ink2 }}>消費者・ペナルティ調査</h2>
              </div>
              <form onSubmit={handleConsumerSearch} style={{ background: C.cardBg, padding: 20, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 24, boxShadow: "0 4px 20px rgba(15,23,42,0.03)" }}>
                <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 14, fontWeight: 600, color: C.ink2 }}>
                  <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><input type="radio" checked={consumerQueryMode === "reservation_id"} onChange={() => setConsumerQueryMode("reservation_id")} />照会ID</label>
                  <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><input type="radio" checked={consumerQueryMode === "email"} onChange={() => setConsumerQueryMode("email")} />メール</label>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type={consumerQueryMode === "reservation_id" ? "number" : "email"} min="1" value={consumerInputValue} onChange={e => setConsumerInputValue(e.target.value)} placeholder={consumerQueryMode === "reservation_id" ? "例: 1024" : "例: user@example.com"} style={{ flex: 1, width: "100%", padding: "12px 16px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 15, outline: "none", boxSizing: "border-box" }} onFocus={(e) => { e.target.style.borderColor = C.focus; e.target.style.boxShadow = `0 0 0 1px ${C.focus}`; }} onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = "none"; }} />
                  <button type="submit" disabled={loadingConsumer} style={{ padding: "0 20px", background: C.ink, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: loadingConsumer ? "not-allowed" : "pointer", transition: "0.2s" }}>調査</button>
                </div>
                {consumerError && <div style={{ color: C.red, marginTop: 12, fontSize: 13, fontWeight: 600, background: C.redLight, padding: "8px 12px", borderRadius: 6 }}>{consumerError}</div>}
              </form>

              {consumerResult && (
                <div style={{ background: C.cardBg, padding: "20px", borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: "0 4px 20px rgba(15,23,42,0.03)" }}>
                  <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.ink3, marginBottom: 8 }}>
                      ユーザー: <span style={{ color: C.ink, wordBreak: "break-all" }}>{consumerResult.email}</span> (ID: {consumerResult.consumer_id})
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                      状態: {getConsumerStatusLabel(consumerResult.penalty_status)}
                    </div>
                    <div style={{ display: "flex", gap: 12, padding: "12px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                      <div style={{ flex: 1, textAlign: "center" }}><div style={{ fontSize: 11, color: C.ink3, marginBottom: 4, fontWeight: 600 }}>合計カウント</div><div style={{ fontSize: 22, fontWeight: 700, color: consumerResult.penalty_count >= 3 ? C.red : consumerResult.penalty_count >= 2 ? "#d97706" : C.ink }}>{consumerResult.penalty_count}<span style={{ fontSize: 12, fontWeight: 500 }}> / 3</span></div></div>
                      <div style={{ width: 1, background: C.border }} />
                      <div style={{ flex: 1, textAlign: "center" }}><div style={{ fontSize: 11, color: C.ink3, marginBottom: 4, fontWeight: 600 }}>ノーショー</div><div style={{ fontSize: 18, fontWeight: 700, color: consumerResult.no_show_count >= 2 ? C.red : C.ink }}>{consumerResult.no_show_count}<span style={{ fontSize: 12, fontWeight: 500 }}>回</span></div></div>
                      <div style={{ width: 1, background: C.border }} />
                      <div style={{ flex: 1, textAlign: "center" }}><div style={{ fontSize: 11, color: C.ink3, marginBottom: 4, fontWeight: 600 }}>遅延キャンセル</div><div style={{ fontSize: 18, fontWeight: 700, color: consumerResult.late_cancel_count >= 2 ? C.red : C.ink }}>{consumerResult.late_cancel_count}<span style={{ fontSize: 12, fontWeight: 500 }}>回</span></div></div>
                    </div>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: C.ink2, marginBottom: 12 }}>過去1年のペナルティ履歴</h3>
                  {consumerResult.history.length === 0 ? (
                    <p style={{ color: C.ink3, fontSize: 13, margin: 0 }}>履歴はありません</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {consumerResult.history.map(h => {
                        const isNoShow = h.status === "no_show";
                        const isLateCancel = h.status === "cancelled" && h.is_late_cancel === 1;
                        return (
                          <div key={h.reservation_id} onClick={() => handleGoToHistoryEvent(h.reservation_id)} style={{ padding: 12, border: `1px solid ${isNoShow ? C.redBorder : "#fed7aa"}`, background: isNoShow ? C.redLight : "#fff7ed", borderRadius: 8, cursor: "pointer", transition: "border-color 0.2s" }} onMouseOver={(e) => e.currentTarget.style.borderColor = C.ink2} onMouseOut={(e) => e.currentTarget.style.borderColor = isNoShow ? C.redBorder : "#fed7aa"}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <b style={{ color: isNoShow ? C.red : "#c2410c", fontSize: 14 }}>{isNoShow ? "ノーショー（農家報告）" : "遅延キャンセル（3時間以内）"}</b>
                              <div style={{ fontSize: 12, color: C.ink3, fontWeight: 600 }}>{new Date(h.created_at).toLocaleDateString()}</div>
                            </div>
                            <div style={{ fontSize: 13, color: C.ink2, marginBottom: 10, fontWeight: 600, display: "flex", justifyContent: "space-between" }}><span>農家: {h.farm_name}</span><span style={{ fontSize: 11, fontWeight: 600, color: C.ink3, background: "#fff", padding: "2px 6px", borderRadius: 4, border: `1px solid ${C.border}` }}>ID: {h.reservation_id}</span></div>
                            {isNoShow && (
                              <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={(e) => { e.stopPropagation(); handleRevertStatus(h.reservation_id, "cancelled"); }} style={{ flex: 1, padding: "6px", fontSize: 11, fontWeight: 600, cursor: "pointer", background: "#fff", color: C.ink, border: `1px solid ${C.border}`, borderRadius: 6 }}>キャンセル扱いに</button>
                                <button onClick={(e) => { e.stopPropagation(); handleRevertStatus(h.reservation_id, "confirmed"); }} style={{ flex: 1, padding: "6px", fontSize: 11, fontWeight: 600, cursor: "pointer", background: "#fff", color: C.ink, border: `1px solid ${C.border}`, borderRadius: 6 }}>通常予約に戻す</button>
                              </div>
                            )}
                            {isLateCancel && (
                              <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={(e) => { e.stopPropagation(); handleClearLateCancel(h.reservation_id); }} style={{ width: "100%", padding: "6px", fontSize: 11, fontWeight: 600, cursor: "pointer", background: "#fff", color: C.ink, border: `1px solid ${C.border}`, borderRadius: 6 }}>遅延フラグを解除（ペナルティから除外）</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ＝ 右カラム：システム監視（アラート） ＝ */}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* ★ 要注意農家（累計2回以上のキャンセル） */}
            <div style={{ background: C.cardBg, borderRadius: 12, border: `2px solid ${warningFarmCount > 0 ? C.red : C.border}`, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: warningFarmCount > 0 ? "0 8px 24px rgba(220,38,38,0.15)" : "0 4px 20px rgba(15,23,42,0.03)" }}>
              <div style={{ background: warningFarmCount > 0 ? C.redLight : C.bg, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: warningFarmCount > 0 ? C.red : C.ink, lineHeight: 1.3 }}>要注意農家 <span style={{fontSize: 12, fontWeight: 600, opacity: 0.8}}>(過去1年で2回以上のキャンセル)</span></div>
                </div>
                {warningFarmCount > 0 && (
                  <div style={{ background: C.red, color: "#fff", fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0 }}>
                    {warningFarmCount} 件
                  </div>
                )}
              </div>
              <div style={{ maxHeight: "280px", overflowY: "auto", minHeight: 120 }}>
                {loadingAlerts ? (
                  <div style={{ padding: 40, textAlign: "center", color: C.ink3, fontSize: 14 }}>読み込み中...</div>
                ) : warningFarmCount > 0 ? (
                  alerts!.warning_farms!.map(f => {
                    const currentCount = f.cancel_count_a + f.cancel_count_b;
                    return (
                      <div 
                        key={f.farm_id} 
                        onClick={() => navigate(`/admin/reservations/weeks?farm_id=${f.farm_id}`)}
                        style={{ 
                          padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: "#fff", 
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          cursor: "pointer", transition: "background 0.2s"
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = C.bg}
                        onMouseOut={(e) => e.currentTarget.style.background = "#fff"}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: C.ink, background: C.border, padding: "2px 6px", borderRadius: 4 }}>ID:{f.farm_id}</span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{f.farm_name}</span>
                            {f.active_flag === 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: C.red, padding: "2px 6px", borderRadius: 4 }}>BAN中</span>}
                          </div>
                          <CancelCountBadges countA={f.cancel_count_a} countB={f.cancel_count_b} />
                        </div>
                        <div style={{ paddingLeft: 12 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckWarning(f.farm_id, currentCount);
                            }}
                            style={{
                              background: C.red, color: "#fff", border: "none", padding: "6px 12px",
                              borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.15)", transition: "0.2s", whiteSpace: "nowrap"
                            }}
                            onMouseOver={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
                            onMouseOut={(e) => e.currentTarget.style.transform = "translateY(0)"}
                          >
                            ✓ 確認済みにする
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: "40px 20px", textAlign: "center", color: C.ink3 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>要注意農家はいません</div>
                  </div>
                )}
              </div>
              
              {/* アーカイブリンク */}
              <div style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: "12px 20px", textAlign: "center" }}>
                <button onClick={handleOpenWarningArchive} style={{ background: "transparent", border: "none", color: C.ink2, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  過去の履歴（アーカイブ）を見る →
                </button>
              </div>
            </div>

            {/* 未確認の農家緊急受付停止 */}
            <div style={{ background: C.cardBg, borderRadius: 12, border: `1px solid ${unreadEmergencyCount > 0 ? C.ink : C.border}`, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 4px 20px rgba(15,23,42,0.03)" }}>
              <div style={{ background: unreadEmergencyCount > 0 ? C.ink : C.bg, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: unreadEmergencyCount > 0 ? "#fff" : C.ink, lineHeight: 1.3 }}>農家の緊急受付停止 <span style={{fontSize: 12, fontWeight: 600, opacity: 0.8}}>(未確認タスク)</span></div>
                </div>
                {unreadEmergencyCount > 0 && (
                  <div style={{ background: "#fff", color: C.ink, fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0 }}>
                    {unreadEmergencyCount} 件
                  </div>
                )}
              </div>
              
              <div style={{ maxHeight: "360px", overflowY: "auto", minHeight: 160 }}>
                {loadingAlerts ? (
                  <div style={{ padding: 40, textAlign: "center", color: C.ink3, fontSize: 14 }}>読み込み中...</div>
                ) : alertError ? (
                  <div style={{ padding: 40, textAlign: "center", color: C.red, fontSize: 14, fontWeight: 700 }}>{alertError}</div>
                ) : unreadEmergencyCount > 0 ? (
                  alerts!.emergency_cancels!.map(r => (
                    <div 
                      key={r.log_id} 
                      onClick={() => navigate(`/admin/reservations/weeks?farm_id=${r.farm_id}`)}
                      style={{ 
                        padding: "16px 20px", borderBottom: `1px solid ${C.border}`, 
                        background: r.reason === "B" ? "#fffbeb" : "#f8fafc", 
                        position: "relative", cursor: "pointer", transition: "background 0.2s",
                        display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = r.reason === "B" ? "#fef3c7" : "#eff6ff"}
                      onMouseOut={(e) => e.currentTarget.style.background = r.reason === "B" ? "#fffbeb" : "#f8fafc"}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: r.reason === "A" ? "#dbeafe" : "#fef3c7", color: r.reason === "A" ? "#1e40af" : "#92400e", border: `1px solid ${r.reason === "A" ? "#bfdbfe" : "#fde68a"}` }}>
                            {r.reason === "A" ? "災害・悪天候" : "自己都合"}
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{r.farm_name}</span>
                          <span style={{ fontSize: 11, color: C.ink3, fontWeight: 600 }}>ID: {r.farm_id}</span>
                        </div>
                        
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                           <CancelCountBadges countA={r.cancel_count_a} countB={r.cancel_count_b} />
                           <div style={{ fontSize: 11, color: C.ink3, fontWeight: 600 }}>
                             {new Date(r.created_at).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                           </div>
                        </div>
                      </div>
                      
                      <div style={{ paddingLeft: 12 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckEmergencyCancel(r.log_id);
                            }}
                            style={{
                              background: C.ink, color: "#fff", border: "none", padding: "6px 12px",
                              borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.15)", transition: "0.2s",
                              whiteSpace: "nowrap"
                            }}
                            onMouseOver={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
                            onMouseOut={(e) => e.currentTarget.style.transform = "translateY(0)"}
                          >
                            ✓ 確認済みにする
                          </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "60px 20px", textAlign: "center", color: C.ink3 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>未確認の緊急停止はありません</div>
                  </div>
                )}
              </div>

              {/* アーカイブリンク */}
              <div style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: "12px 20px", textAlign: "center" }}>
                <button onClick={handleOpenArchive} style={{ background: "transparent", border: "none", color: C.ink2, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  過去の履歴（アーカイブ）を見る →
                </button>
              </div>
            </div>

            {/* Payment Anomalies */}
            <div style={{ background: C.cardBg, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 4px 20px rgba(15,23,42,0.03)" }}>
              <div style={{ background: C.bg, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>Payment Anomalies</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.ink3, marginTop: 4, lineHeight: 1.3 }}>(決済完了・予約未確定)</div>
                </div>
                {anomalyCount > 0 && (
                  <div style={{ background: C.border, color: C.red, fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0 }}>{anomalyCount} 件</div>
                )}
              </div>
              <div style={{ maxHeight: "300px", overflowY: "auto", minHeight: 160 }}>
                {loadingAlerts ? (
                  <div style={{ padding: 40, textAlign: "center", color: C.ink3, fontSize: 14 }}>読み込み中...</div>
                ) : anomalyCount > 0 ? (
                  alerts!.payment_anomalies.map(renderAlertRow)
                ) : (
                  <div style={{ padding: "40px 20px", textAlign: "center", color: C.ink3 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>現在このエラーは発生していません</div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ─── アーカイブ表示モーダル (緊急停止) ─── */}
      {showArchive && ReactDOM.createPortal(
        <div
          onClick={() => setShowArchive(false)}
          style={{ position: "fixed", inset: 0, zIndex: 2147483647, background: "rgba(15,23,42,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
        >
          <div
            role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", width: "100%", maxWidth: "600px", maxHeight: "85vh", borderRadius: "16px", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 48px rgba(0,0,0,0.2)" }}
          >
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>緊急停止の履歴（過去100件）</h3>
              <button onClick={() => setShowArchive(false)} style={{ background: "none", border: "none", fontSize: 24, lineHeight: 1, color: C.ink3, cursor: "pointer", padding: 0 }}>×</button>
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", background: C.bg }}>
              {loadingArchive ? (
                <div style={{ padding: 40, textAlign: "center", color: C.ink3, fontSize: 14, fontWeight: 600 }}>読み込み中...</div>
              ) : archiveItems.length === 0 ? (
                <div style={{ padding: 60, textAlign: "center", color: C.ink3, fontSize: 14, fontWeight: 600 }}>履歴はありません</div>
              ) : (
                archiveItems.map((r, i) => (
                  <div 
                    key={`${r.log_id}-${i}`} 
                    onClick={() => {
                      setShowArchive(false);
                      navigate(`/admin/reservations/weeks?farm_id=${r.farm_id}`);
                    }}
                    style={{ 
                      padding: "16px 24px", borderBottom: `1px solid ${C.border}`, background: "#fff", 
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      cursor: "pointer", transition: "background 0.2s" 
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = C.bg}
                    onMouseOut={(e) => e.currentTarget.style.background = "#fff"}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: r.reason === "A" ? "#dbeafe" : "#fef3c7", color: r.reason === "A" ? "#1e40af" : "#92400e" }}>
                          {r.reason === "A" ? "災害" : "自己都合"}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{r.farm_name}</span>
                      </div>
                      
                      <div style={{ marginBottom: 12 }}>
                        <CancelCountBadges countA={r.cancel_count_a} countB={r.cancel_count_b} />
                      </div>

                      <div style={{ fontSize: 12, color: C.ink3, fontWeight: 600 }}>
                        {new Date(r.created_at).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        <span style={{ margin: "0 8px" }}>|</span> ID: {r.farm_id}
                      </div>
                    </div>
                    <div>
                      {r.is_checked === 1 ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.green, background: "#ecfdf5", padding: "4px 8px", borderRadius: 6, border: "1px solid #a7f3d0" }}>✓ 確認済</span>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.red, background: C.redLight, padding: "4px 8px", borderRadius: 6, border: `1px solid ${C.redBorder}` }}>未確認</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, textAlign: "right" }}>
              <button onClick={() => setShowArchive(false)} style={{ padding: "10px 24px", borderRadius: 8, background: C.border, color: C.ink, fontWeight: 700, border: "none", cursor: "pointer" }}>閉じる</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── アーカイブ表示モーダル (要注意農家) ─── */}
      {showWarningArchive && ReactDOM.createPortal(
        <div
          onClick={() => setShowWarningArchive(false)}
          style={{ position: "fixed", inset: 0, zIndex: 2147483647, background: "rgba(15,23,42,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
        >
          <div
            role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", width: "100%", maxWidth: "600px", maxHeight: "85vh", borderRadius: "16px", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 48px rgba(0,0,0,0.2)" }}
          >
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>要注意農家の履歴 (全件)</h3>
              <button onClick={() => setShowWarningArchive(false)} style={{ background: "none", border: "none", fontSize: 24, lineHeight: 1, color: C.ink3, cursor: "pointer", padding: 0 }}>×</button>
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", background: C.bg }}>
              {loadingWarningArchive ? (
                <div style={{ padding: 40, textAlign: "center", color: C.ink3, fontSize: 14, fontWeight: 600 }}>読み込み中...</div>
              ) : warningArchiveItems.length === 0 ? (
                <div style={{ padding: 60, textAlign: "center", color: C.ink3, fontSize: 14, fontWeight: 600 }}>履歴はありません</div>
              ) : (
                warningArchiveItems.map((f, i) => {
                  const currentCount = f.cancel_count_a + f.cancel_count_b;
                  const isChecked = currentCount <= f.warning_checked_count;

                  return (
                    <div 
                      key={`${f.farm_id}-${i}`} 
                      onClick={() => {
                        setShowWarningArchive(false);
                        navigate(`/admin/reservations/weeks?farm_id=${f.farm_id}`);
                      }}
                      style={{ 
                        padding: "16px 24px", borderBottom: `1px solid ${C.border}`, background: "#fff", 
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        cursor: "pointer", transition: "background 0.2s" 
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = C.bg}
                      onMouseOut={(e) => e.currentTarget.style.background = "#fff"}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: C.ink, background: C.border, padding: "2px 6px", borderRadius: 4 }}>ID:{f.farm_id}</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{f.farm_name}</span>
                          {f.active_flag === 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: C.red, padding: "2px 6px", borderRadius: 4 }}>BAN中</span>}
                        </div>
                        
                        <div style={{ marginBottom: 4 }}>
                          <CancelCountBadges countA={f.cancel_count_a} countB={f.cancel_count_b} />
                        </div>
                      </div>
                      <div>
                        {isChecked ? (
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.green, background: "#ecfdf5", padding: "4px 8px", borderRadius: 6, border: "1px solid #a7f3d0" }}>✓ 確認済</span>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.red, background: C.redLight, padding: "4px 8px", borderRadius: 6, border: `1px solid ${C.redBorder}` }}>未確認</span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, textAlign: "right" }}>
              <button onClick={() => setShowWarningArchive(false)} style={{ padding: "10px 24px", borderRadius: 8, background: C.border, color: C.ink, fontWeight: 700, border: "none", cursor: "pointer" }}>閉じる</button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}