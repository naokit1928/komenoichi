import React from "react";

// ── Brand tokens ──────────────────────────────────
const C = {
  red:       "#A83020",
  ink:       "#1a1108", // 最も濃い焦げ茶（ほぼ黒に見える太字部分）
  ink2:      "#4b3e2a", // 中間の茶色
  ink3:      "#7a6c58", // 薄めの茶色（冷たいグレーの代わりにこちらを使用）
  border:    "#e8e2d8",
} as const;

type Props = {
  riceSubtotal: number;
  pickupTextCTA: string;
  onNext: () => void;
  money: (n: number) => string;
  disabled: boolean;
  isOverLimit: boolean;
};

export default function FarmDetailCTA({
  riceSubtotal,
  pickupTextCTA,
  onNext,
  money,
  disabled,
  isOverLimit,
}: Props) {
  // スッキリ見せるため、「次回受け渡し」を削る
  const shortPickupText = pickupTextCTA.replace(/^次回受け渡し\s*/, "");

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#ffffff",
        borderTop: `1px solid ${C.border}`,
        padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
        zIndex: 50,
        boxShadow: "0 -4px 16px rgba(138,108,88,0.06)", // 影も少しブラウン寄りにしています
      }}
    >
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* ── 左側：金額とテキスト情報 ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 金額 */}
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: C.ink, // 最も濃い焦げ茶
              lineHeight: 1.2,
              marginBottom: 4,
              fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            ¥ {money(riceSubtotal)}
          </div>
          
          {/* 日時（グレーをやめて、温かみのある薄い茶色に変更） */}
          <div
            style={{
              fontSize: 12,
              color: C.ink3, // ← ここをグレーから茶色（ink3）に変更しました
              lineHeight: 1.3,
            }}
          >
            {shortPickupText}
          </div>

          {/* エラーメッセージ */}
          {isOverLimit && (
            <div
              style={{
                fontSize: 11,
                color: C.red,
                fontWeight: 600,
                marginTop: 2,
              }}
            >
              ※注文上限を超えています
            </div>
          )}
        </div>

        {/* ── 右側：アクションボタン ── */}
        <button
          type="button"
          onClick={onNext}
          disabled={disabled}
          style={{
            width: "40%",
            maxWidth: 160,
            minWidth: 120,
            padding: "12px 0",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            borderRadius: 9999, // ピル型（完全な角丸）
            background: disabled ? "#d1d5db" : C.red,
            border: "none",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: 15,
            cursor: disabled ? "not-allowed" : "pointer",
            transition: "background 0.2s ease",
          }}
        >
          予約へ進む
        </button>
      </div>
    </div>
  );
}