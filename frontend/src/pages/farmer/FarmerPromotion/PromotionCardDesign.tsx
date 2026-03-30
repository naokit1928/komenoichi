import React from "react";
import { QRCodeSVG } from "qrcode.react";

const C = {
  ink: "#111827",
  ink2: "#374151",
  border: "#E5E7EB",
} as const;

type PromotionCardDesignProps = {
  farmName: string; // 使わないが型維持
  farmUrl: string;
  farmId: number;
};

export default function PromotionCardDesign({ farmUrl, farmId }: PromotionCardDesignProps) {
  return (
    <div
      className="label-card"
      style={{
        width: "91mm",
        height: "55mm",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8mm",
        boxSizing: "border-box",
        background: "#ffffff",
        position: "relative",
      }}
    >
      {/* ── 左：コピー（中央重心・最小構成） ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "10px",
          paddingRight: "2mm",
        }}
      >
        {/* メインコピー（農家さん自身からのメッセージ） */}
        <div
          style={{
            fontSize: "15px", 
            fontWeight: 800,
            color: C.ink,
            lineHeight: 1.35,
            letterSpacing: "0.02em",
          }}
        >
          家でもお米を
          <br />
          売っています
        </div>

        {/* ベネフィット（誠実で素朴なトーン） */}
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: C.ink2,
            lineHeight: 1.45,
          }}
        >
          新鮮で、少しお得です。
        </div>
      </div>

      {/* ── 右：QR（主役） ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
        }}
      >
        {/* QR */}
        <div
          style={{
            padding: "6px",
            border: `1px solid ${C.border}`,
            borderRadius: "8px",
            background: "#fff",
          }}
        >
          <QRCodeSVG value={farmUrl} size={68} level="M" />
        </div>

        {/* CTA */}
        <div
          style={{
            fontSize: "10px",
            fontWeight: 800,
            color: C.ink,
            letterSpacing: "0.02em",
            display: "flex",
            alignItems: "center",
            gap: "2px",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"></path><path d="M12 5l7 7-7 7"></path>
          </svg>
          スマホで予約・注文
        </div>
      </div>

      {/* フェイルセーフ用の極小Farm ID */}
      <div style={{ position: "absolute", bottom: "4px", right: "6px", fontSize: "7px", color: "#9CA3AF", fontFamily: "monospace" }}>
        ID: {farmId}
      </div>
    </div>
  );
}