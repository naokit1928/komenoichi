import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "@/config/api";
import { PublicBottomBar } from "@/components/PublicBottomBar"; // ★ ボトムバーを追加

type ConsumerIdentity = {
  is_logged_in: boolean;
  email: string | null;
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
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: "#fdfcfa" }}>
      <div style={{ flexGrow: 1, padding: "24px 16px", maxWidth: 640, margin: "0 auto", width: "100%" }}>
        {child}
      </div>
      {/* ボトムナビゲーションバーを常に表示 */}
      <PublicBottomBar consumerEmail={identity?.email ?? null} />
    </div>
  );

  if (loading) return renderLayout(<div style={{ textAlign: "center", padding: "40px 0" }}>読み込み中…</div>);

  // ★ 未ログイン時の表示
  if (!identity || !identity.is_logged_in) {
    return renderLayout(
      <>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>アカウント設定</h1>
        <div style={{ backgroundColor: "#F9FAFB", borderRadius: 12, padding: 16, color: "#374151", fontSize: 14 }}>
          現在ログインされていません。
        </div>

        {/* 未ログイン時でも法務ページへのリンクは表示する */}
        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 24, alignItems: "center" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "16px 24px", fontSize: 13 }}>
            <a href="/law" target="_blank" rel="noopener noreferrer" style={{ color: "#6B7280", textDecoration: "underline" }}>特定商取引法に基づく表記</a>
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#6B7280", textDecoration: "underline" }}>利用規約</a>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#6B7280", textDecoration: "underline" }}>プライバシーポリシー</a>
          </div>
        </div>
      </>
    );
  }

  const canDelete = check1 && check2 && confirmText === "退会する";

  // ★ ログイン時の表示
  return renderLayout(
    <>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>アカウント設定</h1>

      <div style={{ backgroundColor: "#F9FAFB", borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 4 }}>ログイン中</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: "#111827", wordBreak: "break-all" }}>
          {identity.email}
        </div>
      </div>

      <button
        onClick={() => setShowLogoutModal(true)}
        style={{ width: "100%", padding: "14px 0", fontSize: 16, backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 12, cursor: "pointer" }}
      >
        ログアウト
      </button>

      {/* 法務ページへのリンク集 ＆ 退会への導線 */}
      <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 24, alignItems: "center" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "16px 24px", fontSize: 13 }}>
          <a href="/law" target="_blank" rel="noopener noreferrer" style={{ color: "#6B7280", textDecoration: "underline" }}>特定商取引法に基づく表記</a>
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#6B7280", textDecoration: "underline" }}>利用規約</a>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#6B7280", textDecoration: "underline" }}>プライバシーポリシー</a>
        </div>

        <button
          onClick={() => setShowDeleteModal(true)}
          style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 13, textDecoration: "underline", cursor: "pointer" }}
        >
          退会（アカウント削除）をご希望の方はこちら
        </button>
      </div>

      {/* ログアウトモーダル */}
      {showLogoutModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20, width: "90%", maxWidth: 360 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>本当にログアウトしますか？</div>
            <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>購入の際に再度ログインが必要になります。</div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowLogoutModal(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid #E5E7EB", backgroundColor: "#FFFFFF", cursor: "pointer" }}>キャンセル</button>
              <button onClick={handleLogout} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", backgroundColor: "#111827", color: "#FFFFFF", cursor: "pointer" }}>ログアウトする</button>
            </div>
          </div>
        </div>
      )}

      {/* 退会確認モーダル */}
      {showDeleteModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24, width: "90%", maxWidth: 440 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#DC2626", marginBottom: 12 }}>
              アカウントの削除（取り消し不可）
            </div>

            <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, marginBottom: 20 }}>
              <span style={{ fontWeight: 600, color: "#B91C1C", display: "block", marginBottom: 12 }}>
                ※受け取り待ちの予約がある場合は退会できません。
              </span>
              アカウントを削除するためには、以下の項目に同意してください。
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={check1} onChange={(e) => setCheck1(e.target.checked)} style={{ marginTop: 4 }} />
                <span style={{ fontSize: 13, color: "#4B5563" }}>これまでの予約履歴や情報がすべて消去されることを理解しました。</span>
              </label>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={check2} onChange={(e) => setCheck2(e.target.checked)} style={{ marginTop: 4 }} />
                <span style={{ fontSize: 13, color: "#4B5563" }}>この操作は絶対に取り消すことができず、データを元に戻せないことを理解しました。</span>
              </label>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, color: "#374151", fontWeight: 600, display: "block", marginBottom: 8 }}>
                確認のため「<span style={{ color: "#DC2626" }}>退会する</span>」と入力してください
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="退会する"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 14, outline: "none" }}
              />
            </div>

            {deleteError && (
              <div style={{ backgroundColor: "#FEF2F2", color: "#B91C1C", padding: "10px", borderRadius: "8px", fontSize: 13, marginBottom: 20 }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={resetDeleteModal}
                disabled={isDeleting}
                style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid #E5E7EB", backgroundColor: "#FFFFFF", cursor: isDeleting ? "not-allowed" : "pointer" }}
              >
                キャンセル
              </button>

              <button
                onClick={handleDeleteAccount}
                disabled={!canDelete || isDeleting}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 10, border: "none",
                  backgroundColor: canDelete ? "#DC2626" : "#FCA5A5",
                  color: "#FFFFFF", fontWeight: 600,
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