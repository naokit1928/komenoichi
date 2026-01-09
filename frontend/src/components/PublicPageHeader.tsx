import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";

type Props = {
  title?: string;
  consumerEmail?: string | null;

  /**
   * true  : 画面上部に固定（従来どおり）
   * false : ページ内フロー（ConfirmPage 用）
   */
  sticky?: boolean;
};

export function FarmsListHeader({
  title = "農家一覧",
  consumerEmail,
  sticky = false,
}: Props) {
  const navigate = useNavigate();

  const header = (
    <div
      style={{
        backgroundColor: "#ffffff",
        padding: "12px",
        borderBottom: "1px solid #eee",

        /* フロー内表示 */
        position: "relative",

        textAlign: "center",
      }}
    >
      {/* 三本線 */}
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
  );

  // ★ ここがすべて
  if (!sticky) {
    // ConfirmPage 用：通常フロー
    return header;
  }

  // それ以外：従来どおり固定ヘッダー
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
