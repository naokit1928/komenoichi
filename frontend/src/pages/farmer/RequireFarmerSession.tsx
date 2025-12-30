import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { API_BASE } from "@/config/api";

/**
 * /farmer/* 用 セッション & 登録ガード
 *
 * 責務：
 * 1. 未ログイン → /auth/login
 * 2. ログイン済・未登録 → /farmer/registration
 * 3. ログイン済・登録完了 → 通過
 *
 * 前提：
 * - 認証状態の唯一の正はサーバーセッション
 * - farm_id / owner_farmer_id をフロントは一切保持しない
 * - 判定は /api/farmer/me のみを信頼する
 */
type FarmerMeResponse = {
  farm_id: number;
  is_registered: boolean;
};

export default function RequireFarmerSession() {
  const location = useLocation();

  const [status, setStatus] = useState<
    "checking" | "authorized" | "unauthorized" | "unregistered"
  >("checking");

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const res = await fetch(`${API_BASE}/api/farmer/me`, {
          credentials: "include",
        });

        if (cancelled) return;

        // 未ログイン
        if (res.status === 401 || res.status === 403) {
          setStatus("unauthorized");
          return;
        }

        if (!res.ok) {
          setStatus("unauthorized");
          return;
        }

        const data: FarmerMeResponse = await res.json();

        // ログイン済だが未登録
        if (!data.is_registered) {
          setStatus("unregistered");
          return;
        }

        // ログイン済 & 登録完了
        setStatus("authorized");
      } catch {
        if (!cancelled) {
          setStatus("unauthorized");
        }
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  // 判定中
  if (status === "checking") {
    return <div style={{ padding: 16 }}>認証を確認しています…</div>;
  }

  // 未ログイン → login
  if (status === "unauthorized") {
    return (
      <Navigate
        to="/auth/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

// 未登録 → registration
// ※ registration / settings は許可（登録フロー中）
if (
  status === "unregistered" &&
  location.pathname !== "/farmer/registration" &&
  location.pathname !== "/farmer/settings"
) {
  return <Navigate to="/farmer/registration" replace />;
}



  // ログイン済 & 登録完了
  return <Outlet />;
}
