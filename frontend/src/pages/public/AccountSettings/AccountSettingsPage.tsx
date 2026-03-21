import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "@/config/api";
import { PublicBottomBar } from "@/components/PublicBottomBar";
import { LoginBottomSheet } from "@/components/LoginBottomSheet"; // ★追加
import { ModeTransition, triggerModeTransition } from "@/components/ModeTransition";

const C = {
  red:       "#C62828",
  ink:       "#222222",
  ink2:      "#4b3e2a",
  ink3:      "#717171",
  border:    "#dddddd",
  bgPale:    "#f7f7f7",
  bgBase:    "#ffffff",
} as const;

type ConsumerIdentity = {
  is_logged_in: boolean;
  email: string | null;
  is_farmer?: boolean;
  own_farm_id?: number | null;
};

export default function AccountSettingsPage() {
  const navigate = useNavigate();

  const [identity, setIdentity] = useState<ConsumerIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false); // これだけでOK
  
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [transitionActive, setTransitionActive] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/consumers/identity`, { credentials: "include" });
        if (!res.ok) {
          if (!canceled) setIdentity({ is_logged_in: false, email: null });
          return;
        }
        const data: ConsumerIdentity = await res.json();
        if (!canceled) setIdentity(data);
      } catch {
        if (!canceled) setIdentity({ is_logged_in: false, email: null });
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/consumer/logout`, { method: "POST", credentials: "include" });
    } finally {
      navigate("/farms", { replace: true });
    }
  };

  const handleDeleteAccount = async () => { /* 省略（そのまま） */ };
  const resetDeleteModal = () => { /* 省略（そのまま） */ };
  const canDelete = check1 && check2 && confirmText === "退会する";

  const renderLayout = (child: React.ReactNode) => (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: C.bgBase, overflowX: "hidden" }}>
      <div style={{ flexGrow: 1, padding: "24px 16px 120px", maxWidth: 640, margin: "0 auto", width: "100%" }}>
        {child}
      </div>
      <PublicBottomBar consumerEmail={identity?.email ?? null} />
    </div>
  );

  if (loading) return renderLayout(<div style={{ textAlign: "center", padding: "40px 0", color: C.ink3, fontWeight: 600 }}>読み込み中…</div>);

  // ==========================================
  // 未ログイン時
  // ==========================================
  if (!identity || !identity.is_logged_in) {
    return renderLayout(
      <>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: C.ink, marginBottom: 8, marginTop: 16 }}>
          アカウント
        </h1>
        <p style={{ fontSize: 15, color: C.ink3, marginBottom: 32 }}>
          ログインして、お米の予約や履歴の確認をしましょう
        </p>

        <button
          onClick={() => setShowAuthModal(true)}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 8,
            backgroundColor: C.ink, color: "#fff",
            fontSize: 16, fontWeight: 600, border: "none", cursor: "pointer",
            marginBottom: 48, transition: "transform 0.1s ease",
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.98)"}
          onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
        >
          ログインまたは登録
        </button>

        {/* 規約・サポートメニュー */}
        <div>
          <div style={{ backgroundColor: "#fff", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
            <a href="/law" target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderBottom: `1px solid ${C.border}`, textDecoration: "none", color: C.ink }}>
              <span style={{ fontSize: 16, fontWeight: 400 }}>特定商取引法に基づく表記</span><span style={{ color: C.ink, fontSize: 18 }}>›</span>
            </a>
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderBottom: `1px solid ${C.border}`, textDecoration: "none", color: C.ink }}>
              <span style={{ fontSize: 16, fontWeight: 400 }}>利用規約</span><span style={{ color: C.ink, fontSize: 18 }}>›</span>
            </a>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderBottom: `1px solid ${C.border}`, textDecoration: "none", color: C.ink }}>
              <span style={{ fontSize: 16, fontWeight: 400 }}>プライバシーポリシー</span><span style={{ color: C.ink, fontSize: 18 }}>›</span>
            </a>
          </div>
        </div>

        {/* ★ 共通化されたボトムシートを呼び出すだけ！ */}
        <LoginBottomSheet 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
          redirectPath="/farms" 
        />
      </>
    );
  }

  // ==========================================
  // ログイン時
  // ==========================================
  return renderLayout(
    <>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: C.ink, marginBottom: 24, marginTop: 16 }}>
        アカウント
      </h1>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: C.ink, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 600 }}>
          {identity.email ? identity.email.charAt(0).toUpperCase() : "U"}
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.ink, wordBreak: "break-all" }}>
          {identity.email}
        </div>
      </div>

      <div>
        <div style={{ backgroundColor: "#fff", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
          <a href="/law" target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderBottom: `1px solid ${C.border}`, textDecoration: "none", color: C.ink }}>
            <span style={{ fontSize: 16, fontWeight: 400 }}>特定商取引法に基づく表記</span><span style={{ color: C.ink, fontSize: 18 }}>›</span>
          </a>
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderBottom: `1px solid ${C.border}`, textDecoration: "none", color: C.ink }}>
            <span style={{ fontSize: 16, fontWeight: 400 }}>利用規約</span><span style={{ color: C.ink, fontSize: 18 }}>›</span>
          </a>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderBottom: `1px solid ${C.border}`, textDecoration: "none", color: C.ink }}>
            <span style={{ fontSize: 16, fontWeight: 400 }}>プライバシーポリシー</span><span style={{ color: C.ink, fontSize: 18 }}>›</span>
          </a>
          
          <button 
            onClick={() => setShowLogoutModal(true)} 
            style={{ 
              display: "flex", justifyContent: "space-between", alignItems: "center", 
              width: "100%", padding: "20px 0", background: "none", border: "none", 
              textDecoration: "none", color: C.ink, cursor: "pointer", textAlign: "left"
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 400 }}>ログアウト</span>
          </button>
        </div>
      </div>

      <div style={{ marginTop: 48, textAlign: "center" }}>
        <button
          onClick={() => setShowDeleteModal(true)}
          style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 13, textDecoration: "underline", cursor: "pointer", padding: "8px 16px" }}
        >
          退会（アカウント削除）をご希望の方はこちら
        </button>
      </div>

      {/* フローティングボタン */}
      {identity.is_farmer && (
        <button
          onClick={() => triggerModeTransition(setTransitionActive, navigate, "/farmer")}
          style={{
            position: "fixed",
            bottom: "calc(64px + env(safe-area-inset-bottom) + 20px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 800,
            backgroundColor: "#222222",
            color: "#ffffff",
            border: "none",
            borderRadius: 9999,
            padding: "14px 24px",
            fontSize: 14,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            boxShadow: "0 6px 16px rgba(0,0,0,0.2), 0 0 2px rgba(0,0,0,0.1)",
            whiteSpace: "nowrap",
            transition: "transform 0.1s ease",
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = "translateX(-50%) scale(0.96)"}
          onMouseUp={(e) => e.currentTarget.style.transform = "translateX(-50%) scale(1)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "translateX(-50%) scale(1)"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 10v12" /><path d="M11 18l-4 4-4-4" /><path d="M17 14V2" /><path d="M21 6l-4-4-4 4" />
          </svg>
          農家モードへ
        </button>
      )}

      {/* ログアウトモーダル等 省略せずにそのまま */}
      {showLogoutModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24, width: "90%", maxWidth: 360, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 24, textAlign: "center" }}>本当にログアウトしてもよろしいですか？</div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowLogoutModal(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: "#fff", color: C.ink, fontWeight: 600, cursor: "pointer" }}>キャンセル</button>
              <button onClick={handleLogout} style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: "none", backgroundColor: C.ink, color: "#fff", fontWeight: 600, cursor: "pointer" }}>ログアウト</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24, width: "90%", maxWidth: 440, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.red, marginBottom: 12 }}>アカウントの削除（取り消し不可）</div>
            <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.6, marginBottom: 20 }}><span style={{ fontWeight: 700, color: C.red, display: "block", marginBottom: 12 }}>※受け取り待ちの予約がある場合は退会できません。</span>アカウントを削除するためには、以下の項目に同意してください。</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={check1} onChange={(e) => setCheck1(e.target.checked)} style={{ marginTop: 4, accentColor: C.red }} /><span style={{ fontSize: 13, color: C.ink2 }}>これまでの予約履歴や情報がすべて消去されることを理解しました。</span></label>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={check2} onChange={(e) => setCheck2(e.target.checked)} style={{ marginTop: 4, accentColor: C.red }} /><span style={{ fontSize: 13, color: C.ink2 }}>この操作は絶対に取り消すことができず、データを元に戻せないことを理解しました。</span></label>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, color: C.ink, fontWeight: 700, display: "block", marginBottom: 8 }}>確認のため「<span style={{ color: C.red }}>退会する</span>」と入力してください</label>
              <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="退会する" style={{ width: "100%", padding: "12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, outline: "none", backgroundColor: C.bgBase }} />
            </div>
            {deleteError && (<div style={{ backgroundColor: "#FEF2F2", color: C.red, padding: "12px", borderRadius: 8, fontSize: 13, marginBottom: 24, fontWeight: 600 }}>{deleteError}</div>)}
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={resetDeleteModal} disabled={isDeleting} style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: "#FFFFFF", color: C.ink, fontWeight: 600, cursor: isDeleting ? "not-allowed" : "pointer" }}>キャンセル</button>
              <button onClick={handleDeleteAccount} disabled={!canDelete || isDeleting} style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: "none", backgroundColor: canDelete ? C.red : "#fca5a5", color: "#FFFFFF", fontWeight: 700, cursor: canDelete && !isDeleting ? "pointer" : "not-allowed", transition: "background-color 0.2s" }}>{isDeleting ? "処理中..." : "退会する"}</button>
            </div>
          </div>
        </div>
      )}
      <ModeTransition active={transitionActive} label="農家モードへ" />
    </>
  );
}