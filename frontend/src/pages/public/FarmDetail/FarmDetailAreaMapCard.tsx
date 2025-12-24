// src/components/FarmDetailAreaMapCard.tsx

import FarmDetailSoftMap from "../../../components/FarmDetailSoftMap";

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
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        background: "#fff",
        padding: 16,
        marginBottom: 0,
      }}
    >
      {/* 見出し：通常サイズ・通常ウェイト */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 400,
          color: "#6b7280",
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

      <p
        style={{
          fontSize: 13,
          color: "#6b7280",
          marginTop: 8,
        }}
      >
        予約確定後に<strong>より詳細なピンの位置と住所</strong>
        を表示します。
      </p>
    </div>
  );
}
