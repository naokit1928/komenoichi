import React, { useCallback, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

const LoginOnlyPage: React.FC = () => {
  const location = useLocation();

  // ?redirect=/reservation/booked
  const redirectTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("redirect") || "/reservation/booked";
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

      const res = await fetch(
        `${apiBase}/api/auth/consumer/magic/send-login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ email }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "送信に失敗しました");
      }

      // 開発環境では debug_magic_link_url が返る想定
      const data = await res.json();

      // DEV: magic link をそのまま開けるようにしておく（本番では不要）
      if (data?.debug_magic_link_url) {
        console.log("DEBUG MAGIC LINK:", data.debug_magic_link_url);
      }

      setSent(true);
    } catch (e: any) {
      setError(e?.message || "ログインメールの送信に失敗しました");
    } finally {
      setSending(false);
    }
  }, [email, apiBase]);

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <section
        style={{
          maxWidth: 420,
          margin: "0 auto",
          padding: "32px 16px",
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          ログイン
        </h1>

        {!sent && (
          <>
            <p
              style={{
                fontSize: 14,
                color: "#374151",
                marginBottom: 20,
                lineHeight: 1.6,
              }}
            >
              予約内容を確認するために、<br />
              ご予約時に使用したメールアドレスを入力してください。
            </p>

            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 14,
                marginBottom: 12,
              }}
            />

            {error && (
              <div
                style={{
                  color: "#b91c1c",
                  fontSize: 13,
                  marginBottom: 12,
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
                padding: "12px",
                background: sending ? "#9ca3af" : "#10B981",
                color: "#ffffff",
                borderRadius: 10,
                border: "none",
                fontWeight: 600,
                fontSize: 15,
                cursor: sending ? "default" : "pointer",
              }}
            >
              {sending ? "送信中…" : "ログイン用メールを送信"}
            </button>

            <p
              style={{
                fontSize: 12,
                color: "#6b7280",
                marginTop: 16,
                textAlign: "center",
              }}
            >
              ※ メール内のリンクを開くと、<br />
              自動的に予約内容ページへ戻ります。
            </p>
          </>
        )}

        {sent && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <p
              style={{
                fontSize: 15,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              ログイン用メールを送信しました
            </p>
            <p
              style={{
                fontSize: 14,
                color: "#374151",
                lineHeight: 1.6,
              }}
            >
              メール内のリンクを開いてください。<br />
              認証後、自動的に予約内容ページに戻ります。
            </p>

            <p
              style={{
                fontSize: 12,
                color: "#9ca3af",
                marginTop: 16,
              }}
            >
              （戻り先：{redirectTo}）
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default LoginOnlyPage;
