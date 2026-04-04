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
          transform: "translateX(-7px)",
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
          alignItems: "center",
        }}>
          <span style={{
            fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif",
            fontSize: 19,
            fontWeight: 400,
            letterSpacing: "0.21em",
            color: "#1a1108",
          }}>
            こめのいち
          </span>
          <span style={{
            fontSize: 10,
            letterSpacing: "0.22em",
            color: "#7a6c58",
            fontWeight: 400,
            marginTop: 4,
          }}>
            KOME NO ICHI
          </span>
        </div>
      </Link>
    </header>
  );
}
