import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "@/config/api";

export default function HomeRedirectPage() {
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE}/api/consumer/state`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then((data) => {
        // ログイン済み かつ 有効な予約（active）が存在する場合
        if (data.is_logged_in && data.active?.exists) {
          // ★ 修正: 直接予約詳細に飛ばすのではなく、予約一覧（/reservations）へ飛ばす
          navigate("/reservations", { replace: true });
        } else {
          navigate("/farms", { replace: true });
        }
      })
      .catch((error) => {
        console.error("State取得エラー:", error);
        navigate("/farms", { replace: true });
      });
  }, [navigate]);

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "50px", color: "#7a6c58" }}>
      読み込み中...
    </div>
  );
}