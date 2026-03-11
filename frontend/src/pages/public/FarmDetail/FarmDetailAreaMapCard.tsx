// src/components/FarmDetailAreaMapCard.tsx

import FarmDetailSoftMap from "../../../components/FarmDetailSoftMap";

// ── Brand tokens ──────────────────────────────────
const C = {
  ink:       "#1a1108",
  ink2:      "#4b3e2a", // 13pxの標準テキストに適用
  ink3:      "#7a6c58",
  border:    "#e8e2d8",
} as const;

type Props = {
  centerLat?: number;
  centerLng?: number;
  riceBagIcon?: string;
};

export default function FarmDetailAreaMapCard({
  centerLat,
  centerLng,
  riceBagIcon,
}: Props) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        background: "#fff",
        padding: 16,
        marginBottom: 0,
      }}
    >
      {/* 見出し：13px, 濃い茶色 (Level 2) */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: C.ink2,
          marginBottom: 8,
        }}
      >
        受け渡しエリア（概略）
      </div>

      <FarmDetailSoftMap
        centerLat={centerLat}
        centerLng={centerLng}
        zoom={15}
        height={280}
        show300mCircle={false}
        markerIconUrl={riceBagIcon}
        markerTitle="受け渡し予定地点"
      />

      {/* 注釈：13px, 濃い茶色 (Level 2) */}
      <p
        style={{
          fontSize: 13,
          color: C.ink2,
          marginTop: 10,
          lineHeight: 1.5,
        }}
      >
        予約確定後に<strong style={{ color: C.ink, fontWeight: 600 }}>より詳細なピンの位置と住所</strong>を表示します。
      </p>
    </div>
  );
}