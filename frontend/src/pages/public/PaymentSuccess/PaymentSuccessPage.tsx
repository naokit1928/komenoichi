// src/pages/public/PaymentSuccess/PaymentSuccessPage.tsx

import type { CSSProperties } from "react";

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
          ご予約内容・受け渡し場所などの必要な情報は、
          LINE 内の「予約確認メニュー」から必ずご確認ください。
        </p>

        <div style={{ marginTop: 28 }}>
          <a
            href="https://line.me/R/ti/p/@your_line_id"
            style={sx.confirmBtn}
          >
            LINEで予約内容を確認する
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
    background: "#10B981",
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
    color: "#111827",
    textAlign: "center",
  },
  subtext: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: "20px",
    color: "#4B5563",
    textAlign: "center",
  },
  confirmBtn: {
    display: "block",
    width: "100%",
    textAlign: "center",
    background: "#10B981",
    color: "#fff",
    textDecoration: "none",
    fontSize: 15,
    fontWeight: 600,
    padding: "12px 14px",
    borderRadius: 10,
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
};

const css = `
  a { -webkit-tap-highlight-color: rgba(0,0,0,0); }
  a:active { opacity: .9; }
`;
