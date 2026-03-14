import React, { useState, useEffect } from "react";
import { API_BASE } from "@/config/api";
import { Link } from "react-router-dom";

// ── Brand tokens (農家向け黒統一) ──
const C = {
  ink:       "#111111",
  ink3:      "#64748b",
  border:    "#e2e8f0",
  bgPale:    "#f1f5f9",
  bgBase:    "#ffffff",
  red:       "#ef4444",
} as const;

export default function AuthEmailRegisterPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [magicLinkUrl, setMagicLinkUrl] = useState<string | null>(null);

  // ★ 追加: クールダウン用のState
  const [cooldown, setCooldown] = useState(0);

  // ★ 追加: クールダウンのカウントダウン処理
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendLink = async () => {
    if (!email) {
      setError("メールアドレスを入力してください。");
      return;
    }
    // ★ 追加: クールダウン中は送信させない
    if (cooldown > 0) return;

    try {
      setError("");
      setLoading(true);
      setMagicLinkUrl(null);

      const res = await fetch(`${API_BASE}/api/auth/farmer/magic/send-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include", 
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        
        if (res.status === 409 && data.detail === "email_already_registered") {
          throw new Error("このメールアドレスは既に登録されています。ログインしてください。");
        }
        
        throw new Error("メールの送信に失敗しました。");
      }

      const data = await res.json();
      if (data.debug_magic_link_url) {
        setMagicLinkUrl(data.debug_magic_link_url);
      }

      setSent(true);
      // ★ 追加: 送信成功時に60秒のクールダウンを開始
      setCooldown(60);
    } catch (e: any) {
      setError(e.message ?? "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bgBase }}>
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
          農家 新規登録
        </h1>

        {!sent ? (
          <div style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            
            <div style={{ color: C.ink, fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
              メールアドレスを入力してください。<br />
              登録用のリンクを送信します。
            </div>

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
              <div style={{ color: C.red, fontSize: 13, marginBottom: 16, fontWeight: 600, textAlign: "center" }}>
                {error}
                {error.includes("既に登録") && (
                   <div style={{ marginTop: 8 }}>
                     <Link to="/auth/login" style={{ color: "#2563eb", textDecoration: "underline" }}>
                       ログイン画面へ移動
                     </Link>
                   </div>
                )}
              </div>
            )}

            <button
              onClick={handleSendLink}
              disabled={loading || !email || cooldown > 0} // ★ クールダウン中も非活性に
              style={{
                width: "100%",
                display: "block",
                padding: "14px",
                background: (loading || cooldown > 0) ? "#d1d5db" : C.ink, // ★ 非活性時はグレーに
                color: "#ffffff",
                borderRadius: 9999,
                border: "none",
                fontWeight: 600,
                fontSize: 15,
                cursor: (loading || cooldown > 0) ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                marginTop: 8,
              }}
            >
              {/* ★ テキストを動的に切り替え */}
              {loading ? "送信中…" : cooldown > 0 ? `再送信可能まで ${cooldown}秒` : "登録リンクを送信"}
            </button>
            
            <div style={{ marginTop: 16, fontSize: 12, color: C.ink3, textAlign: "center", lineHeight: 1.6 }}>
              登録リンクを送信することで、<br />
              <a href="/terms/farmer" target="_blank" rel="noopener noreferrer" style={{ color: C.ink, textDecoration: "underline" }}>農家向け利用規約</a> および <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.ink, textDecoration: "underline" }}>プライバシーポリシー</a> に同意したものとみなされます。
            </div>

            <div style={{ marginTop: 24, textAlign: "center", fontSize: 13 }}>
              <span style={{ color: C.ink3 }}>アカウントをお持ちの方は </span>
              <Link to="/auth/login" style={{ color: "#2563eb", textDecoration: "underline" }}>
                こちらからログイン
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: "32px 24px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            
            <div style={{ 
              display: "inline-flex", alignItems: "center", justifyContent: "center", 
              width: 48, height: 48, borderRadius: "50%", backgroundColor: C.bgPale, color: C.ink, marginBottom: 16
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            
            <p style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 12 }}>
              メールを送信しました
            </p>
            <p style={{ fontSize: 14, color: C.ink3, lineHeight: 1.6, marginBottom: 24 }}>
              <strong>{email}</strong> 宛に登録用のリンクをお送りしました。<br />
              メール内のリンクをクリックして登録手続きへ進んでください。
            </p>

            {magicLinkUrl && (
              <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px dashed ${C.border}`, textAlign: "left", wordBreak: "break-all" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                  <span>⚠️</span> 【開発用】テスト登録リンク
                </div>
                <a
                  href={magicLinkUrl}
                  style={{
                    color: "#2563eb",
                    textDecoration: "underline",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  {magicLinkUrl}
                </a>
              </div>
            )}

            <button
              onClick={() => setSent(false)}
              style={{
                background: "none",
                border: "none",
                color: "#2563eb",
                textDecoration: "underline",
                cursor: "pointer",
                fontSize: 14,
                marginTop: 24,
              }}
            >
              戻る
            </button>

          </div>
        )}
      </section>
    </div>
  );
}