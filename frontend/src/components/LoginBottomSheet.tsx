import React, { useState, useEffect } from "react";
import { API_BASE } from "@/config/api";

const C = {
  red:       "#C62828",
  ink:       "#222222",
  ink3:      "#717171",
  border:    "#dddddd",
} as const;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  redirectPath: string;
};

export function LoginBottomSheet({ isOpen, onClose, redirectPath }: Props) {
  const [authEmail, setAuthEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSent, setAuthSent] = useState(false);
  const [magicLinkUrl, setMagicLinkUrl] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendMagicLink = async () => {
    if (!authEmail) return;
    if (cooldown > 0) return;

    try {
      setAuthError("");
      setAuthLoading(true);
      setMagicLinkUrl(null);

      const res = await fetch(`${API_BASE}/api/auth/consumer/magic/send-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, redirect: redirectPath }), 
        credentials: "include", 
      });

      if (!res.ok) throw new Error("メールの送信に失敗しました。");

      const data = await res.json();
      if (data.debug_magic_link_url) setMagicLinkUrl(data.debug_magic_link_url);
      
      setAuthSent(true);
      setCooldown(60);
    } catch (e: any) {
      setAuthError(e.message ?? "エラーが発生しました");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setAuthSent(false);
      setAuthError("");
    }, 300);
  };

  if (!isOpen) return null;

  // ★ 追加: メールアドレスの形式チェック
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail);
  
  // ★ 変更: 正しいメール形式でない場合はボタンを無効化
  const isSubmitDisabled = authLoading || !isValidEmail || cooldown > 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <style>{`
        @keyframes slideUpSheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeInBackdrop { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div onClick={handleClose} style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", animation: "fadeInBackdrop 0.3s ease-out" }} />
      
      <div style={{
        position: "relative", backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16,
        height: "90vh",
        padding: "24px", animation: "slideUpSheet 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        boxShadow: "0 -4px 12px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column"
      }}>
        <button 
          onClick={handleClose} 
          style={{ position: "absolute", top: 16, left: 16, background: "none", border: "none", fontSize: 24, cursor: "pointer", color: C.ink, padding: "8px" }}
        >
          ✕
        </button>
        
        <div style={{ flex: 1, display: "flex", flexDirection: "column", marginTop: 48, alignItems: "center" }}>
          <img src="/logo-mark.svg" alt="こめのいち ロゴ" style={{ width: 64, height: 64, marginBottom: 24 }} />
          
          <h2 style={{ textAlign: "center", fontWeight: 700, fontSize: 22, color: C.ink, marginBottom: 40, lineHeight: 1.4, margin: "0 0 40px 0" }}>
            ログインまたは<br />登録してください
          </h2>

          <div style={{ width: "100%", maxWidth: 400, margin: "0 auto" }}>
            {!authSent ? (
              <>
                <input 
                  type="email" 
                  placeholder="メールアドレス" 
                  value={authEmail} 
                  onChange={e => setAuthEmail(e.target.value)} 
                  style={{ 
                    width: "100%", padding: "16px", border: "1px solid #B0B0B0", borderRadius: 8, 
                    fontSize: 16, outline: "none", marginBottom: 16, boxSizing: "border-box", color: C.ink
                  }} 
                />
                {authError && <div style={{ color: C.red, fontSize: 13, marginBottom: 16, fontWeight: 600 }}>{authError}</div>}
                
                <button 
                  onClick={handleSendMagicLink} 
                  disabled={isSubmitDisabled} 
                  style={{ 
                    width: "100%", padding: "16px 0", 
                    background: isSubmitDisabled ? "#d1d5db" : C.red, 
                    color: "#fff", 
                    borderRadius: 8, fontWeight: 600, fontSize: 16, border: "none", 
                    cursor: isSubmitDisabled ? "not-allowed" : "pointer",
                    transition: "background-color 0.2s ease"
                  }}
                >
                  {authLoading ? "送信中..." : cooldown > 0 ? `再送信可能まで ${cooldown}秒` : "続行"}
                </button>
              </>
            ) : (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 12 }}>メールを送信しました</p>
                <p style={{ fontSize: 14, color: C.ink3, lineHeight: 1.6, marginBottom: 24 }}>
                  <strong>{authEmail}</strong> 宛にログイン用のリンクをお送りしました。<br />
                  メール内のリンクをクリックしてください。
                </p>

                <button
                  onClick={() => {
                    setAuthSent(false);
                    setAuthError("");
                  }}
                  style={{
                    background: "none", border: "none", color: C.ink,
                    textDecoration: "underline", cursor: "pointer",
                    fontSize: 14, fontWeight: 600, padding: "8px 16px"
                  }}
                >
                  メールアドレスを入力し直す
                </button>

                {magicLinkUrl && (
                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px dashed ${C.border}`, textAlign: "left", wordBreak: "break-all" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>⚠️ 【開発用】テストリンク</div>
                    <a href={magicLinkUrl} style={{ color: "#2563eb", textDecoration: "underline", fontSize: 13 }}>{magicLinkUrl}</a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}