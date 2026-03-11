// frontend/src/pages/public/ConfirmPage/components/RiceBreakdown.tsx
import React from "react";

// ── Brand tokens ──────────────────────────────────
const C = {
  ink:       "#1a1108",
  ink2:      "#4b3e2a", // 濃い茶色（注意書きなど）
  ink3:      "#7a6c58", // 薄い茶色（ラベルなど）
  border:    "#e8e2d8",
} as const;

type Line = {
  label: string;
  amount: number;
};

type Props = {
  riceSubtotal: number;
  lines: Line[];
  pickupDisplay?: string | null;
};

export function RiceBreakdown({
  riceSubtotal,
  lines,
  pickupDisplay,
}: Props) {
  const money = (n: number) => n.toLocaleString("ja-JP");

  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
        marginBottom: 12,
      }}
    >
      {/* ===== 受け取り日時（最優先） ===== */}
      {pickupDisplay && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 12,
              color: C.ink3, // ← グレーから薄い茶色に変更
              marginBottom: 2,
            }}
          >
            受け取り日時
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#111827", // 読ませるために黒のまま
              whiteSpace: "nowrap",
            }}
          >
            {pickupDisplay}
          </div>
        </div>
      )}

      {/* ===== お米代合計 ===== */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 2,
        }}
      >
        <span style={{ color: "#111827" }}>お米代合計</span>
        <span
          style={{
            background: "#f4f1ed", // ← グレーから茶系の薄い背景に変更
            color: C.ink2,         // ← 文字色も濃い茶色に変更
            border: `1px solid ${C.border}`,
            borderRadius: 9999,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          当日現地払い
        </span>
      </div>

      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          marginBottom: 12,
          color: "#111827", // 黒のまま
        }}
      >
        {money(riceSubtotal)}円
      </div>

      {/* ===== 注文内容 ===== */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 6,
          color: "#374151", // 黒のまま
        }}
      >
        注文内容
      </div>

      <div>
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 15,
              fontWeight: 500,
              color: "#111827", // 黒のまま
              padding: "4px 0",
            }}
          >
            <span>{l.label}</span>
            <span>{money(l.amount)}円</span>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 8,
          color: C.ink2, // ← グレーから濃い茶色に変更
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        ※ 受け渡し当日に、農家さんに現金でお支払いください。
      </div>
    </section>
  );
}