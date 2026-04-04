import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactDOM from "react-dom";
import { API_BASE } from "@/config/api";

export default function FarmerCancelPage() {
  const navigate = useNavigate();
  const [reason, setReason] = useState<"A" | "B" | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // カスタム確認ダイアログの表示状態
  const [showConfirm, setShowConfirm] = useState(false);

  // 1段階目：「理由を送信してキャンセル」ボタンを押した時
  const handleRequestCancel = () => {
    if (!reason) return;
    setShowConfirm(true); // 最終確認ダイアログを開く
  };

  // 2段階目：最終確認ダイアログで「実行する」を押した時
  const executeCancel = async () => {
    if (!reason) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/farmer/emergency-stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "エラーが発生しました。");
      }
      
      alert("予約の一括キャンセルと受付停止処理が完了しました。");
      navigate("/farmer/reservations", { replace: true });
    } catch (err: any) {
      setErrorMsg(err.message || "通信エラーが発生しました。");
      setShowConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", padding: "0 0 80px 0", color: "#111827", fontFamily: "'Noto Sans JP', sans-serif" }}>
      {/* ── ヘッダー ── */}
      <header style={{ 
        background: "#fff", 
        borderBottom: "1px solid #e5e7eb", 
        minHeight: "56px", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", /* ★ タイトルを中央に配置 */
        position: "sticky", 
        top: 0, 
        zIndex: 10 
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ 
            position: "absolute", left: "8px", /* ★ 左端に固定 */
            background: "none", border: "none", padding: "8px", cursor: "pointer", 
            display: "flex", alignItems: "center", color: "#374151" 
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <h1 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>キャンセル手続き</h1>
      </header>

      {/* ── メインコンテンツ ── */}
      <main style={{ maxWidth: "600px", margin: "24px auto", padding: "0 16px" }}>
        
        {/* 警告メッセージエリア */}
        <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", border: "1px solid #e5e7eb", marginBottom: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
            </svg>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#111827", margin: 0, lineHeight: 1.3 }}>
              キャンセルは利用制限の対象となる場合があります
            </h2>
          </div>
          <p style={{ fontSize: "14px", color: "#4b5563", lineHeight: 1.7, margin: 0 }}>
            正当な理由（自然災害など）によるキャンセルを除き、農家都合でのキャンセルを頻繁に行うと、<strong>アカウントが利用停止（BAN）または削除されることがあります</strong>のでご留意ください。<br/>
            <br/>
            この操作を実行すると、今週の確定済み予約をすべてキャンセルし、予約受付を一時停止します。<strong>該当する予約者にはキャンセルの通知メールが自動で送信されます。</strong><br/>
            <span style={{ color: "#b91c1c", fontWeight: 700 }}>（※この操作は取り消せません）</span>
          </p>
        </div>

        {errorMsg && (
          <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "12px 16px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, marginBottom: "24px", border: "1px solid #fca5a5" }}>
            {errorMsg}
          </div>
        )}

        {/* 理由選択エリア */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer", background: reason === "A" ? "#f8fafc" : "#ffffff", border: `2px solid ${reason === "A" ? "#3b82f6" : "#e5e7eb"}`, padding: "20px 16px", borderRadius: "12px", transition: "0.2s", boxShadow: reason === "A" ? "0 4px 12px rgba(59, 130, 246, 0.1)" : "0 2px 4px rgba(0,0,0,0.02)" }}>
            <input type="radio" name="reason" checked={reason === "A"} onChange={() => setReason("A")} style={{ marginTop: "4px", transform: "scale(1.2)" }} />
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#111827" }}>災害・悪天候による対応困難（免責）</div>
              <div style={{ fontSize: "13px", color: "#4b5563", marginTop: "6px", lineHeight: 1.6 }}>
                台風、地震、大雪など、不可抗力により安全な対応が困難な場合の停止です。ペナルティの対象外となりますが、後日事実確認を行う場合があります。
              </div>
            </div>
          </label>

          <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer", background: reason === "B" ? "#fffbeb" : "#ffffff", border: `2px solid ${reason === "B" ? "#fde68a" : "#e5e7eb"}`, padding: "20px 16px", borderRadius: "12px", transition: "0.2s", boxShadow: reason === "B" ? "0 4px 12px rgba(253, 230, 138, 0.2)" : "0 2px 4px rgba(0,0,0,0.02)" }}>
            <input type="radio" name="reason" checked={reason === "B"} onChange={() => setReason("B")} style={{ marginTop: "4px", transform: "scale(1.2)" }} />
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#111827" }}>自己都合・在庫調整など</div>
              <div style={{ fontSize: "13px", color: "#4b5563", marginTop: "6px", lineHeight: 1.6 }}>
                急な用事、体調不良、在庫の数え間違いなど、農家側の都合によるキャンセルです。<br/>
                <span style={{ color: "#111827", fontWeight: 700 }}>（頻繁なキャンセルはペナルティの対象となります）</span>
              </div>
            </div>
          </label>
        </div>

        <button
          onClick={handleRequestCancel}
          disabled={!reason}
          style={{
            width: "100%", height: "56px", borderRadius: "12px", border: "none",
            background: !reason ? "#e5e7eb" : "#111827",
            color: !reason ? "#9ca3af" : "#fff",
            fontWeight: 700, fontSize: "16px",
            cursor: !reason ? "not-allowed" : "pointer",
            transition: "0.2s",
            boxShadow: !reason ? "none" : "0 4px 12px rgba(0,0,0,0.15)"
          }}
        >
          理由を送信してキャンセル
        </button>
      </main>

      {/* ── カスタム確認ダイアログ（ポータル） ── */}
      {showConfirm && ReactDOM.createPortal(
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 2147483647,
            background: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
          }}
          onClick={() => !busy && setShowConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              background: "#fff", width: "100%", maxWidth: "400px",
              borderRadius: "16px", overflow: "hidden",
              boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
              animation: "fadeSlideUp 0.2s ease-out"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "24px 24px 16px", textAlign: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "50%", background: "#fef2f2", marginBottom: "16px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#111827", margin: "0 0 12px" }}>最終確認</h3>
              <p style={{ fontSize: "14px", color: "#4b5563", lineHeight: 1.6, margin: 0, textAlign: "left" }}>
                本当に今週の確定済み予約をすべてキャンセルし、受付を停止しますか？
              </p>
              <div style={{ background: "#f9fafb", padding: "12px", borderRadius: "8px", marginTop: "16px", textAlign: "left", fontSize: "13px", color: "#b91c1c", fontWeight: 600, lineHeight: 1.5 }}>
                ※該当する予約者にはキャンセルの通知メールが自動で送信されます。<br/>
                ※この操作は取り消せません。
              </div>
            </div>

            <div style={{ display: "flex", borderTop: "1px solid #e5e7eb", background: "#f9fafb", padding: "16px", gap: "12px" }}>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={busy}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: "8px", background: "#fff",
                  border: "1px solid #d1d5db", color: "#374151", fontSize: "14px", fontWeight: 700,
                  cursor: busy ? "not-allowed" : "pointer"
                }}
              >
                やめる
              </button>
              <button
                onClick={executeCancel}
                disabled={busy}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: "8px", background: "#dc2626",
                  border: "none", color: "#fff", fontSize: "14px", fontWeight: 700,
                  cursor: busy ? "not-allowed" : "pointer",
                  opacity: busy ? 0.7 : 1
                }}
              >
                {busy ? "処理中..." : "キャンセルを実行"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}