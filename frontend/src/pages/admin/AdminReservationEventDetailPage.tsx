// frontend/src/pages/admin/AdminReservationEventDetailPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE } from "@/config/api";

import type {
  AdminReservationListItemDTO,
  AdminReservationListResponse,
} from "../../types/adminReservations";

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
  highlight: "#f1f5f9", 
  statusGreen: "#10B981", 
} as const;

const formatNumber = (n: number) =>
  new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(n);

const getStatusStyle = (status: string): React.CSSProperties => {
  if (status === "confirmed") return { background: C.ink, color: "#fff", border: `1px solid ${C.ink}` };
  if (status === "cancelled") return { background: C.redLight, color: C.red, border: `1px solid ${C.redBorder}` };
  return { background: C.bg, color: C.ink3, border: `1px solid ${C.border}` };
};

const getStatusLabel = (status: string): string => {
  if (status === "confirmed") return "確 定";
  if (status === "cancelled") return "キャンセル";
  return status;
};

// クリックでコピーできるコンポーネント
const CopyableText: React.FC<{ text: string, prefix?: string }> = ({ text, prefix = "" }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const displayText = text.length > 14 ? text.substring(0, 14) + "..." : text;

  return (
    <div
      onClick={handleCopy}
      title={copied ? "コピーしました！" : "クリックでコピー"}
      style={{
        display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer",
        padding: "2px 6px", margin: "-2px -6px", borderRadius: "4px",
        background: copied ? "#e2e8f0" : "transparent", transition: "background 0.2s",
      }}
      onMouseOver={(e) => { if (!copied) e.currentTarget.style.background = "#f1f5f9"; }}
      onMouseOut={(e) => { if (!copied) e.currentTarget.style.background = "transparent"; }}
    >
      <span>{prefix}{displayText}</span>
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.statusGreen} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      )}
    </div>
  );
};

const AdminReservationEventDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const farmIdParam = searchParams.get("farm_id");
  const eventStartParam = searchParams.get("event_start");
  const highlightReservationId = searchParams.get("highlight_reservation_id");
  const highlightId = highlightReservationId ? Number(highlightReservationId) : null;

  const farmId = farmIdParam ? Number(farmIdParam) : null;

  const [items, setItems] = useState<AdminReservationListItemDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ★ 追加: メモの折り畳み状態
  const [isMemoExpanded, setIsMemoExpanded] = useState(false);

  useEffect(() => {
    if (farmId == null || !eventStartParam) return;
    const controller = new AbortController();

    const fetchReservations = async () => {
      setLoading(true); setError(null);
      try {
        const params = new URLSearchParams({ farm_id: String(farmId), event_start: eventStartParam });
        const res = await fetch(`${API_BASE}/api/admin/reservations?` + params.toString(), { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: AdminReservationListResponse = await res.json();
        setItems(data.items || []);
      } catch (e: any) {
        if (e.name !== "AbortError") setError("予約一覧の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };
    fetchReservations();
    return () => controller.abort();
  }, [farmId, eventStartParam]);

  const headerPickupDisplay = items[0]?.pickup_display ?? "";
  const headerPickupPlaceName = items[0]?.pickup_place_name ?? "";
  const headerPickupMapUrl = items[0]?.pickup_map_url ?? "";
  const headerPickupDetailMemo = items[0]?.pickup_detail_memo ?? "";

  const ownerName = items.length > 0 ? `${items[0].owner_last_name ?? ""} ${items[0].owner_first_name ?? ""}`.trim() : "";
  const ownerKana = items.length > 0 ? `${items[0].owner_last_kana ?? ""} ${items[0].owner_first_kana ?? ""}`.trim() : "";
  const ownerPostalCode = items[0]?.owner_postcode ?? "";
  const ownerAddressLine = items[0]?.owner_address_line ?? "";
  const ownerPhone = items[0]?.owner_phone ?? "";
  const ownerEmail = items[0]?.owner_email ?? ""; 

  const { confirmedCount, cancelledCount } = useMemo(() => {
    let confirmed = 0; let cancelled = 0;
    items.forEach((r) => {
      if (r.reservation_status === "confirmed") confirmed += 1;
      else if (r.reservation_status === "cancelled") cancelled += 1;
    });
    return { confirmedCount: confirmed, cancelledCount: cancelled };
  }, [items]);

  const confirmedItems = useMemo(() => items.filter((r) => r.reservation_status === "confirmed"), [items]);
  const visibleItems = useMemo(() => items.filter((r) => r.reservation_status !== "pending" || highlightId === Number(r.reservation_id)), [items, highlightId]);
  const sumRiceSubtotal = useMemo(() => confirmedItems.reduce((sum, r) => sum + r.rice_subtotal, 0), [confirmedItems]);

  const isMemoLong = headerPickupDetailMemo.length > 35;

  if (!farmIdParam || !eventStartParam) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "24px 16px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", background: C.redLight, border: `1px solid ${C.redBorder}`, padding: "16px 20px", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.red }}>farm_id または event_start が指定されていません。</span>
          <button onClick={() => navigate(-1)} style={{ background: "transparent", border: "none", borderBottom: `1px solid ${C.ink}`, color: C.ink, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>戻る</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .desktop-only { display: block; }
        .mobile-only { display: none; }
        .admin-page-header { display: flex; justify-content: center; align-items: center; position: relative; margin-bottom: 36px; }
        .admin-page-back-btn-container { position: absolute; left: 0; }
        .admin-page-title-container { text-align: center; }
        
        .admin-top-cards { display: flex; gap: 24px; margin-bottom: 32px; align-items: stretch; }
        .admin-profile-card { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .admin-summary-card { flex: 1.3; display: flex; flex-direction: column; min-width: 0; }
        .admin-event-summary-inner { display: flex; gap: 24px; height: 100%; }
        .admin-event-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px 20px; }

        @media (max-width: 800px) {
          .admin-top-cards { flex-direction: column; gap: 24px; }
        }

        @media (max-width: 640px) {
          .admin-page-header { flex-direction: column; margin-bottom: 24px !important; }
          .admin-page-back-btn-container { position: static; width: 100%; text-align: left; margin-bottom: 12px; }
          .admin-page-title-container { width: 100%; }
          .admin-event-summary-inner { flex-direction: column; gap: 20px !important; }

          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; flex-direction: column; gap: 16px; }
        }
      `}</style>

      <div style={{
        minHeight: "100vh", background: C.bg,
        fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif",
        padding: "24px 16px", color: C.ink
      }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          
          <div className="admin-page-header">
            <div className="admin-page-back-btn-container">
              <button
                type="button"
                onClick={() => navigate(-1)}
                style={{
                  fontSize: 13, fontWeight: 700, color: C.ink, background: "transparent",
                  border: "none", borderBottom: `2px solid ${C.border}`, paddingBottom: 4,
                  cursor: "pointer", transition: "0.2s"
                }}
              >
                ← 戻る
              </button>
            </div>
            <div className="admin-page-title-container">
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: C.ink2 }}>
                予約イベント詳細
              </h1>
            </div>
          </div>

          {error && <div style={{ marginBottom: 24, background: C.redLight, border: `1px solid ${C.redBorder}`, color: C.red, padding: "12px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>{error}</div>}
          {loading && <div style={{ marginBottom: 24, fontSize: 14, color: C.ink3 }}>読み込み中...</div>}

          {!loading && !error && items.length > 0 && (
            <>
              <div className="admin-top-cards">
                
                {/* 1. 農家情報カード */}
                <div className="admin-profile-card" style={{
                  background: C.cardBg, borderRadius: 12, border: `1px solid ${C.border}`,
                  overflow: "hidden", boxShadow: "0 4px 20px rgba(15,23,42,0.03)"
                }}>
                  <div style={{
                    background: C.ink, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "0.05em" }}>FARMER PROFILE</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.border, background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: 4 }}>ID: {farmId}</span>
                  </div>
                  
                  <div style={{ padding: "20px 24px", flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{ownerName || "（未設定）"}</span>
                      {ownerKana && <span style={{ fontSize: 12, color: C.ink3 }}>{ownerKana}</span>}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 24px", fontSize: 13, color: C.ink2 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}><span style={{ color: C.ink3, fontSize: 11 }}>郵便番号:</span>{ownerPostalCode || "—"}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}><span style={{ color: C.ink3, fontSize: 11 }}>住所:</span>{ownerAddressLine || "—"}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}><span style={{ color: C.ink3, fontSize: 11 }}>電話番号:</span>{ownerPhone || "—"}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6, wordBreak: "break-all" }}><span style={{ color: C.ink3, fontSize: 11 }}>Email:</span>{ownerEmail || "—"}</div>
                    </div>
                  </div>
                </div>

                {/* 2. イベント集計カード */}
                <div className="admin-summary-card" style={{
                  background: C.cardBg, borderRadius: 12, border: `1px solid ${C.border}`,
                  overflow: "hidden", boxShadow: "0 4px 20px rgba(15,23,42,0.03)"
                }}>
                  <div style={{
                    background: C.ink, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "0.05em" }}>EVENT SUMMARY</span>
                  </div>

                  <div style={{ padding: "20px 24px", flex: 1, display: "flex", flexDirection: "column" }}>
                    <div className="admin-event-summary-inner">
                      
                      {/* 左側：日時と統計 */}
                      <div style={{ flex: 1.5, minWidth: 200, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 12, color: C.ink3, marginBottom: 4 }}>受け渡し日時</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{headerPickupDisplay}</div>
                        </div>

                        <div className="admin-event-stats">
                          <div>
                            <div style={{ fontSize: 11, color: C.ink3, marginBottom: 4 }}>お米合計（確のみ）</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>¥{formatNumber(sumRiceSubtotal)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: C.ink3, marginBottom: 4 }}>Status比率</div>
                            <div style={{ fontSize: 14, marginTop: 4 }}>
                              <span style={{ color: C.ink }}>確: <span style={{ fontWeight: 700 }}>{confirmedCount}</span></span>
                              <span style={{ color: C.border, margin: "0 6px" }}>|</span>
                              <span style={{ color: C.ink3 }}>キ: {cancelledCount}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 右側：場所（地図情報・クリッカブルカード） */}
                      {(headerPickupPlaceName || headerPickupDetailMemo || headerPickupMapUrl) && (
                        <div 
                          onClick={() => {
                            if (headerPickupMapUrl) window.open(headerPickupMapUrl, "_blank", "noopener,noreferrer");
                          }}
                          title={headerPickupMapUrl ? "Googleマップを開く" : undefined}
                          style={{ 
                            flex: 1, minWidth: 160, background: C.bg, border: `1px solid ${C.border}`, 
                            padding: "16px", borderRadius: 8, alignSelf: "stretch", display: "flex", flexDirection: "column",
                            cursor: headerPickupMapUrl ? "pointer" : "default", transition: "background 0.2s" 
                          }}
                          onMouseOver={(e) => { if (headerPickupMapUrl) e.currentTarget.style.background = C.highlight; }}
                          onMouseOut={(e) => { if (headerPickupMapUrl) e.currentTarget.style.background = C.bg; }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: C.ink3 }}>受け渡し場所</span>
                            {headerPickupMapUrl && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                              </svg>
                            )}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink2, marginBottom: 8 }}>{headerPickupPlaceName}</div>
                          
                          {headerPickupDetailMemo && (
                            <div style={{ fontSize: 12, color: C.ink3, whiteSpace: "pre-line", lineHeight: 1.5, flex: 1 }}>
                              {isMemoExpanded || !isMemoLong ? (
                                headerPickupDetailMemo
                              ) : (
                                <>
                                  {headerPickupDetailMemo.slice(0, 35)}...
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation(); // マップが開くのを防ぐ
                                      setIsMemoExpanded(true);
                                    }}
                                    style={{ color: C.ink, fontWeight: 700, marginLeft: 4, textDecoration: "underline", cursor: "pointer" }}
                                  >
                                    続き
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 予約リスト ── */}
              {visibleItems.length === 0 ? (
                <div style={{ fontSize: 13, color: C.ink3 }}>※ この受け渡し回には pending の予約のみ存在します。</div>
              ) : (
                <>
                  {/* PC用テーブル */}
                  <div className="desktop-only" style={{ background: C.cardBg, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 4px 20px rgba(15,23,42,0.03)" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900, textAlign: "left" }}>
                        <thead style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                          <tr>
                            <th style={{ padding: "16px 20px", fontSize: 12, fontWeight: 700, color: C.ink3, whiteSpace: "nowrap" }}>受渡番号</th>
                            <th style={{ padding: "16px 20px", fontSize: 12, fontWeight: 700, color: C.ink3, whiteSpace: "nowrap" }}>照会ID / 申込日時</th>
                            <th style={{ padding: "16px 20px", fontSize: 12, fontWeight: 700, color: C.ink3, whiteSpace: "nowrap" }}>顧客情報</th>
                            <th style={{ padding: "16px 20px", fontSize: 12, fontWeight: 700, color: C.ink3, whiteSpace: "nowrap" }}>注文内容 / 金額</th>
                            <th style={{ padding: "16px 20px", fontSize: 12, fontWeight: 700, color: C.ink3, whiteSpace: "nowrap", width: "240px" }}>決済情報</th>
                            <th style={{ padding: "16px 20px", fontSize: 12, fontWeight: 700, color: C.ink3, textAlign: "center", whiteSpace: "nowrap" }}>ステータス</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleItems.map(r => {
                            const isHighlight = highlightId === Number(r.reservation_id);
                            return (
                              <tr key={r.reservation_id} style={{ borderBottom: `1px solid ${C.border}`, background: isHighlight ? C.highlight : "transparent", transition: "background 0.2s" }} onMouseOver={(e) => e.currentTarget.style.background = isHighlight ? C.highlight : C.bg} onMouseOut={(e) => e.currentTarget.style.background = isHighlight ? C.highlight : "transparent"}>
                                <td style={{ padding: "16px 20px", whiteSpace: "nowrap", verticalAlign: "top" }}>
                                  <div style={{ fontSize: 20, fontWeight: 700, color: C.ink, letterSpacing: "0.05em" }}>
                                    {r.pickup_code || <span style={{ fontSize: 13, fontWeight: 400, color: C.ink3 }}>未発行</span>}
                                  </div>
                                </td>
                                <td style={{ padding: "16px 20px", whiteSpace: "nowrap", verticalAlign: "top" }}>
                                  <div style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 600, color: C.ink2, marginBottom: 6 }}>#{r.reservation_id}</div>
                                  <div style={{ fontSize: 12, color: C.ink3 }}>{r.created_at ? new Date(r.created_at).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                                </td>
                                <td style={{ padding: "16px 20px", whiteSpace: "nowrap", verticalAlign: "top" }}>
                                  <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 6 }}>{r.consumer_email || <span style={{ color: C.ink3, fontWeight: 400 }}>未取得</span>}</div>
                                  <div style={{ fontSize: 11, fontFamily: "monospace", color: C.ink3 }}>UID: {r.customer_user_id || "—"}</div>
                                </td>
                                <td style={{ padding: "16px 20px", whiteSpace: "nowrap", verticalAlign: "top" }}>
                                  <div style={{ fontSize: 14, fontWeight: 600, color: C.ink2, marginBottom: 6 }}>{r.items_display}</div>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>¥{formatNumber(r.rice_subtotal)}</div>
                                </td>
                                <td style={{ padding: "16px 20px", verticalAlign: "top", width: "240px" }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: r.payment_status === "succeeded" ? C.ink : C.ink3, marginBottom: 6 }}>{r.payment_status || "—"}</div>
                                  <div style={{ fontSize: 11, fontFamily: "monospace", color: C.ink3, marginTop: 2 }}>
                                    {r.payment_intent_id ? <CopyableText text={r.payment_intent_id} prefix="PI: " /> : "PI: —"}
                                  </div>
                                </td>
                                <td style={{ padding: "16px 20px", whiteSpace: "nowrap", verticalAlign: "top", textAlign: "center" }}>
                                  <span style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, ...getStatusStyle(r.reservation_status) }}>{getStatusLabel(r.reservation_status)}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* スマホ用縦積みカード */}
                  <div className="mobile-only">
                    {visibleItems.map(r => {
                      const isHighlight = highlightId === Number(r.reservation_id);
                      return (
                        <div key={r.reservation_id} style={{
                          background: isHighlight ? C.highlight : C.cardBg,
                          border: `1px solid ${isHighlight ? C.ink3 : C.border}`,
                          borderRadius: 12, padding: "16px 20px", boxShadow: "0 2px 10px rgba(15,23,42,0.02)"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, borderBottom: `1px solid ${isHighlight ? "#d1d5db" : C.border}`, paddingBottom: 12 }}>
                            <div>
                              <div style={{ fontSize: 11, color: C.ink3, marginBottom: 4 }}>受渡番号</div>
                              <div style={{ fontSize: 22, fontWeight: 700, color: C.ink, letterSpacing: "0.05em" }}>
                                {r.pickup_code || <span style={{ fontSize: 14, fontWeight: 400, color: C.ink3 }}>未発行</span>}
                              </div>
                            </div>
                            <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, ...getStatusStyle(r.reservation_status) }}>{getStatusLabel(r.reservation_status)}</span>
                          </div>
                          
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <span style={{ fontSize: 12, color: C.ink3 }}>ID / 申込</span>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 600, color: C.ink2 }}>#{r.reservation_id}</div>
                                <div style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>{r.created_at ? new Date(r.created_at).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                              </div>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <span style={{ fontSize: 12, color: C.ink3 }}>顧客情報</span>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, wordBreak: "break-all" }}>{r.consumer_email || "—"}</div>
                                <div style={{ fontSize: 11, fontFamily: "monospace", color: C.ink3, marginTop: 2 }}>UID: {r.customer_user_id || "—"}</div>
                              </div>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <span style={{ fontSize: 12, color: C.ink3 }}>注文内容 / 金額</span>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: C.ink2 }}>{r.items_display}</div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginTop: 2 }}>¥{formatNumber(r.rice_subtotal)}</div>
                              </div>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <span style={{ fontSize: 12, color: C.ink3 }}>決済情報</span>
                              <div style={{ textAlign: "right", maxWidth: "60%" }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: r.payment_status === "succeeded" ? C.ink : C.ink3 }}>{r.payment_status || "—"}</div>
                                <div style={{ fontSize: 11, fontFamily: "monospace", color: C.ink3, marginTop: 4 }}>
                                  {r.payment_intent_id ? <CopyableText text={r.payment_intent_id} prefix="PI: " /> : "PI: —"}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default AdminReservationEventDetailPage;