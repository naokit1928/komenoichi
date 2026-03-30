// frontend/src/pages/admin/AdminDashboardPage.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "@/config/api";
import type { AdminAlertsResponse, AdminReservationListItemDTO } from "../../types/adminReservations";

// ── Brand tokens (モノクローム基調の高コントラスト配色) ──
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

type FarmOwnerMatch = {
  farm_id: number;
  owner_full_name: string;
  owner_full_kana: string;
};

type HistoryItem = { reservation_id: number; status: string; created_at: string; farm_name: string };
type ConsumerSearchResult = {
  consumer_id: number; email: string; penalty_status: string;
  no_show_count: number; cancel_count: number; pardon_timestamp: number; history: HistoryItem[];
};

// ── ヘルパー: IDの安全な増減（1未満にはしない） ──
const adjustId = (setter: React.Dispatch<React.SetStateAction<string>>, delta: number) => {
  setter(prev => {
    const num = parseInt(prev || "0", 10);
    const next = num + delta;
    if (next < 1) return prev || ""; // 1未満には下げない
    return String(next);
  });
};

// ── カスタムフック: 長押し（ホールド）による連続増減 ──
function useSpin(setter: React.Dispatch<React.SetStateAction<string>>, delta: number) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const stop = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const start = useCallback(() => {
    stop(); // 二重起動防止
    adjustId(setter, delta); // 1回目は即時実行
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        adjustId(setter, delta);
      }, 80); // 80ms間隔で高速に連射
    }, 400); // 0.4秒押し続けたら連射開始
  }, [setter, delta, stop]);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(), // 長押し時のメニュー防止
  };
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  // ==========================================
  // 🌾 農家・システム管理系の State
  // ==========================================
  const [alerts, setAlerts] = useState<AdminAlertsResponse | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [alertError, setAlertError] = useState<string | null>(null);

  const [farmIdInput, setFarmIdInput] = useState("");
  const [reservationIdInput, setReservationIdInput] = useState("");
  
  // 長押し用のアクションを生成
  const farmIdMinus = useSpin(setFarmIdInput, -1);
  const farmIdPlus = useSpin(setFarmIdInput, 1);
  const resIdMinus = useSpin(setReservationIdInput, -1);
  const resIdPlus = useSpin(setReservationIdInput, 1);

  const [ownerKanaInput, setOwnerKanaInput] = useState("");
  const [ownerKanaMatches, setOwnerKanaMatches] = useState<FarmOwnerMatch[]>([]);
  const [isSearchingKana, setIsSearchingKana] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // ==========================================
  // 👤 消費者ペナルティ調査系の State
  // ==========================================
  const [consumerQueryMode, setConsumerQueryMode] = useState<"email" | "reservation_id">("reservation_id");
  const [consumerInputValue, setConsumerInputValue] = useState("");
  const [loadingConsumer, setLoadingConsumer] = useState(false);
  const [consumerError, setConsumerError] = useState<string | null>(null);
  const [consumerResult, setConsumerResult] = useState<ConsumerSearchResult | null>(null);


  // ─── 農家系 Effect & Handlers ───
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
    if (!q) {
      setOwnerKanaMatches([]);
      setIsSearchingKana(false);
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    setIsSearchingKana(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/farms/resolve-by-owner-kana?query=${encodeURIComponent(q)}`, {
          signal: controller.signal,
          credentials: "include"
        });
        if (!res.ok) throw new Error("API Error");
        const data = await res.json();
        setOwnerKanaMatches(Array.isArray(data.matches) ? data.matches : []);
      } catch (e: any) {
        if (e.name !== "AbortError") setSearchError("検索中にエラーが発生しました。");
      } finally {
        setIsSearchingKana(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
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
      const res = await fetch(`${API_BASE}/api/admin/reservations/resolve-by-reservation-id?reservation_id=${n}`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Not Found");
      const data = await res.json();
      navigate(`/admin/reservations/event?farm_id=${data.farm_id}&event_start=${encodeURIComponent(data.event_start)}&highlight_reservation_id=${data.reservation_id}`);
    } catch {
      setSearchError("該当する予約が見つかりませんでした。");
    }
  };

  const anomalyCount = alerts?.payment_anomalies?.length ?? 0;

  // ─── 消費者調査系 Handlers ───
  const handleConsumerSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consumerInputValue.trim()) return;
    
    setLoadingConsumer(true); setConsumerError(null); setConsumerResult(null);
    try {
      const param = consumerQueryMode === "email" ? `email=${encodeURIComponent(consumerInputValue)}` : `reservation_id=${consumerInputValue}`;
      const res = await fetch(`${API_BASE}/api/admin/consumers/penalty-search?${param}`, { credentials: "include" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "ユーザーが見つかりませんでした");
      }
      setConsumerResult(await res.json());
    } catch (err: any) {
      setConsumerError(err.message);
    } finally {
      setLoadingConsumer(false);
    }
  };

  const handleResetPardon = async () => {
    if (!consumerResult) return;
    if (!window.confirm("このユーザーの自己解除権（Pardon）をリセットし、もう一度チャンスを与えますか？")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/consumers/${consumerResult.consumer_id}/reset-pardon`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("失敗しました");
      alert("解除権をリセットしました。再検索して状態を確認してください。");
      setConsumerResult(null); 
    } catch (err: any) { alert(err.message); }
  };

  const handleRevertStatus = async (reservationId: number, newStatus: string) => {
    const actionName = newStatus === "confirmed" ? "【無効化（通常予約に戻す）】" : "【キャンセル扱いに変更】";
    if (!window.confirm(`照会ID: ${reservationId} のフラグを ${actionName} します。よろしいですか？`)) return;
    
    const secret = window.prompt(`[${actionName}] 実行のためのシークレットキー(ADMIN_SECRET)を入力してください:`);
    if (!secret) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/consumers/reservations/${reservationId}/revert-status`, {
        method: "POST", 
        headers: { "Content-Type": "application/json", "X-Admin-Secret": secret },
        body: JSON.stringify({ new_status: newStatus }), 
        credentials: "include"
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error("シークレットキーが間違っています。");
        throw new Error("失敗しました");
      }
      alert("ステータスを変更しました。再検索して状態を確認してください。");
      setConsumerResult(null);
    } catch (err: any) { alert(err.message); }
  };

  // ★ 追加: 履歴カードクリック時の詳細ジャンプ処理
  const handleGoToHistoryEvent = async (reservationId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/reservations/resolve-by-reservation-id?reservation_id=${reservationId}`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Not Found");
      const data = await res.json();
      navigate(`/admin/reservations/event?farm_id=${data.farm_id}&event_start=${encodeURIComponent(data.event_start)}&highlight_reservation_id=${data.reservation_id}`);
    } catch {
      alert("該当する予約のイベント情報が見つかりませんでした。");
    }
  };

  const getConsumerStatusLabel = (status: string) => {
    if (status === "banned") return <span style={{ color: C.red, fontWeight: 700 }}>完全BAN（利用停止）</span>;
    if (status === "locked_requestable") return <span style={{ color: "#d97706", fontWeight: 700 }}>一時ロック中（解除未申請）</span>;
    if (status === "locked_cooling") return <span style={{ color: "#0284c7", fontWeight: 700 }}>解除申請済み（72時間待機中）</span>;
    return <span style={{ color: C.green, fontWeight: 700 }}>通常（制限なし）</span>;
  };

  const renderAlertRow = (r: AdminReservationListItemDTO) => (
    <div
      key={r.reservation_id}
      style={{
        padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column", gap: 10, background: C.cardBg,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ background: C.redLight, color: C.red, padding: "4px 8px", borderRadius: 6, fontSize: 13, fontWeight: 700, border: `1px solid ${C.redBorder}` }}>
            #{r.reservation_id}
          </span>
          <span style={{ fontSize: 13, color: C.ink2, fontWeight: 700 }}>Farm ID: {r.farm_id}</span>
        </div>
        <span style={{ fontSize: 12, color: C.ink3 }}>
          {r.created_at ? new Date(r.created_at).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
        </span>
      </div>

      <div style={{ fontSize: 14, color: C.ink, display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
        <div><span style={{ color: C.ink3, fontSize: 12, marginRight: 6 }}>Email:</span>{r.consumer_email || "—"}</div>
        <div><span style={{ color: C.ink3, fontSize: 12, marginRight: 6 }}>Status:</span><span style={{ color: C.red, fontWeight: 700 }}>{r.payment_status || "—"}</span></div>
      </div>

      <button
        onClick={() => navigate(`/admin/reservations/event?farm_id=${r.farm_id}&event_start=${encodeURIComponent(r.pickup_start)}&highlight_reservation_id=${r.reservation_id}`)}
        style={{
          fontSize: 13, fontWeight: 600, color: C.ink, background: C.bg,
          border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px",
          cursor: "pointer", marginTop: 6, width: "100%", transition: "0.2s"
        }}
        onMouseOver={(e) => e.currentTarget.style.background = C.border}
        onMouseOut={(e) => e.currentTarget.style.background = C.bg}
      >
        詳細を処理する →
      </button>
    </div>
  );

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif",
      padding: "24px 16px 64px", color: C.ink
    }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: C.ink2 }}>
            管理ダッシュボード
          </h1>
        </div>

        {/* ====================================================
            メインレイアウト: 1つのGridに全体を統合し、完璧に幅を同調させる
        ==================================================== */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 24, alignItems: "start" }}>
          
          {/* 左カラム：農家検索 ＋ 消費者調査 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 48, maxWidth: 380, margin: "0 auto", width: "100%" }}>
            
            {/* ─── 農家・予約管理ブロック ─── */}
            <div>
              <div style={{ marginBottom: 16, borderBottom: `2px solid ${C.ink2}`, paddingBottom: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: C.ink2 }}>農家・予約管理</h2>
              </div>

              {searchError && (
                <div style={{ marginBottom: 20, background: C.redLight, border: `1px solid ${C.redBorder}`, color: C.red, padding: "12px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
                  {searchError}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* 1. スマート検索 */}
                <div style={{ background: C.cardBg, borderRadius: 12, padding: 20, border: `1px solid ${C.border}`, position: "relative", boxShadow: "0 4px 20px rgba(15,23,42,0.03)" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink2, marginBottom: 12 }}>農家を検索</div>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text" value={ownerKanaInput} onChange={(e) => setOwnerKanaInput(e.target.value)} placeholder="ひらがなで入力..."
                      style={{ width: "100%", padding: "12px 12px 12px 40px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 15, color: C.ink, outline: "none", boxSizing: "border-box" }}
                      onFocus={(e) => { e.target.style.borderColor = C.focus; e.target.style.boxShadow = `0 0 0 1px ${C.focus}`; }}
                      onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = "none"; }}
                    />
                    <svg viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 12, top: 13, width: 18, height: 18 }}>
                      <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    {isSearchingKana && <div style={{ position: "absolute", right: 12, top: 14, fontSize: 12, color: C.ink3 }}>検索中...</div>}
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
                      ) : (
                        <div style={{ padding: "16px", textAlign: "center", fontSize: 14, color: C.ink3 }}>見つかりません</div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. ダイレクトジャンプ */}
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

                {/* 3. すべての農家一覧 */}
                <div
                  onClick={() => navigate("/admin/farms")}
                  style={{ background: C.cardBg, borderRadius: 12, padding: "16px 20px", border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "0.2s", boxShadow: "0 4px 20px rgba(15,23,42,0.03)" }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = C.focus; e.currentTarget.style.color = C.focus; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.ink; }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "inherit" }}>すべての農家一覧を見る</div>
                  <div style={{ fontSize: 18, color: "inherit", fontWeight: 700 }}>→</div>
                </div>
              </div>
            </div>

            {/* ─── 消費者・ペナルティ調査ブロック ─── */}
            <div>
              <div style={{ marginBottom: 16, borderBottom: `2px solid ${C.ink2}`, paddingBottom: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: C.ink2 }}>消費者・ペナルティ調査</h2>
              </div>

              {/* 検索フォーム */}
              <form onSubmit={handleConsumerSearch} style={{ background: C.cardBg, padding: 20, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 24, boxShadow: "0 4px 20px rgba(15,23,42,0.03)" }}>
                <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 14, fontWeight: 600, color: C.ink2 }}>
                  <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="radio" checked={consumerQueryMode === "reservation_id"} onChange={() => setConsumerQueryMode("reservation_id")} /> 
                    照会ID
                  </label>
                  <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="radio" checked={consumerQueryMode === "email"} onChange={() => setConsumerQueryMode("email")} /> 
                    メール
                  </label>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input 
                    type={consumerQueryMode === "reservation_id" ? "number" : "email"} 
                    min="1"
                    value={consumerInputValue} onChange={e => setConsumerInputValue(e.target.value)} 
                    placeholder={consumerQueryMode === "reservation_id" ? "例: 1024" : "例: user@example.com"} 
                    style={{ flex: 1, width: "100%", padding: "12px 16px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 15, outline: "none", boxSizing: "border-box" }} 
                    onFocus={(e) => { e.target.style.borderColor = C.focus; e.target.style.boxShadow = `0 0 0 1px ${C.focus}`; }}
                    onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = "none"; }}
                  />
                  <button type="submit" disabled={loadingConsumer} style={{ padding: "0 20px", background: C.ink, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: loadingConsumer ? "not-allowed" : "pointer", transition: "0.2s" }}>
                    調査
                  </button>
                </div>
                {consumerError && <div style={{ color: C.red, marginTop: 12, fontSize: 13, fontWeight: 600, background: C.redLight, padding: "8px 12px", borderRadius: 6 }}>{consumerError}</div>}
              </form>

              {/* 検索結果 */}
              {consumerResult && (
                <div style={{ background: C.cardBg, padding: "20px", borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: "0 4px 20px rgba(15,23,42,0.03)" }}>
                  <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.ink3, marginBottom: 8 }}>
                      ユーザー: <span style={{ color: C.ink, wordBreak: "break-all" }}>{consumerResult.email}</span> (ID: {consumerResult.consumer_id})
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                      状態: {getConsumerStatusLabel(consumerResult.penalty_status)}
                    </div>
                    
                    <div style={{ display: "flex", gap: 20, padding: "12px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                      <div>
                        <div style={{ fontSize: 11, color: C.ink3, marginBottom: 4, fontWeight: 600 }}>無断キャンセル</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: consumerResult.no_show_count >= 2 ? C.red : C.ink }}>{consumerResult.no_show_count} <span style={{ fontSize: 12, fontWeight: 500 }}>回</span></div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: C.ink3, marginBottom: 4, fontWeight: 600 }}>通常キャンセル</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: consumerResult.cancel_count >= 3 ? C.red : C.ink }}>{consumerResult.cancel_count} <span style={{ fontSize: 12, fontWeight: 500 }}>回</span></div>
                      </div>
                    </div>

                    {consumerResult.pardon_timestamp > 0 && (
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.ink3, marginTop: 12 }}>※ 自己解除機能: 使用済み</div>
                    )}
                    
                    <button onClick={handleResetPardon} style={{ marginTop: 16, padding: "10px", width: "100%", background: "#fff", color: C.ink, border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "0.2s" }} onMouseOver={e => e.currentTarget.style.background = C.bg} onMouseOut={e => e.currentTarget.style.background = "#fff"}>
                      自己解除権の復活 (リセット)
                    </button>
                  </div>

                  <h3 style={{ fontSize: 15, fontWeight: 700, color: C.ink2, marginBottom: 12 }}>過去1年のフラグ履歴</h3>
                  {consumerResult.history.length === 0 ? (
                    <p style={{ color: C.ink3, fontSize: 13, margin: 0 }}>履歴はありません</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {consumerResult.history.map(h => (
                        <div 
                          key={h.reservation_id} 
                          onClick={() => handleGoToHistoryEvent(h.reservation_id)}
                          style={{ 
                            padding: 12, border: `1px solid ${h.status === "no_show" ? C.redBorder : C.border}`, 
                            background: h.status === "no_show" ? C.redLight : C.bg, borderRadius: 8,
                            cursor: "pointer", transition: "border-color 0.2s"
                          }}
                          onMouseOver={(e) => e.currentTarget.style.borderColor = C.ink2}
                          onMouseOut={(e) => e.currentTarget.style.borderColor = h.status === "no_show" ? C.redBorder : C.border}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <b style={{ color: h.status === "no_show" ? C.red : C.ink, fontSize: 14 }}>{h.status === "no_show" ? "無断キャンセル" : "通常キャンセル"}</b>
                            </div>
                            <div style={{ fontSize: 12, color: C.ink3, fontWeight: 600 }}>{new Date(h.created_at).toLocaleDateString()}</div>
                          </div>
                          <div style={{ fontSize: 13, color: C.ink2, marginBottom: h.status === "no_show" ? 12 : 0, fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
                            <span>農家: {h.farm_name}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: C.ink3, background: "#fff", padding: "2px 6px", borderRadius: 4, border: `1px solid ${C.border}` }}>ID: {h.reservation_id}</span>
                          </div>
                          
                          {h.status === "no_show" && (
                            <div style={{ display: "flex", gap: 8 }}>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleRevertStatus(h.reservation_id, "cancelled"); }} 
                                style={{ flex: 1, padding: "6px", fontSize: 11, fontWeight: 600, cursor: "pointer", background: "#fff", color: C.ink, border: `1px solid ${C.border}`, borderRadius: 6 }}
                              >
                                ｷｬﾝｾﾙ扱いに
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleRevertStatus(h.reservation_id, "confirmed"); }} 
                                style={{ flex: 1, padding: "6px", fontSize: 11, fontWeight: 600, cursor: "pointer", background: "#fff", color: C.ink, border: `1px solid ${C.border}`, borderRadius: 6 }}
                              >
                                通常予約に戻す
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ─── 右カラム：システム監視（アラート） ─── */}
          <div style={{ width: "100%" }}>
            <div style={{ background: C.cardBg, borderRadius: 12, border: `1px solid ${anomalyCount > 0 ? C.red : C.border}`, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: anomalyCount > 0 ? "0 8px 24px rgba(220,38,38,0.15)" : "0 4px 20px rgba(15,23,42,0.03)" }}>
              <div style={{ background: anomalyCount > 0 ? C.red : C.bg, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: anomalyCount > 0 ? "#fff" : C.ink, lineHeight: 1.3 }}>Payment Anomalies</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: anomalyCount > 0 ? C.redLight : C.ink3, marginTop: 4, lineHeight: 1.3 }}>(決済完了・予約未確定)</div>
                </div>
                <div style={{ background: anomalyCount > 0 ? "#fff" : C.border, color: anomalyCount > 0 ? C.red : C.ink3, fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0 }}>{anomalyCount} 件</div>
              </div>
              <div style={{ maxHeight: "calc(100vh - 160px)", overflowY: "auto", minHeight: 300 }}>
                {loadingAlerts ? (
                  <div style={{ padding: 40, textAlign: "center", color: C.ink3, fontSize: 14 }}>読み込み中...</div>
                ) : alertError ? (
                  <div style={{ padding: 40, textAlign: "center", color: C.red, fontSize: 14, fontWeight: 700 }}>{alertError}</div>
                ) : anomalyCount > 0 ? (
                  alerts!.payment_anomalies.map(renderAlertRow)
                ) : (
                  <div style={{ padding: "60px 20px", textAlign: "center", color: C.ink3 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>現在このエラーは発生していません</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>すべての決済と予約データは整合性が保たれています</div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}