import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";

type Props = { consumerEmail?: string | null; hideMenu?: boolean };

export function PublicBottomBar({ consumerEmail, hideMenu = false }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const p = location.pathname;

  const RED = "#C62828";
  const MUTED = "#7a6c58";

  type Tab = { label: string; path: string | null; active: boolean; icon: React.ReactNode };

  const tabs: Tab[] = [
    {
      label: "お米を買う",
      path: "/farms",
      active: p === "/farms" || p.startsWith("/farms/"),
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
      ),
    },
    {
      label: "お気に入り",
      path: "/favorites", // ★ お気に入りページのURL（必要に応じて変更してください）
      active: p.startsWith("/favorites"),
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
      ),
    },
    {
      label: "受け取り予定",
      path: "/reservations",
      active: p.startsWith("/reservation"),
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
    },
    {
      label: "アカウント",
      path: "/account/settings",
      active: p.startsWith("/account"),
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
  ];

  if (hideMenu) return null;

  const bar = (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "rgba(253,252,250,0.96)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderTop: "1px solid #e8e2d8",
        zIndex: 900,
        height: "calc(64px + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        paddingLeft: 8,
        paddingRight: 8,
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.label}
          type="button"
          onClick={() => { if (tab.path) navigate(tab.path); }}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            padding: "8px 4px",
            cursor: tab.path ? "pointer" : "default",
            border: "none",
            background: "none",
            borderRadius: 12,
            color: tab.active ? RED : MUTED,
            fontFamily: "inherit",
          }}
        >
          <div style={{ color: "inherit" }}>{tab.icon}</div>
          <span
            style={{
              fontSize: 10,
              fontWeight: tab.active ? 700 : 500,
              color: "inherit",
            }}
          >
            {tab.label}
          </span>
        </button>
      ))}
    </nav>
  );

  return createPortal(bar, document.body);
}