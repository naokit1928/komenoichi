// frontend/src/components/AdminGuard.tsx
import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { API_BASE } from "@/config/api";

export default function AdminGuard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/consumers/identity`, { credentials: "include" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        
        if (!canceled) {
          if (data.is_admin) {
            setIsAdmin(true);
          } else {
            // 管理者でなければトップページへ強制送還
            navigate("/farms", { replace: true });
          }
        }
      } catch {
        if (!canceled) navigate("/farms", { replace: true });
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [navigate]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#475569" }}>認証中...</div>;
  }

  if (!isAdmin) {
    return null; // 権限がない場合は何も描画しない（直後にリダイレクトされるため）
  }

  // 管理者であれば、ラップしているアドミンのページを表示する
  return <Outlet />;
}