import React from "react";
import { Link } from "react-router-dom";

type Props = { title?: string };

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
          gap: 6,
          textDecoration: "none",
          color: "inherit",
          transform: "translateX(-6px)",
        }}
      >
        <img
          src="/logo-mark.svg"
          alt="こめのいちロゴ"
          width="44"
          height="44"
          style={{ flexShrink: 0 }}
        />

        <div style={{
          display: "flex",
          flexDirection: "column",
          lineHeight: 1,
          alignItems: "center", // ← flex-start から center に変更
        }}>
          <span style={{
            fontSize: 17,
            fontWeight: 400,
            letterSpacing: "0.18em", // ← 少し広めに
            color: "#1a1108",
          }}>
            こめのいち
          </span>
          <span style={{
            fontSize: 10, // ← 9 → 10 に少し大きく
            letterSpacing: "0.18em", // ← こめのいちと揃える
            color: "#7a6c58",
            fontWeight: 400, // ← 300（細すぎ）→ 400 に
            marginTop: 4,
          }}>
            KOME NO ICHI
          </span>
        </div>
      </Link>
    </header>
  );
}
