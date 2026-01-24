import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";

type Props = {
  title?: string;
  consumerEmail?: string | null;
  sticky?: boolean;
  hideMenu?: boolean;
  showBack?: boolean;        // ★ 追加
  onBack?: () => void;       // ★ 追加
};

export function FarmsListHeader({
  title = "農家一覧",
  consumerEmail,
  sticky = false,
  hideMenu = false,
  showBack = false,         // ★
  onBack,                  // ★
}: Props) {
  const navigate = useNavigate();

  const header = (
    <div
      style={{
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #eee",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          padding: "12px",
          position: "relative",
          textAlign: "center",
        }}
      >
        {/* ← 戻る（Confirm など必要なページだけ表示） */}
{showBack && (
  <button
    onClick={onBack}
    style={{
      position: "absolute",
      left: 16,
      top: 14,
      width: 40,
      height: 40,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 9999,
      background: "rgba(0,0,0,0.03)",
      border: "none",
      cursor: "pointer",
      fontSize: 22,
      color: "#111",
    }}
    aria-label="戻る"
  >
    ‹
  </button>
)}


        {/* 三本線（hideMenu=true のときは表示しない） */}
        {!hideMenu && (
          <button
            onClick={() => navigate("/account/settings")}
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              fontSize: 22,
              lineHeight: 1,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#222",
            }}
            aria-label="アカウント設定"
          >
            ≡
          </button>
        )}

        {title && (
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#222",
              lineHeight: 1.4,
            }}
          >
            {title}
          </div>
        )}

        {consumerEmail && (
          <div
            style={{
              marginTop: title ? 4 : 0,
              fontSize: 13,
              color: "#6b7280",
              wordBreak: "break-all",
            }}
          >
            {consumerEmail}
          </div>
        )}
      </div>
    </div>
  );

  if (!sticky) {
    return header;
  }

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
      }}
    >
      {header}
    </div>,
    document.body
  );
}
