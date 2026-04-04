// src/pages/public/PaymentSuccess/PaymentSuccessPage.tsx
import React, { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { API_BASE } from "@/config/api";

// ── Brand tokens ──────────────────────────────────
const C = {
  ink:  "#1a1108",
  ink2: "#4b3e2a",
  ink3: "#7a6c58",
  border: "#e8e2d8",
  bgPale: "#f4f1ed",
} as const;

type BookedData = {
  reservation_id: number;
  context: {
    pickup_display: string;
    pickup_place_name?: string | null;
  };
};

export default function PaymentSuccessPage() {
  const [booked, setBooked] = useState<BookedData | null>(null);
  const [loadingBooked, setLoadingBooked] = useState(true);

  useEffect(() => {
    // 最新の確定予約を取得して受け渡し情報を表示する
    fetch(`${API_BASE}/api/reservations/booked/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBooked(d))
      .catch(() => setBooked(null))
      .finally(() => setLoadingBooked(false));
  }, []);

  return (
    <div style={sx.container}>
      <style>{css}</style>

      <div style={sx.card}>
        {/* ── チェックアイコン ── */}
        <div style={sx.iconWrap}>
          <div style={sx.circle}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="white"
              style={{ width: 28, height: 28, marginTop: 1 }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        </div>

        <h1 style={sx.title}>予約が確定しました</h1>

        <p style={sx.subtext}>
          確認メールをお送りしました。
        </p>

        {/* ── 予約情報サマリー ── */}
        {!loadingBooked && booked && (
          <div style={sx.summaryBox}>
            {/* 受け渡し日時 */}
            <div style={sx.summaryRow}>
              <span style={sx.summaryLabel}>受け渡し日時</span>
              <span style={sx.summaryValue}>{booked.context.pickup_display}</span>
            </div>

            {/* 受け渡し場所 */}
            {booked.context.pickup_place_name && (
              <div style={{ ...sx.summaryRow, borderTop: `1px solid ${C.border}` }}>
                <span style={sx.summaryLabel}>受け渡し場所</span>
                <span style={sx.summaryValue}>{booked.context.pickup_place_name}</span>
              </div>
            )}

            {/* 照会ID */}
            <div style={{ ...sx.summaryRow, borderTop: `1px solid ${C.border}` }}>
              <span style={sx.summaryLabel}>照会ID</span>
              <span style={{ ...sx.summaryValue, fontFamily: "monospace", letterSpacing: "0.04em" }}>
                {booked.reservation_id}
              </span>
            </div>
          </div>
        )}

        {/* ── ボタン ── */}
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <a href="/reservation/booked" style={sx.primaryBtn}>
            予約の詳細を確認する
          </a>
          <a href="/farms" style={sx.secondaryBtn}>
            農家一覧に戻る
          </a>
        </div>
      </div>
    </div>
  );
}

const sx: Record<string, CSSProperties> = {
  container: {
    padding: "20px 16px 40px",
    background: "#f9fafb",
    minHeight: "100vh",
  },
  card: {
    maxWidth: 640,
    margin: "0 auto",
    background: "#fff",
    padding: "28px 20px 36px",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  iconWrap: {
    textAlign: "center",
    marginTop: 8,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: C.ink,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    margin: "0 auto",
  },
  title: {
    marginTop: 14,
    fontSize: 20,
    lineHeight: "28px",
    fontWeight: 700,
    color: C.ink,
    textAlign: "center",
  },
  subtext: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: "20px",
    color: C.ink3,
    textAlign: "center",
  },
  summaryBox: {
    marginTop: 24,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    overflow: "hidden",
    background: "#fdfcfa",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    gap: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: C.ink3,
    fontWeight: 600,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  summaryValue: {
    fontSize: 14,
    color: C.ink,
    fontWeight: 700,
    textAlign: "right",
  },
  primaryBtn: {
    display: "block",
    width: "100%",
    textAlign: "center",
    background: C.ink,
    color: "#fff",
    textDecoration: "none",
    fontSize: 15,
    fontWeight: 600,
    padding: "14px",
    borderRadius: 9999,
    boxShadow: "0 4px 12px rgba(26, 17, 8, 0.2)",
    boxSizing: "border-box",
  },
  secondaryBtn: {
    display: "block",
    width: "100%",
    textAlign: "center",
    background: "#fff",
    color: C.ink2,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 600,
    padding: "12px",
    borderRadius: 9999,
    border: `1px solid ${C.border}`,
    boxSizing: "border-box",
  },
};

const css = `
  a { -webkit-tap-highlight-color: rgba(0,0,0,0); }
  a:active { opacity: .9; }
`;
