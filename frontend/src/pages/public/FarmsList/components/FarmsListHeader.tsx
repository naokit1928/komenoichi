import { useNavigate } from "react-router-dom";

type Props = {
  consumerEmail?: string | null;
};

export function FarmsListHeader({ consumerEmail }: Props) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        marginBottom: 20,
        padding: "12px 12px 12px 12px",
        borderBottom: "1px solid #eee",
        position: "relative",
        textAlign: "center",
      }}
    >
      {/* 右上メニュー（≡） */}
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

      {/* ページタイトル */}
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: "#222",
          lineHeight: 1.4,
        }}
      >
        農家一覧
      </div>

      {/* email（ログイン済みのみ） */}
      {consumerEmail && (
        <div
          style={{
            marginTop: 4,
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
}
