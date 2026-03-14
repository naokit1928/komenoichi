import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "@/config/api";
import { PublicBottomBar } from "@/components/PublicBottomBar";

// ── Brand tokens (COLOR_STRATEGY.md準拠) ──
const C = {
  red:       "#C62828",
  ink:       "#1a1108",
  ink2:      "#4b3e2a",
  ink3:      "#7a6c58",
  border:    "#e8e2d8",
  bgPale:    "#f4f1ed",
  bgBase:    "#fdfcfa",
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
  
  // モーダル・処理用のState
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 退会確認用のフリクションState
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
      navigate("/", { replace: true });
    }
  };

  const handleDeleteAccount = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`${API_BASE}/api/consumers/me/delete`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const errData = await res.json();
        setDeleteError(errData.detail || "退会処理に失敗しました。");
        setIsDeleting(false);
        return;
      }
      navigate("/", { replace: true });
    } catch (e) {
      setDeleteError("通信エラーが発生しました。");
      setIsDeleting(false);
    }
  };

  const resetDeleteModal = () => {
    setShowDeleteModal(false);
    setCheck1(false);
    setCheck2(false);
    setConfirmText("");
    setDeleteError(null);
  };

  // ★ 共通レイアウトのラッパー
  const renderLayout = (child: React.ReactNode) => (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: C.bgBase, overflowX: "hidden" }}>
      {/* ★ 変更: 下部の余白(paddingBottom)を 80px -> 120px に広げ、フローティングボタンと被らないように調整 */}
      <div style={{ flexGrow: 1, padding: "24px 16px 120px", maxWidth: 640, margin: "0 auto", width: "100%" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 24, textAlign: "center" }}>
          アカウント
        </h1>
        {child}
      </div>
      <PublicBottomBar consumerEmail={identity?.email ?? null} />
    </div>
  );

  if (loading) return renderLayout(<div style={{ textAlign: "center", padding: "40px 0", color: C.ink3, fontWeight: 600 }}>読み込み中…</div>);

  // ==========================================
  // 未ログイン時の表示
  // ==========================================
  if (!identity || !identity.is_logged_in) {
    return renderLayout(
      <>
        {/* 未ログイン案内カード */}
        <div style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 15, color: C.ink, fontWeight: 700, marginBottom: 8 }}>
            現在ログインされていません
          </div>
          <div style={{ fontSize: 13, color: C.ink3, lineHeight: 1.6 }}>
            お米の予約へ進む際に、メールアドレスによる<br />ログイン（認証）が行われます。
          </div>
        </div>

        {/* 規約・サポートメニュー（未ログイン時） */}
        <div>
          <div style={{ fontSize: 13, color: C.ink3, fontWeight: 600, marginBottom: 8, paddingLeft: 8 }}>規約・サポート</div>
          <div style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            <a href="/law" target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", borderBottom: `1px solid ${C.border}`, textDecoration: "none", color: C.ink }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>特定商取引法に基づく表記</span>
              <span style={{ color: C.ink3, fontSize: 12 }}>＞</span>
            </a>
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", borderBottom: `1px solid ${C.border}`, textDecoration: "none", color: C.ink }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>利用規約</span>
              <span style={{ color: C.ink3, fontSize: 12 }}>＞</span>
            </a>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", textDecoration: "none", color: C.ink }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>プライバシーポリシー</span>
              <span style={{ color: C.ink3, fontSize: 12 }}>＞</span>
            </a>
          </div>
        </div>
      </>
    );
  }

  const canDelete = check1 && check2 && confirmText === "退会する";

  // ==========================================
  // ログイン時の表示
  // ==========================================
  return renderLayout(
    <>
      {/* ログイン中のアカウント ＆ ログアウト */}
      <div style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 32 }}>
        <div style={{ fontSize: 12, color: C.ink3, marginBottom: 6, fontWeight: 600 }}>ログイン中のアカウント</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, wordBreak: "break-all", marginBottom: 20 }}>
          {identity.email}
        </div>
        
        {/* ログアウトボタン */}
        <button
          onClick={() => setShowLogoutModal(true)}
          style={{ 
            width: "100%", padding: "12px 0", borderRadius: 8, 
            border: `1px solid ${C.border}`, backgroundColor: "#fff", 
            color: C.ink2, fontSize: 14, fontWeight: 600, cursor: "pointer",
            transition: "background-color 0.2s"
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = C.bgPale}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#fff"}
        >
          ログアウト
        </button>
      </div>

      {/* 規約・サポートメニュー */}
      <div>
        <div style={{ fontSize: 13, color: C.ink3, fontWeight: 600, marginBottom: 8, paddingLeft: 8 }}>規約・サポート</div>
        <div style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
          <a href="/law" target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", borderBottom: `1px solid ${C.border}`, textDecoration: "none", color: C.ink }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>特定商取引法に基づく表記</span>
            <span style={{ color: C.ink3, fontSize: 12 }}>＞</span>
          </a>
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", borderBottom: `1px solid ${C.border}`, textDecoration: "none", color: C.ink }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>利用規約</span>
            <span style={{ color: C.ink3, fontSize: 12 }}>＞</span>
          </a>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", textDecoration: "none", color: C.ink }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>プライバシーポリシー</span>
            <span style={{ color: C.ink3, fontSize: 12 }}>＞</span>
          </a>
        </div>
      </div>

      {/* 退会リンク（隔離） */}
      <div style={{ marginTop: 48, textAlign: "center" }}>
        <button
          onClick={() => setShowDeleteModal(true)}
          style={{ 
            background: "none", border: "none", color: "#9ca3af", fontSize: 13, 
            textDecoration: "underline", cursor: "pointer", padding: "8px 16px"
          }}
        >
          退会（アカウント削除）をご希望の方はこちら
        </button>
      </div>

      {/* ★ 変更: Airbnbスタイルのフローティングボタン (Floating Action Button) */}
      {identity.is_farmer && (
        <button
          onClick={() => navigate("/farmer")}
          style={{
            position: "fixed",
            bottom: "calc(64px + env(safe-area-inset-bottom) + 20px)", // コンシューマーボトムバーのすぐ上
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 800,
            backgroundColor: "#222222", // Airbnb特有のオフブラック
            color: "#ffffff",
            border: "none",
            borderRadius: 9999, // 完全な角丸（ピル型）
            padding: "14px 24px",
            fontSize: 14,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            boxShadow: "0 6px 16px rgba(0,0,0,0.2), 0 0 2px rgba(0,0,0,0.1)", // 浮き上がる影
            whiteSpace: "nowrap",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = "translateX(-50%) scale(0.96)"}
          onMouseUp={(e) => e.currentTarget.style.transform = "translateX(-50%) scale(1)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "translateX(-50%) scale(1)"}
          onTouchStart={(e) => e.currentTarget.style.transform = "translateX(-50%) scale(0.96)"}
          onTouchEnd={(e) => e.currentTarget.style.transform = "translateX(-50%) scale(1)"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 10v12" />
            <path d="M11 18l-4 4-4-4" />
            <path d="M17 14V2" />
            <path d="M21 6l-4-4-4 4" />
          </svg>
          農家モードへ
        </button>
      )}

      {/* ログアウトモーダル */}
      {showLogoutModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24, width: "90%", maxWidth: 360, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 12, textAlign: "center" }}>ログアウトしますか？</div>
            <div style={{ fontSize: 13, color: C.ink3, marginBottom: 24, textAlign: "center", lineHeight: 1.6 }}>
              次回ご予約の際に、再度メールアドレスの入力と認証が必要になります。
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowLogoutModal(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 9999, border: `1px solid ${C.border}`, backgroundColor: "#fff", color: C.ink, fontWeight: 600, cursor: "pointer" }}>キャンセル</button>
              <button onClick={handleLogout} style={{ flex: 1, padding: "12px 0", borderRadius: 9999, border: "none", backgroundColor: C.ink2, color: "#fff", fontWeight: 600, cursor: "pointer" }}>ログアウト</button>
            </div>
          </div>
        </div>
      )}

      {/* 退会確認モーダル */}
      {showDeleteModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24, width: "90%", maxWidth: 440, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.red, marginBottom: 12 }}>
              アカウントの削除（取り消し不可）
            </div>

            <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.6, marginBottom: 20 }}>
              <span style={{ fontWeight: 700, color: C.red, display: "block", marginBottom: 12 }}>
                ※受け取り待ちの予約がある場合は退会できません。
              </span>
              アカウントを削除するためには、以下の項目に同意してください。
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={check1} onChange={(e) => setCheck1(e.target.checked)} style={{ marginTop: 4, accentColor: C.red }} />
                <span style={{ fontSize: 13, color: C.ink2 }}>これまでの予約履歴や情報がすべて消去されることを理解しました。</span>
              </label>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={check2} onChange={(e) => setCheck2(e.target.checked)} style={{ marginTop: 4, accentColor: C.red }} />
                <span style={{ fontSize: 13, color: C.ink2 }}>この操作は絶対に取り消すことができず、データを元に戻せないことを理解しました。</span>
              </label>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, color: C.ink, fontWeight: 700, display: "block", marginBottom: 8 }}>
                確認のため「<span style={{ color: C.red }}>退会する</span>」と入力してください
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="退会する"
                style={{ width: "100%", padding: "12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, outline: "none", backgroundColor: C.bgBase }}
              />
            </div>

            {deleteError && (
              <div style={{ backgroundColor: "#FEF2F2", color: C.red, padding: "12px", borderRadius: 8, fontSize: 13, marginBottom: 24, fontWeight: 600 }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={resetDeleteModal}
                disabled={isDeleting}
                style={{ flex: 1, padding: "12px 0", borderRadius: 9999, border: `1px solid ${C.border}`, backgroundColor: "#FFFFFF", color: C.ink, fontWeight: 600, cursor: isDeleting ? "not-allowed" : "pointer" }}
              >
                キャンセル
              </button>

              <button
                onClick={handleDeleteAccount}
                disabled={!canDelete || isDeleting}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 9999, border: "none",
                  backgroundColor: canDelete ? C.red : "#fca5a5",
                  color: "#FFFFFF", fontWeight: 700,
                  cursor: canDelete && !isDeleting ? "pointer" : "not-allowed",
                  transition: "background-color 0.2s"
                }}
              >
                {isDeleting ? "処理中..." : "退会する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}