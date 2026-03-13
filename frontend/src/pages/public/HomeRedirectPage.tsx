import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function HomeRedirectPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // ログイン状態と有効な予約の有無を1回のAPI通信でまとめて取得
    // ※ViteのProxy機能を使用している前提で相対パス("/api/...")にしています。
    // もし別ドメインの場合は、`${API_BASE}/api/consumer/state` のように調整してください。
    fetch("/api/consumer/state", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then((data) => {
        // ログイン済み かつ 有効な予約（active）が存在する場合
        if (data.is_logged_in && data.active?.exists) {
          // 予約確認画面へ直接飛ばす
          navigate("/reservations/booked", { replace: true });
        } else {
          // 未ログイン、または有効な予約がない場合は農家一覧へ
          navigate("/farms", { replace: true });
        }
      })
      .catch((error) => {
        console.error("State取得エラー:", error);
        // エラー時は安全のため農家一覧へフォールバック
        navigate("/farms", { replace: true });
      });
  }, [navigate]);

  // 判定中（一瞬）のローディング表示
  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "50px", color: "#7a6c58" }}>
      読み込み中...
    </div>
  );
}