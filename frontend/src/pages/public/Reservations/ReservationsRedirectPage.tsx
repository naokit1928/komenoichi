import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE;

const ReservationsRedirectPage = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!API_BASE) {
          throw new Error("VITE_API_BASE_URL is not defined");
        }

        const res = await fetch(
          `${API_BASE}/api/public/reservations/latest`,
          { credentials: "include" }
        );

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`API Error: ${res.status} ${text}`);
        }

        const data = await res.json();

        if (typeof data?.reservation_id !== "number") {
          throw new Error(
            `Invalid response payload: ${JSON.stringify(data)}`
          );
        }

        navigate(
          `/reservation/booked?reservation_id=${data.reservation_id}`,
          { replace: true }
        );
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "Unknown error occurred");
      }
    })();
  }, [navigate]);

  if (error) {
    return (
      <div style={{ padding: 16, color: "#b91c1c" }}>
        <h2>予約ページへの遷移に失敗しました</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>{error}</pre>
      </div>
    );
  }

  return <div style={{ padding: 16 }}>読み込み中…</div>;
};

export default ReservationsRedirectPage;
