import React from "react";
import { QRCodeSVG } from "qrcode.react";

type PromotionPosterDesignProps = {
  farmUrl: string;
  farmId: number;
};

export default function PromotionPosterDesign({ farmUrl, farmId }: PromotionPosterDesignProps) {
  return (
    <div
      style={{
        width: "210mm",
        height: "297mm",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: "border-box",
        fontFamily: "'Noto Sans JP', 'Hiragino Sans', 'Meiryo', sans-serif",
      }}
    >
      {/* ── こめのいち帯（上） ── */}
      {/* v5: padding 8px 16px → ×2.2 = 18px 35px / font 11px → 24px / right 9px → 20px */}
      <div
        style={{
          background: "#C62828",
          padding: "18px 35px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 24,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: "7px",
          }}
        >
          こめのいち
        </span>
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "rgba(255,255,255,0.72)",
            letterSpacing: "0.5px",
          }}
        >
          農家の家でお米を売っています
        </span>
      </div>

      {/* ── 農家1人称エリア（メイン） ── */}
      {/* v5: padding 0 18px → 0 40px */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 40px",
        }}
      >
        {/* うちの: v5 44px → 97px, letter-spacing -1px → -2px */}
        <div
          style={{
            fontSize: 97,
            fontWeight: 900,
            color: "#1a1108",
            lineHeight: 1,
            letterSpacing: "-2px",
          }}
        >
          うちの
        </div>

        {/* お米: v5 168px → 370px, letter-spacing -12px → -26px */}
        <div
          style={{
            fontSize: 370,
            fontWeight: 900,
            color: "#C62828",
            lineHeight: 0.77,
            letterSpacing: "-26px",
          }}
        >
          お米
        </div>

        {/* 買いませんか。: v5 46px → 101px, margin-top 8px → 18px, letter-spacing -1.5px → -3px */}
        <div
          style={{
            fontSize: 101,
            fontWeight: 900,
            color: "#1a1108",
            lineHeight: 1,
            letterSpacing: "-3px",
            marginTop: 18,
          }}
        >
          買いませんか。
        </div>

        {/* divider: v5 height 2px → 4px, margin 18px 0 14px → 40px 0 31px */}
        <div
          style={{
            height: 4,
            background: "#e8e2d8",
            margin: "40px 0 31px",
          }}
        />

        {/* sub-main: v5 14px → 31px */}
        <div
          style={{
            fontSize: 31,
            fontWeight: 700,
            color: "#4b3e2a",
            lineHeight: 1.75,
          }}
        >
          スマホで予約して、うちまで来てください。
        </div>
      </div>

      {/* ── QR帯（下） ── */}
      {/* v5: gap 14px → 31px, padding 12px 16px → 26px 35px, border-top 1.5px → 3px */}
      <div
        style={{
          background: "#f4f1ed",
          display: "flex",
          alignItems: "center",
          gap: 31,
          padding: "26px 35px",
          borderTop: "3px solid #e8e2d8",
          flexShrink: 0,
        }}
      >
        {/* QR: v5 size=70 → 154 */}
        <div style={{ flexShrink: 0 }}>
          <QRCodeSVG value={farmUrl} size={154} level="M" />
        </div>

        <div>
          {/* f-action: v5 13px → 29px, letter-spacing 0.5px → 1px, margin-bottom 3px → 7px */}
          <div
            style={{
              fontSize: 29,
              fontWeight: 900,
              color: "#1a1108",
              letterSpacing: "1px",
              marginBottom: 7,
            }}
          >
            詳細・予約はこちら
          </div>

          {/* f-sub: v5 9.5px → 21px */}
          <div
            style={{
              fontSize: 21,
              fontWeight: 700,
              color: "#7a6c58",
              lineHeight: 1.55,
            }}
          >
            QRを読むとお米の詳細・値段・予約ページへ
          </div>

          {/* ★ 修正：安心感を持たせる注釈テキスト。カラーを目立ちすぎないMid-brown（#7a6c58）に変更。 */}
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#7a6c58", // 既存の色を使用
              marginTop: 10,
              lineHeight: 1.4,
              letterSpacing: "0.5px",
            }}
          >
            ※農家直売サイト『こめのいち』で安全に予約できます
          </div>
        </div>
      </div>
    </div>
  );
}