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
        height: "296mm", // ★ 297mmから1mm縮め、2ページ目が生成されるのを防ぐ
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden", // ★ はみ出しを完全にカット
        boxSizing: "border-box",
        fontFamily: "'Noto Sans JP', 'Hiragino Sans', 'Meiryo', sans-serif",
      }}
    >
      {/* ── こめのいち帯（上） ── */}
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
        <span style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.72)", letterSpacing: "0.5px" }}>
          農家の家でお米を売っています
        </span>
      </div>

      {/* ── 農家1人称エリア（メイン） ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 40px",
          overflow: "hidden", // ★ ここでもはみ出し防止
        }}
      >
        {/* ★ whiteSpace: "nowrap" を追加し、iPadフォント特有の勝手な改行を絶対に防ぐ */}
        <div style={{ fontSize: 97, fontWeight: 900, color: "#1a1108", lineHeight: 1, letterSpacing: "-2px", whiteSpace: "nowrap" }}>
          うちの
        </div>
        <div style={{ fontSize: 370, fontWeight: 900, color: "#C62828", lineHeight: 0.77, letterSpacing: "-26px", whiteSpace: "nowrap" }}>
          お米
        </div>
        <div style={{ fontSize: 101, fontWeight: 900, color: "#1a1108", lineHeight: 1, letterSpacing: "-3px", marginTop: 18, whiteSpace: "nowrap" }}>
          買いませんか。
        </div>

        <div style={{ height: 4, background: "#e8e2d8", margin: "40px 0 31px", flexShrink: 0 }} />

        <div style={{ fontSize: 31, fontWeight: 700, color: "#4b3e2a", lineHeight: 1.75, whiteSpace: "nowrap" }}>
          スマホで予約して、うちまで来てください。
        </div>
      </div>

      {/* ── QR帯（下） ── */}
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
        <div style={{ flexShrink: 0 }}>
          <QRCodeSVG value={farmUrl} size={154} level="M" />
        </div>
        <div>
          <div style={{ fontSize: 29, fontWeight: 900, color: "#1a1108", letterSpacing: "1px", marginBottom: 7, whiteSpace: "nowrap" }}>
            詳細・予約はこちら
          </div>
          <div style={{ fontSize: 21, fontWeight: 700, color: "#7a6c58", lineHeight: 1.55, whiteSpace: "nowrap" }}>
            QRを読むとお米の詳細・値段・予約ページへ
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#7a6c58", marginTop: 10, lineHeight: 1.4, letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
            ※農家直売サイト『こめのいち』で安全に予約できます
          </div>
        </div>
      </div>
    </div>
  );
}