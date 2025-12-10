import React from "react";
import { useNavigate } from "react-router-dom";

type Props = {
  title?: string;
  backTo?: string;   // 既定: /line/farmer-menu
  className?: string;
};

const HEADER_HEIGHT = 80;   // ← 高さを明示（px）
const TOP_FIX = -8;         // ← 上端の浮き補正（必要なら -6～-10 で調整）
const BACK_LEFT = 10;       // ← 矢印の左端からのオフセット（px）

const FarmerSettingsHeader: React.FC<Props> = ({
  title = "公開用プロフィール設定",
  backTo = "/line/farmer-menu",
  className = "",
}) => {
  const navigate = useNavigate();
  const handleBack = () => {
    if (backTo) navigate(backTo);
    else navigate(-1);
  };

  return (
    <header
      className={className}
      style={{
        position: "fixed",
        top: TOP_FIX,
        left: 0,
        right: 0,
        width: "100vw",           // 画面全幅に固定
        height: HEADER_HEIGHT,    // ★ ヘッダー高さを“要素本体”に直接指定
        zIndex: 2147483647,
        margin: 0,
        backgroundColor: "#FFFFFF",
      }}
    >
      {/* 中身は常にヘッダーの高さに追従 */}
      <div
        style={{
          position: "relative",
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",   // ← タイトルと完全に水平揃え
          justifyContent: "center",
        }}
      >
        {/* 戻る：左端から少し右へ */}
        <button
          type="button"
          onClick={handleBack}
          aria-label="戻る"
          style={{
            position: "absolute",
            left: BACK_LEFT,
            top: "50%",
            transform: "translateY(-50%)",
            height: 40,
            width: 40,
            background: "transparent",
            border: "none",
            outline: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* ▼ くの字ではなく“本物の左矢印” */}
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="4" y1="12" x2="20" y2="12" />
            <polyline points="10 6 4 12 10 18" />
          </svg>
        </button>

        {/* タイトル：中央・1行固定 */}
        <div style={{ width: "100%", maxWidth: "48rem", padding: 0 }}>
          <h1
            title={title}
            style={{
              textAlign: "center",
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: ".01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              margin: 0,
            }}
          >
            {title}
          </h1>
        </div>
      </div>
    </header>
  );
};

export default FarmerSettingsHeader;
