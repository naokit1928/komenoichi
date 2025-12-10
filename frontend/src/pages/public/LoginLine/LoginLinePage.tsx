import { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";



function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function LoginLinePage() {
  const query = useQuery();
  const navigate = useNavigate();
  const returnTo = decodeURIComponent(query.get("return_to") || "/farms");
  const clear = query.get("clear") === "1";
  const force = query.get("force") === "1";

  // 状態表示用
  const authed = localStorage.getItem("line_is_authenticated") === "1";
  const friended = localStorage.getItem("line_is_friend") === "1";

  if (clear) {
    localStorage.removeItem("LINE_LINKED");
    localStorage.removeItem("line_is_authenticated");
    localStorage.removeItem("line_is_friend");
    // URLだけで即リセットの場合はクエリを取り除く
    const url = new URL(window.location.href);
    url.searchParams.delete("clear");
    window.history.replaceState(null, "", url.toString());
  }

  const handleAuth = () => {
    localStorage.setItem("line_is_authenticated", "1");
    // 友だち追加済みなら連携済みフラグを立てる
    if (localStorage.getItem("line_is_friend") === "1") {
      localStorage.setItem("LINE_LINKED", "1");
    }
    // stay
  };

  const handleFriend = () => {
    localStorage.setItem("line_is_friend", "1");
    if (localStorage.getItem("line_is_authenticated") === "1") {
      localStorage.setItem("LINE_LINKED", "1");
    }
    // 連携が完了したら戻る。確認画面側が AUTO_PAY_AFTER_LINE を見て自動決済へ進む。
    navigate(returnTo);
  };

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: 12 }}>
      <h1 style={{ fontSize: 36, margin: "8px 0" }}>LINE連携が必要です</h1>
      <p>
        予約リマインド・ノーショー報告・評価機能のため、<b>LINEログイン</b>と<b>友だち追加</b>が必須です。
      </p>

      <div
        style={{
          borderTop: "1px dashed #888",
          borderBottom: "1px dashed #888",
          padding: 8,
          marginTop: 12,
        }}
      >
        <div style={{ fontWeight: "bold" }}>テスト用オプション</div>
        <div style={{ fontSize: 12 }}>
          <Link to={`/login/line?force=1&return_to=${encodeURIComponent(returnTo)}`}>
            毎回この画面を表示（force=1）
          </Link>{" "}
          <span> / </span>
          <Link to={`/login/line?clear=1&return_to=${encodeURIComponent(returnTo)}`}>URLだけで即リセット（clear=1）</Link>
        </div>
        <div style={{ fontSize: 12, marginTop: 6 }}>
          現在の状態: auth={String(authed)} / friend={String(friended)} / force={String(force)}
        </div>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #333" }}>
        <div style={{ padding: 8, borderBottom: "1px solid #333" }}>1) LINE ログイン</div>
        <button
          onClick={handleAuth}
          style={{ width: "100%", padding: 12, border: "none", background: "#eee" }}
        >
          LINEでログインする（モック）
        </button>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #333" }}>
        <div style={{ padding: 8, borderBottom: "1px solid #333" }}>2) 公式アカウントを友だち追加</div>
        <button
          onClick={handleFriend}
          style={{ width: "100%", padding: 12, border: "none", background: "#eee" }}
        >
          友だち追加を完了（モック）
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: 12 }}>
        戻り先: <code>{returnTo}</code>
      </div>

      <footer style={{ marginTop: 20, textAlign: "center" }}>© 2025 米直売@徳島</footer>
    </div>
  );
}
