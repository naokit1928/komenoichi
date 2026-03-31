import React, { useState } from "react";
import { useNavigate, useOutletContext, Link } from "react-router-dom";
import { API_BASE } from "@/config/api";
import { ModeTransition, triggerModeTransition } from "@/components/ModeTransition";

// グレー系カラー（農家モード固定）
const C = {
  ink:    "#111827",
  ink2:   "#374151",
  ink3:   "#6B7280",
  border: "#E5E7EB",
  bgPale: "#F9FAFB",
} as const;

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 4) return email;
  const head = local.slice(0, 2);
  const tail = local.slice(-2);
  return `${head}***${tail}@${domain}`;
}

type FarmerMeResponse = {
  farm_id: number;
  is_registered: boolean;
  email: string | null;
};

export default function FarmerMenu() {
  const navigate = useNavigate();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [transitionActive, setTransitionActive] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const farmerData = useOutletContext<FarmerMeResponse | null>();
  const email = farmerData?.email ?? null;

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/consumer/logout`, { method: "POST", credentials: "include" });
    } finally {
      navigate("/farms", { replace: true });
    }
  };

  const handleDeleteAccount = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`${API_BASE}/api/farmer/me/delete`, { method: "POST", credentials: "include" });
      if (!res.ok) {
        const errData = await res.json();
        setDeleteError(errData.detail || "退会処理に失敗しました。");
        setIsDeleting(false);
        return;
      }
      navigate("/farms", { replace: true });
    } catch {
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

  const canDelete = check1 && check2 && confirmText === "退会する";

  return (
    <div style={{ padding: "24px 16px 120px", maxWidth: 640, margin: "0 auto", position: "relative" }}>
      <style>{`
        .mode-switch-btn {
          position: fixed;
          bottom: calc(72px + env(safe-area-inset-bottom) + 20px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 800;
          background-color: #222222;
          color: #ffffff;
          border: none;
          border-radius: 9999px;
          padding: 14px 24px;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          box-shadow: 0 6px 16px rgba(0,0,0,0.2), 0 0 2px rgba(0,0,0,0.1);
          white-space: nowrap;
          transition: all 0.2s ease;
          font-family: inherit;
        }
        .mode-switch-btn:active {
          transform: translateX(-50%) scale(0.96);
        }
        .mode-switch-btn svg {
          width: 18px;
          height: 18px;
          transition: width 0.2s ease, height 0.2s ease;
        }

        /* iPad・タブレット以上の画面向け（地図ボタンと同じサイズ感） */
        @media (min-width: 768px) {
          .mode-switch-btn {
            padding: 16px 28px;
            font-size: 16px;
            gap: 10px;
            bottom: calc(72px + env(safe-area-inset-bottom) + 24px); 
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
          }
          .mode-switch-btn svg {
            width: 18px;
            height: 18px;
          }
        }
      `}</style>

      {/* ── タイトルとアバター ── */}
      <h1 style={{ fontSize: 26, fontWeight: 700, color: C.ink, marginBottom: 24, marginTop: 8 }}>
        メニュー
      </h1>
      
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          backgroundColor: C.ink, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, fontWeight: 600, flexShrink: 0,
        }}>
          {email ? email.charAt(0).toUpperCase() : "F"}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, wordBreak: "break-all" }}>
          {email ?? "（メール未取得）"}
        </div>
      </div>

      {/* ── メイン機能カード群 ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 40 }}>
        {/* 売上・履歴カード */}
        <Link
          to="/farmer/sales"
          style={{
            display: "block",
            backgroundColor: "#ffffff",
            borderRadius: 16,
            padding: "20px",
            textDecoration: "none",
            color: C.ink,
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
            border: `1px solid ${C.border}`,
            transition: "transform 0.1s ease-out, box-shadow 0.1s ease-out",
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = "scale(0.98)";
            e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.04)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.06)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.06)";
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* モノクロ グラフアイコン */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="20" x2="12" y2="10"></line>
                <line x1="18" y1="20" x2="18" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="16"></line>
              </svg>
              <span>売上・予約履歴</span>
            </div>
            <span style={{ color: C.ink3, fontSize: 20 }}>›</span>
          </div>
        </Link>

        {/* 販促ツールの印刷カード */}
        <Link
          to="/farmer/promotion"
          style={{
            display: "block",
            backgroundColor: "#ffffff",
            borderRadius: 16,
            padding: "20px",
            textDecoration: "none",
            color: C.ink,
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
            border: `1px solid ${C.border}`,
            transition: "transform 0.1s ease-out, box-shadow 0.1s ease-out",
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = "scale(0.98)";
            e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.04)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.06)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.06)";
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* モノクロ プリンターアイコン */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              <span>販促ツールの印刷</span>
            </div>
            <span style={{ color: C.ink3, fontSize: 20 }}>›</span>
          </div>
        </Link>
      </div>

      {/* ── メニューリスト ── */}
      <div style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <Link
          to="/terms/farmer?from=farmer"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderBottom: `1px solid ${C.border}`, textDecoration: "none", color: C.ink }}
        >
          <span style={{ fontSize: 16, fontWeight: 400 }}>農家向け利用規約</span>
          <span style={{ color: C.ink3, fontSize: 18 }}>›</span>
        </Link>
        <Link
          to="/law?from=farmer"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderBottom: `1px solid ${C.border}`, textDecoration: "none", color: C.ink }}
        >
          <span style={{ fontSize: 16, fontWeight: 400 }}>特定商取引法に基づく表記</span>
          <span style={{ color: C.ink3, fontSize: 18 }}>›</span>
        </Link>
        <Link
          to="/terms?from=farmer"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderBottom: `1px solid ${C.border}`, textDecoration: "none", color: C.ink }}
        >
          <span style={{ fontSize: 16, fontWeight: 400 }}>利用規約（一般）</span>
          <span style={{ color: C.ink3, fontSize: 18 }}>›</span>
        </Link>
        <Link
          to="/privacy?from=farmer"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderBottom: `1px solid ${C.border}`, textDecoration: "none", color: C.ink }}
        >
          <span style={{ fontSize: 16, fontWeight: 400 }}>プライバシーポリシー</span>
          <span style={{ color: C.ink3, fontSize: 18 }}>›</span>
        </Link>
        <button
          onClick={() => setShowLogoutModal(true)}
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            width: "100%", padding: "20px 0", background: "none", border: "none",
            color: C.ink, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 400 }}>ログアウト</span>
        </button>
      </div>

      {/* ── 退会リンク ── */}
      <div style={{ marginTop: 48, textAlign: "center" }}>
        <button
          onClick={() => setShowDeleteModal(true)}
          style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 13, textDecoration: "underline", cursor: "pointer", padding: "8px 16px" }}
        >
          退会（アカウント削除）をご希望の方はこちら
        </button>
      </div>

      {/* ── 予約者モードへ FAB ── */}
      <button
        className="mode-switch-btn"
        onClick={() => triggerModeTransition(setTransitionActive, navigate, "/farms")}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 10v12" /><path d="M11 18l-4 4-4-4" /><path d="M17 14V2" /><path d="M21 6l-4-4-4 4" />
        </svg>
        予約者モードへ
      </button>

      {/* ── ログアウト確認モーダル ── */}
      {showLogoutModal && (
        <div 
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
          onClick={() => setShowLogoutModal(false)} // ★ 外側クリックで閉じる
        >
          <div 
            style={{ backgroundColor: "#fff", borderRadius: 16, padding: 24, width: "90%", maxWidth: 360, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}
            onClick={(e) => e.stopPropagation()} // ★ 内側クリックでは閉じない
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 24, textAlign: "center" }}>
              本当にログアウトしてもよろしいですか？
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowLogoutModal(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: "#fff", color: C.ink, fontWeight: 600, cursor: "pointer" }}>キャンセル</button>
              <button onClick={handleLogout} style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: "none", backgroundColor: C.ink, color: "#fff", fontWeight: 600, cursor: "pointer" }}>ログアウト</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 退会確認モーダル ── */}
      {showDeleteModal && (
        <div 
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}
          onClick={resetDeleteModal} // ★ 外側クリックで閉じる
        >
          <div 
            style={{ backgroundColor: "#fff", borderRadius: 16, padding: 24, width: "90%", maxWidth: 440, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}
            onClick={(e) => e.stopPropagation()} // ★ 内側クリックでは閉じない
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 12 }}>アカウントの削除（取り消し不可）</div>
            <div style={{ fontSize: 14, color: C.ink2, lineHeight: 1.6, marginBottom: 20 }}>
              <span style={{ fontWeight: 600, color: C.ink, display: "block", marginBottom: 12 }}>※今後の予約が残っている場合は退会できません。</span>
              アカウントを削除するためには、以下の項目に同意してください。
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={check1} onChange={(e) => setCheck1(e.target.checked)} style={{ marginTop: 4, accentColor: C.ink }} />
                <span style={{ fontSize: 13, color: C.ink2 }}>農家情報が非公開となり、今後一切のログインができなくなることを理解しました。</span>
              </label>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={check2} onChange={(e) => setCheck2(e.target.checked)} style={{ marginTop: 4, accentColor: C.ink }} />
                <span style={{ fontSize: 13, color: C.ink2 }}>この操作は絶対に取り消すことができず、データを元に戻せないことを理解しました。</span>
              </label>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, color: C.ink, fontWeight: 600, display: "block", marginBottom: 8 }}>確認のため「退会する」と入力してください</label>
              <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="退会する"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
            {deleteError && (
              <div style={{ backgroundColor: C.bgPale, color: C.ink, padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 20, border: `1px solid ${C.border}` }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={resetDeleteModal} disabled={isDeleting} style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: "#fff", color: C.ink, fontWeight: 600, cursor: isDeleting ? "not-allowed" : "pointer" }}>キャンセル</button>
              <button onClick={handleDeleteAccount} disabled={!canDelete || isDeleting}
                style={{ flex: 1, padding: "12px 0", borderRadius: 8, border: "none", backgroundColor: canDelete ? C.ink : C.border, color: "#fff", fontWeight: 600, cursor: canDelete && !isDeleting ? "pointer" : "not-allowed", transition: "background-color 0.2s" }}>
                {isDeleting ? "処理中..." : "退会する"}
              </button>
            </div>
          </div>
        </div>
      )}
      <ModeTransition active={transitionActive} label="予約者モードへ" />
    </div>
  );
}