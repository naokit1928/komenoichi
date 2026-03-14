import React, { useState } from "react";
import { useNavigate, useOutletContext, Link } from "react-router-dom"; 
import { API_BASE } from "@/config/api";

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

  const canDelete = check1 && check2 && confirmText === "退会する";

  return (
    <div style={{ padding: "24px 16px 120px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ backgroundColor: "#F9FAFB", borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 4 }}>ログイン中</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: "#111827" }}>
          {email ? maskEmail(email) : "（email 未取得）"}
        </div>
      </div>

      <button
        onClick={() => setShowLogoutModal(true)}
        style={{ 
          width: "100%", padding: "14px 0", fontSize: 16, 
          backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", 
          borderRadius: 12, cursor: "pointer", fontWeight: 500, color: "#111827"
        }}
      >
        ログアウト
      </button>

      {/* 法務ページへのリンク集 */}
      <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 24, alignItems: "center" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "16px 24px", fontSize: 13 }}>
          <Link to="/terms/farmer?from=farmer" style={{ color: "#111827", fontWeight: 600, textDecoration: "underline" }}>農家向け利用規約</Link>
          <Link to="/law?from=farmer" style={{ color: "#6B7280", textDecoration: "underline" }}>特定商取引法に基づく表記</Link>
          <Link to="/terms?from=farmer" style={{ color: "#6B7280", textDecoration: "underline" }}>利用規約（一般）</Link>
          <Link to="/privacy?from=farmer" style={{ color: "#6B7280", textDecoration: "underline" }}>プライバシーポリシー</Link>
        </div>

        <button
          onClick={() => setShowDeleteModal(true)}
          style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 13, textDecoration: "underline", cursor: "pointer" }}
        >
          退会（アカウント削除）をご希望の方はこちら
        </button>
      </div>

      {/* フローティングボタン */}
      <button
        onClick={() => navigate("/farms")}
        style={{
          position: "fixed",
          bottom: "calc(72px + env(safe-area-inset-bottom) + 20px)",
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
        予約者モードへ
      </button>

      {/* ログアウト確認モーダル */}
      {showLogoutModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24, width: "90%", maxWidth: 360 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 24, textAlign: "center", color: "#111827" }}>
              本当にログアウトしてもよろしいですか？
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowLogoutModal(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid #E5E7EB", backgroundColor: "#FFFFFF", color: "#111827", fontWeight: 600, cursor: "pointer" }}>キャンセル</button>
              <button onClick={handleLogout} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", backgroundColor: "#111827", color: "#FFFFFF", fontWeight: 600, cursor: "pointer" }}>ログアウト</button>
            </div>
          </div>
        </div>
      )}

      {/* 退会確認モーダル */}
      {showDeleteModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24, width: "90%", maxWidth: 440 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 12 }}>アカウントの削除（取り消し不可）</div>
            <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, marginBottom: 20 }}><span style={{ fontWeight: 600, color: "#111827", display: "block", marginBottom: 12 }}>※今後の予約が残っている場合は退会できません。</span>アカウントを削除するためには、以下の項目に同意してください。</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={check1} onChange={(e) => setCheck1(e.target.checked)} style={{ marginTop: 4, accentColor: "#111827" }} /><span style={{ fontSize: 13, color: "#4B5563" }}>農家情報が非公開となり、今後一切のログインができなくなることを理解しました。</span></label>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={check2} onChange={(e) => setCheck2(e.target.checked)} style={{ marginTop: 4, accentColor: "#111827" }} /><span style={{ fontSize: 13, color: "#4B5563" }}>この操作は絶対に取り消すことができず、データを元に戻せないことを理解しました。</span></label>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, color: "#374151", fontWeight: 600, display: "block", marginBottom: 8 }}>確認のため「退会する」と入力してください</label>
              <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="退会する" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 14, outline: "none" }} />
            </div>
            {deleteError && (<div style={{ backgroundColor: "#F3F4F6", color: "#111827", padding: "10px", borderRadius: "8px", fontSize: 13, marginBottom: 20, border: "1px solid #D1D5DB" }}>{deleteError}</div>)}
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={resetDeleteModal} disabled={isDeleting} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "1px solid #E5E7EB", backgroundColor: "#FFFFFF", cursor: isDeleting ? "not-allowed" : "pointer" }}>キャンセル</button>
              <button onClick={handleDeleteAccount} disabled={!canDelete || isDeleting} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", backgroundColor: canDelete ? "#111827" : "#E5E7EB", color: "#FFFFFF", fontWeight: 600, cursor: canDelete && !isDeleting ? "pointer" : "not-allowed", transition: "background-color 0.2s" }}>{isDeleting ? "処理中..." : "退会する"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}