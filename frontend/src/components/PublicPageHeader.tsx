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
        {/* SVGの直書きをやめて、画像タグで呼び出す */}
        <img
          src="/logo-mark.svg"
          alt="こめのいちロゴ"
          width="32"
          height="32"
          style={{ flexShrink: 0 }}
        />

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