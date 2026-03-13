import React from "react";
import { Link } from "react-router-dom";

type Props = { title?: string };

/**
 * PublicPageHeader — FarmsListPage 専用
 * sticky + すりガラス + インライン SVG とんぼ（モックアップ完全再現）
 * 他ページ（FarmDetail / Confirm 等）では SimplePageHeader を使うこと
 */
export function PublicPageHeader({ title }: Props) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(253,252,250,0.94)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #e8e2d8",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
      }}
    >
      <Link
        to="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 80 80"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <path d="M40 38 C34 30, 18 24, 6 28 C-2 31, -3 40, 8 42 C20 44, 36 39, 40 38Z"
            stroke="#C62828" strokeWidth="2.4" fill="rgba(168,48,32,0.06)" strokeLinejoin="round"/>
          <path d="M40 38 C46 30, 62 24, 74 28 C82 31, 83 40, 72 42 C60 44, 44 39, 40 38Z"
            stroke="#C62828" strokeWidth="2.4" fill="rgba(168,48,32,0.06)" strokeLinejoin="round"/>
          <path d="M40 42 C34 40, 18 40, 6 47 C0 51, 2 58, 12 58 C24 58, 37 50, 40 45Z"
            stroke="#C62828" strokeWidth="1.8" fill="rgba(168,48,32,0.04)" strokeLinejoin="round"/>
          <path d="M40 42 C46 40, 62 40, 74 47 C80 51, 78 58, 68 58 C56 58, 43 50, 40 45Z"
            stroke="#C62828" strokeWidth="1.8" fill="rgba(168,48,32,0.04)" strokeLinejoin="round"/>
          <line x1="40" y1="18" x2="40" y2="68" stroke="#C62828" strokeWidth="2.8" strokeLinecap="round"/>
          <circle cx="40" cy="14" r="6" fill="#C62828"/>
        </svg>

        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, alignItems: "center" }}>
          <span style={{ fontSize: 17, fontWeight: 400, letterSpacing: "0.12em", color: "#1a1108" }}>
            こめのいち
          </span>
          <span style={{ fontSize: 9, letterSpacing: "0.12em", color: "#7a6c58", fontWeight: 300, marginTop: 2 }}>
            KOME NO ICHI
          </span>
        </div>
      </Link>
    </header>
  );
}
