import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

type Tab = {
  key: string;
  label: string;
  path: string;
  icon: React.ReactNode;
};

const ACTIVE_COLOR = "#C62828";
const MUTED_COLOR = "#6B7280";

const TABS: Tab[] = [
  {
    key: "reservations",
    label: "今週の予約",
    path: "/farmer/reservations",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    key: "settings",
    label: "ページ編集",
    path: "/farmer/settings",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    ),
  },
  {
    key: "pickup",
    label: "受け渡し設定",
    path: "/farmer/pickup-settings",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    ),
  },
  {
    key: "menu",
    label: "アカウント",
    path: "/farmer/menu",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
];

export const BOTTOM_TAB_HEIGHT = 72;

export function FarmerBottomBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <nav
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: BOTTOM_TAB_HEIGHT,
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid #E5E7EB",
        display: "flex",
        zIndex: 1000,
        paddingBottom: "env(safe-area-inset-bottom)",
        alignItems: "center",
      }}
    >
      {TABS.map((tab) => {
        const active = isActive(tab.path);
        return (
          <button
            key={tab.key}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "8px 4px",
              border: "none",
              background: "none",
              fontSize: 10,
              fontWeight: active ? 700 : 500,
              color: active ? ACTIVE_COLOR : MUTED_COLOR,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <div style={{ color: "inherit" }}>{tab.icon}</div>
            <span style={{ color: "inherit" }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}