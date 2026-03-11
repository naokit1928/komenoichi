import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { API_BASE } from "@/config/api";

type FarmerMeResponse = {
  farm_id: number;
  is_registered: boolean;
  email: string | null;
};

export default function RequireFarmerSession() {
  const location = useLocation();

  const [status, setStatus] = useState<
    "checking" | "authorized" | "unauthorized" | "unregistered"
  >("checking");

  const [farmerData, setFarmerData] = useState<FarmerMeResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const res = await fetch(`${API_BASE}/api/farmer/me`, {
          credentials: "include",
        });

        if (cancelled) return;

        if (res.status === 401 || res.status === 403 || !res.ok) {
          setStatus("unauthorized");
          return;
        }

        const data: FarmerMeResponse = await res.json();
        setFarmerData(data);

        if (!data.is_registered) {
          setStatus("unregistered");
          return;
        }

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

  if (status === "checking") {
    return <div style={{ padding: 16 }}>認証を確認しています…</div>;
  }

  if (status === "unauthorized") {
    return (
      <Navigate
        to="/auth/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (
    status === "unregistered" &&
    location.pathname !== "/farmer/registration" &&
    location.pathname !== "/farmer/settings"
  ) {
    return <Navigate to="/farmer/registration" replace />;
  }

  if (status === "authorized" && location.pathname === "/farmer/registration") {
    return <Navigate to="/farmer/reservations" replace />;
  }

  return <Outlet context={farmerData} />;
}