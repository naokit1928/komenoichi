import React, { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
// ★ 追加: PublicBottomBar をインポート（※インポートパスは実際のフォルダ構成に合わせて調整してください 例: "../../components/PublicBottomBar" など）
import { PublicBottomBar } from "../../../components/PublicBottomBar";

// ── Brand tokens ──────────────────────────────────
const C = {
  ink:       "#1a1108",
  ink2:      "#4b3e2a",
  ink3:      "#7a6c58",
  border:    "#e8e2d8",
  bgBase:    "#fdfcfa",
  red:       "#A83020",
  bgPale:    "#f5f0e6", // ★ エラー回避のため追記（元のコードで送信完了画面のアイコン背景に使われていた色です）
} as const;

const LoginOnlyPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // ?redirect=/favorites などを取得
  const redirectTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("redirect") || "/farms"; // デフォルトは農家一覧へ
  }, [location.search]);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = import.meta.env.VITE_API_BASE;

  const handleSend = useCallback(async () => {
    if (!email) {
      setError("メールアドレスを入力してください");
      return;
    }

    if (!apiBase) {
      setError("API 設定が見つかりません");
      return;
    }

    try {
      setSending(true);
      setError(null);

      // リダイレクト先をバックエンドに伝えるためにパラメータを追加
      const targetUrl = `${apiBase}/api/auth/consumer/magic/send-login?redirect=${encodeURIComponent(redirectTo)}`;
      
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "送信に失敗しました");
      }

      // DEV: magic link をそのまま開けるようにしておく（本番では不要）
      const data = await res.json();
      if (data?.debug_magic_link_url) {
        console.log("DEBUG MAGIC LINK:", data.debug_magic_link_url);
      }

      setSent(true);
    } catch (e: any) {
      setError(e?.message || "ログインメールの送信に失敗しました");
    } finally {
      setSending(false);
    }
  }, [email, apiBase, redirectTo]);

  return (
    // ★ 修正: 下部に paddingBottom: "120px" を追加して、ボトムバーとコンテンツが重ならないようにしました
    <div style={{ minHeight: "100vh", backgroundColor: C.bgBase, paddingBottom: "120px" }}>
      <section
        style={{
          maxWidth: 420,
          margin: "0 auto",
          padding: "48px 16px 32px",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: C.ink,
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          ログイン
        </h1>

        {!sent && (
          <div style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <p
              style={{
                fontSize: 14,
                color: C.ink,
                marginBottom: 20,
                lineHeight: 1.6,
              }}
            >
              機能を利用するには、ご予約時に使用したメールアドレスを入力してください。
            </p>

            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                fontSize: 15,
                color: C.ink,
                marginBottom: 12,
                boxSizing: "border-box",
                outline: "none",
              }}
            />

            {error && (
              <div
                style={{
                  color: C.red,
                  fontSize: 13,
                  marginBottom: 16,
                  fontWeight: 600,
                  textAlign: "center"
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={sending}
              style={{
                width: "100%",
                display: "block",
                padding: "14px",
                background: sending ? "#d1d5db" : C.ink2,
                color: "#ffffff",
                borderRadius: 9999, // 丸ボタンに変更
                border: "none",
                fontWeight: 600,
                fontSize: 15,
                cursor: sending ? "default" : "pointer",
                transition: "all 0.2s",
                marginTop: 8,
              }}
            >
              {sending ? "送信中…" : "ログイン用メールを送信"}
            </button>

            <p
              style={{
                fontSize: 12,
                color: C.ink3,
                marginTop: 20,
                textAlign: "center",
                lineHeight: 1.6,
              }}
            >
              ※ メール内のリンクを開くと、<br />
              自動的に元のページへ戻ります。
            </p>
          </div>
        )}

        {sent && (
          <div style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: "32px 24px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ 
              display: "inline-flex", alignItems: "center", justifyContent: "center", 
              width: 48, height: 48, borderRadius: "50%", backgroundColor: C.bgPale, color: C.ink2, marginBottom: 16
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            
            <p style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 12 }}>
              メールを送信しました
            </p>
            <p style={{ fontSize: 14, color: C.ink3, lineHeight: 1.6, marginBottom: 24 }}>
              メール内のリンクを開いてください。<br />
              認証後、自動的に元のページに戻ります。
            </p>

            <button
              onClick={() => navigate("/farms")}
              style={{
                padding: "10px 24px",
                borderRadius: 9999,
                backgroundColor: "#fff",
                color: C.ink2,
                border: `1px solid ${C.border}`,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              農家一覧へ戻る
            </button>
          </div>
        )}
      </section>

      {/* ★ 追加: ボトムナビゲーションバーを表示 */}
      <PublicBottomBar />
    </div>
  );
};

export default LoginOnlyPage;