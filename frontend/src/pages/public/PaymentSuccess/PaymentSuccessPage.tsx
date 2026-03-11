// src/pages/public/PaymentSuccess/PaymentSuccessPage.tsx

import type { CSSProperties } from "react";

// ── Brand tokens ──────────────────────────────────
const C = {
  ink:  "#1a1108",
  ink2: "#4b3e2a", // ★ メインカラーを濃い茶色に
  ink3: "#7a6c58",
} as const;

export default function PaymentSuccessPage() {
  return (
    <div style={sx.container}>
      <style>{css}</style>

      <div style={sx.card}>
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
        </div>

        <h1 style={sx.title}>予約が完了しました</h1>

        <p style={sx.subtext}>
          ご予約内容・受け渡し場所などの詳細は、
          下のボタンからいつでもご確認いただけます。
        </p>

        <div
          style={{
            marginTop: 28,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <a
            href="/reservation/booked"
            style={sx.confirmBtn}
          >
            予約内容を確認する
          </a>
        </div>
      </div>
    </div>
  );
}

const sx: Record<string, CSSProperties> = {
  container: {
    padding: "20px 16px 40px",
    background: "#F9FAFB",
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
    background: C.ink2, // 濃い茶色へ変更
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
  confirmBtn: {
    display: "block",
    width: "100%",
    textAlign: "center",
    background: C.ink2, // 濃い茶色へ変更
    color: "#fff",
    textDecoration: "none",
    fontSize: 15,
    fontWeight: 600,
    padding: "14px",
    borderRadius: 9999,
    boxShadow: "0 4px 12px rgba(75, 62, 42, 0.2)", // 影も茶色ベースに
  },
};

const css = `
  a { -webkit-tap-highlight-color: rgba(0,0,0,0); }
  a:active { opacity: .9; }
`;