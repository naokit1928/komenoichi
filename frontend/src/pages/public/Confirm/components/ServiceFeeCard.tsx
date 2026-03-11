// frontend/src/pages/public/ConfirmPage/components/ServiceFeeCard.tsx
import React from "react";

// ── Brand tokens ──────────────────────────────────
const C = {
  gold:      "#C49A1A", // カード外枠の強調用
  ink2:      "#4b3e2a", // 濃い茶色（バッジテキスト用）
  ink3:      "#7a6c58", // 薄い茶色（注釈用）
  bgPale:    "#f4f1ed", // 薄い茶系の背景（バッジ用）
  border:    "#e8e2d8", // バッジの枠線
} as const;

type Props = {
  serviceFee: number;
  termLabel: string;
};

export function ServiceFeeCard({ serviceFee, termLabel }: Props) {
  const money = (n: number) => n.toLocaleString("ja-JP");

  return (
    <section
      style={{
        borderRadius: 12,
        padding: 16,
        background: "#fff",
        marginBottom: 12,
        border: `1.5px solid ${C.gold}`, // カードの枠線は黄金色で強調を維持
        boxShadow: `0 0 0 2px rgba(196,154,26,0.15)`, 
      }}
    >
      {/* ===== 1行目：費目 × 金額 ===== */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontWeight: 700,
          fontSize: 16,
          marginBottom: 6,
          color: "#111827", // 黒のまま
        }}
      >
        <span>{termLabel}</span>
        <span>{money(serviceFee)}円</span>
      </div>
      
      {/* 補足 */}
      <div
       style={{
         marginTop: 4,
         marginBottom: 8,
         fontSize: 12,
         color: C.ink3,
         lineHeight: 1.4,
       }}
      >
       （システム・決済・運営維持のため）
      </div>
      
      {/* ===== 2行目：状態バッジ（情報集約） ===== */}
      <div>
        <span
          style={{
            display: "inline-block",
            background: C.bgPale,  // ★ 黄金色から薄い茶色に変更
            color: C.ink2,         // ★ 黄金色からこげ茶色に変更
            border: `1px solid ${C.border}`,
            borderRadius: 9999,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          今すぐStripeを通じてオンラインで支払い
        </span>
      </div>
    </section>
  );
}