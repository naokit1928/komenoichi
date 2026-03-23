// frontend/src/pages/admin/AdminDashboardPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "@/config/api";
import type { AdminAlertsResponse, AdminReservationListItemDTO } from "../../types/adminReservations";

// ── Brand tokens (モノクローム基調の高コントラスト配色) ──
const C = {
  ink:       "#0f172a", // シャープな黒
  ink2:      "#334155", // 見出し用の濃いスレート
  ink3:      "#475569", // 補助テキスト用
  border:    "#cbd5e1", // 境界線
  bg:        "#f8fafc", // 無機質でクリーンな背景グレー
  cardBg:    "#ffffff", 
  red:       "#dc2626", 
  redLight:  "#fef2f2",
  redBorder: "#fecaca",
  focus:     "#0f172a", 
} as const;

type FarmOwnerMatch = {
  farm_id: number;
  owner_full_name: string;
  owner_full_kana: string;
};

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState<AdminAlertsResponse | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [alertError, setAlertError] = useState<string | null>(null);

  const [farmIdInput, setFarmIdInput] = useState("");
  const [reservationIdInput, setReservationIdInput] = useState("");
  
  // インクリメンタル検索用
  const [ownerKanaInput, setOwnerKanaInput] = useState("");
  const [ownerKanaMatches, setOwnerKanaMatches] = useState<FarmOwnerMatch[]>([]);
  const [isSearchingKana, setIsSearchingKana] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/reservations/alerts`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setAlerts(await res.json());
      } catch {
        setAlertError("アラートの取得に失敗しました。");
      } finally {
        setLoadingAlerts(false);
      }
    })();
  }, []);

  // インクリメンタル検索（Debounce）
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
          signal: controller.signal
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
      const res = await fetch(`${API_BASE}/api/admin/reservations/resolve-by-reservation-id?reservation_id=${n}`);
      if (!res.ok) throw new Error("Not Found");
      const data = await res.json();
      navigate(`/admin/reservations/event?farm_id=${data.farm_id}&event_start=${encodeURIComponent(data.event_start)}&highlight_reservation_id=${data.reservation_id}`);
    } catch {
      setSearchError("該当する予約が見つかりませんでした。");
    }
  };

  // カスタムスピナーの増減処理（0以下にはならない）
  const adjustId = (setter: React.Dispatch<React.SetStateAction<string>>, delta: number) => {
    setter(prev => {
      const num = parseInt(prev || "0", 10);
      const next = num + delta;
      return next > 0 ? String(next) : "";
    });
  };

  const anomalyCount = alerts?.payment_anomalies?.length ?? 0;

  const renderAlertRow = (r: AdminReservationListItemDTO) => (
    <div
      key={r.reservation_id}
      style={{
        padding: "16px 20px",
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        background: C.cardBg,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            background: C.redLight, color: C.red, padding: "4px 8px", borderRadius: 6,
            fontSize: 13, fontWeight: 700, border: `1px solid ${C.redBorder}`
          }}>
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

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif",
      padding: "24px 16px", color: C.ink
    }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>

        {/* 控えめな中央揃えヘッダー */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: C.ink2 }}>
            管理ダッシュボード
          </h1>
          <p style={{ fontSize: 13, color: C.ink3, marginTop: 6 }}>
            米直売プラットフォーム運営コンソール
          </p>
        </div>

        {searchError && (
          <div style={{
            marginBottom: 20, background: C.redLight, border: `1px solid ${C.redBorder}`,
            color: C.red, padding: "12px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600
          }}>
            {searchError}
          </div>
        )}

        {/* 1画面に収めるためのグリッドレイアウト（スマホ時は縦積み） */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", 
          gap: 24, 
          alignItems: "start" 
        }}>
          
          {/* ── 左カラム：コンパクトな検索とナビゲーション ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 380, margin: "0 auto", width: "100%" }}>
            
            {/* 1. スマート検索 */}
            <div style={{
              background: C.cardBg, borderRadius: 12, padding: 20,
              border: `1px solid ${C.border}`, position: "relative",
              boxShadow: "0 4px 20px rgba(15,23,42,0.03)"
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink2, marginBottom: 12 }}>
                農家を検索
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={ownerKanaInput}
                  onChange={(e) => setOwnerKanaInput(e.target.value)}
                  placeholder="ひらがなで入力..."
                  style={{
                    width: "100%", padding: "12px 12px 12px 40px", border: `1px solid ${C.border}`,
                    borderRadius: 8, fontSize: 15, color: C.ink, outline: "none", boxSizing: "border-box"
                  }}
                  onFocus={(e) => { e.target.style.borderColor = C.focus; e.target.style.boxShadow = `0 0 0 1px ${C.focus}`; }}
                  onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = "none"; }}
                />
                <svg viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ position: "absolute", left: 12, top: 13, width: 18, height: 18 }}>
                  <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                {isSearchingKana && (
                  <div style={{ position: "absolute", right: 12, top: 14, fontSize: 12, color: C.ink3 }}>検索中...</div>
                )}
              </div>

              {/* サジェストリスト */}
              {ownerKanaInput.trim() !== "" && !isSearchingKana && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                  marginTop: 6, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden",
                  background: C.cardBg, boxShadow: "0 8px 24px rgba(15,23,42,0.12)", maxHeight: 240, overflowY: "auto"
                }}>
                  {ownerKanaMatches.length > 0 ? (
                    ownerKanaMatches.map((m) => (
                      <div
                        key={m.farm_id}
                        onClick={() => navigate(`/admin/reservations/weeks?farm_id=${m.farm_id}`)}
                        style={{
                          padding: "12px 16px", borderBottom: `1px solid ${C.border}`,
                          display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer",
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = C.bg}
                        onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{m.owner_full_name}</div>
                          <div style={{ fontSize: 12, color: C.ink3, marginTop: 2 }}>{m.owner_full_kana}</div>
                        </div>
                        <div style={{ fontSize: 12, color: C.ink3, background: C.border, padding: "4px 8px", borderRadius: 4, fontWeight: 600 }}>
                          ID: {m.farm_id}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: "16px", textAlign: "center", fontSize: 14, color: C.ink3 }}>
                      見つかりません
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. ダイレクトジャンプ */}
            <div style={{
              background: C.cardBg, borderRadius: 12, padding: 20, border: `1px solid ${C.border}`,
              boxShadow: "0 4px 20px rgba(15,23,42,0.03)"
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink2, marginBottom: 16 }}>IDで直接開く</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                
                {/* 照会ID */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink3, marginBottom: 6 }}>システム照会ID</div>
                  <div style={{ display: "flex", gap: 8, height: 40 }}>
                    <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
                      <button type="button" onClick={() => adjustId(setReservationIdInput, -1)} style={{ width: 36, background: C.bg, border: "none", borderRight: `1px solid ${C.border}`, cursor: "pointer", color: C.ink, fontSize: 16 }}>-</button>
                      <input
                        type="text" inputMode="numeric" value={reservationIdInput}
                        onChange={(e) => setReservationIdInput(e.target.value.replace(/[^0-9]/g, ""))}
                        style={{ width: 64, textAlign: "center", border: "none", outline: "none", fontSize: 15, color: C.ink }}
                      />
                      <button type="button" onClick={() => adjustId(setReservationIdInput, 1)} style={{ width: 36, background: C.bg, border: "none", borderLeft: `1px solid ${C.border}`, cursor: "pointer", color: C.ink, fontSize: 16 }}>+</button>
                    </div>
                    <button
                      onClick={handleReservationSearch} disabled={!reservationIdInput}
                      style={{
                        flex: 1, background: reservationIdInput ? C.ink : C.border, color: "#fff", border: "none",
                        borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: reservationIdInput ? "pointer" : "not-allowed", transition: "0.2s"
                      }}
                    >
                      開く
                    </button>
                  </div>
                </div>

                {/* Farm ID */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink3, marginBottom: 6 }}>Farm ID</div>
                  <div style={{ display: "flex", gap: 8, height: 40 }}>
                    <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
                      <button type="button" onClick={() => adjustId(setFarmIdInput, -1)} style={{ width: 36, background: C.bg, border: "none", borderRight: `1px solid ${C.border}`, cursor: "pointer", color: C.ink, fontSize: 16 }}>-</button>
                      <input
                        type="text" inputMode="numeric" value={farmIdInput}
                        onChange={(e) => setFarmIdInput(e.target.value.replace(/[^0-9]/g, ""))}
                        style={{ width: 64, textAlign: "center", border: "none", outline: "none", fontSize: 15, color: C.ink }}
                      />
                      <button type="button" onClick={() => adjustId(setFarmIdInput, 1)} style={{ width: 36, background: C.bg, border: "none", borderLeft: `1px solid ${C.border}`, cursor: "pointer", color: C.ink, fontSize: 16 }}>+</button>
                    </div>
                    <button
                      onClick={handleFarmSearch} disabled={!farmIdInput}
                      style={{
                        flex: 1, background: farmIdInput ? C.ink : C.border, color: "#fff", border: "none",
                        borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: farmIdInput ? "pointer" : "not-allowed", transition: "0.2s"
                      }}
                    >
                      開く
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* 3. すべての農家一覧 */}
            <div
              onClick={() => navigate("/admin/farms")}
              style={{
                background: C.cardBg, borderRadius: 12, padding: "16px 20px", border: `1px solid ${C.border}`,
                display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "0.2s",
                boxShadow: "0 4px 20px rgba(15,23,42,0.03)"
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = C.focus; e.currentTarget.style.color = C.focus; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.ink; }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: "inherit" }}>すべての農家一覧を見る</div>
              <div style={{ fontSize: 18, color: "inherit", fontWeight: 700 }}>→</div>
            </div>

          </div>

          {/* ── 右カラム：アラート監視 ── */}
          <div style={{ width: "100%" }}>
            <div style={{
              background: C.cardBg, borderRadius: 12, border: `1px solid ${anomalyCount > 0 ? C.red : C.border}`,
              overflow: "hidden", display: "flex", flexDirection: "column",
              boxShadow: anomalyCount > 0 ? "0 8px 24px rgba(220,38,38,0.15)" : "0 4px 20px rgba(15,23,42,0.03)"
            }}>
              {/* ★ スマホで崩れないように alignItems: "flex-start" と flexWrap設定を導入 */}
              <div style={{
                background: anomalyCount > 0 ? C.red : C.bg,
                padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12
              }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: anomalyCount > 0 ? "#fff" : C.ink, lineHeight: 1.3 }}>
                    Payment Anomalies
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: anomalyCount > 0 ? C.redLight : C.ink3, marginTop: 4, lineHeight: 1.3 }}>
                    (決済完了・予約未確定)
                  </div>
                </div>
                {/* ★ flexShrink: 0 と nowrap でバッジが潰れるのを完全に防ぐ */}
                <div style={{
                  background: anomalyCount > 0 ? "#fff" : C.border, color: anomalyCount > 0 ? C.red : C.ink3,
                  fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0
                }}>
                  {anomalyCount} 件
                </div>
              </div>
              
              {/* スクロールバーが出ても画面全体のレイアウトは崩さない */}
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