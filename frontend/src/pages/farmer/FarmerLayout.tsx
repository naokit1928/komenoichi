import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

type Tab = {
  key: string;
  label: string;
  path: string;
};

const TABS: Tab[] = [
  {
    key: "reservations",
    label: "予約確認",
    path: "/farmer/reservations",
  },
  {
    key: "settings",
    label: "リスティング設定",
    path: "/farmer/settings",
  },
  {
    key: "pickup",
    label: "受け渡し設定",
    path: "/farmer/pickup-settings",
  },
  {
    key: "menu",
    label: "メニュー",
    path: "/farmer/menu",
  },
];

const BOTTOM_TAB_HEIGHT = 72;

export default function FarmerLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) =>
    location.pathname.startsWith(path);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#F7F7F7",
        paddingBottom: BOTTOM_TAB_HEIGHT,
      }}
    >
      {/* ===== ページ本体 ===== */}
      <Outlet />

      {/* ===== Bottom Tab ===== */}
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
                border: "none",
                background: "none",
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: active ? "#000000" : "#6B7280",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
