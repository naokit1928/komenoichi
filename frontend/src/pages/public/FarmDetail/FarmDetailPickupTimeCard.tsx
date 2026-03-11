import React from "react";

// ── Brand tokens ──────────────────────────────────
const C = {
  ink:       "#1a1108", // 15px以上のメインテキスト
  ink3:      "#7a6c58", // 12px以下のサブテキスト（ラベルなど）
  border:    "#e8e2d8", // 枠線
} as const;

type Props = {
  pickupTextCard: string;
};

export default function FarmDetailPickupTimeCard({ pickupTextCard }: Props) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        background: "#fff",
        padding: 16,
        marginBottom: 12,
      }}
    >
      {/* ラベル（13px: 薄い茶色） */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 400,
          color: C.ink3,
          marginBottom: 4,
        }}
      >
        次回受け渡し日時
      </div>

      {/* 日時（17px: 黒・少し太さを抑える） */}
      <div
        style={{
          fontSize: 17,
          fontWeight: 600, // 700から600へ変更して上品に
          color: C.ink,
          lineHeight: 1.4,
          wordBreak: "keep-all",
        }}
      >
        {pickupTextCard}
      </div>
    </div>
  );
}