import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function HomeRedirectPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const redirect = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_BASE;
        if (!apiBase) {
          // 環境変数が無い場合は安全側に倒す
          navigate("/farms", { replace: true });
          return;
        }

        const res = await fetch(
          `${apiBase}/api/reservations/booked/me`,
          { credentials: "include" }
        );

        // 未ログイン → FarmsList
        if (res.status === 401) {
          navigate("/farms", { replace: true });
          return;
        }

        // 予約なし → FarmsList
        if (res.status === 404) {
          navigate("/farms", { replace: true });
          return;
        }

        // 想定外ステータス
        if (!res.ok) {
          navigate("/farms", { replace: true });
          return;
        }

        const data = await res.json();

        // 受け渡し終了 → FarmsList
        if (data.is_expired_for_display) {
          navigate("/farms", { replace: true });
          return;
        }

        // 有効な予約あり → ReservationBooked
        navigate("/reservation/booked", { replace: true });
      } catch (e) {
        // ネットワークエラー等
        navigate("/farms", { replace: true });
      }
    };

    redirect();
  }, [navigate]);

  // 一瞬表示されるだけのプレースホルダ
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontSize: 14,
        color: "#6b7280",
      }}
    >
      読み込み中…
    </div>
  );
}
