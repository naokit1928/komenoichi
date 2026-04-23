import React from "react";

import FarmDetailPriceCard from "../FarmDetailPriceCard";
import FarmDetailProfileCard from "../FarmDetailProfileCard";
import FarmDetailPickupTimeCard from "../FarmDetailPickupTimeCard";
import FarmDetailAreaMapCard from "../FarmDetailAreaMapCard";

// ── Brand tokens ──────────────────────────────────
const C = {
  ink:       "#1a1108",
  ink2:      "#4b3e2a",
  ink3:      "#7a6c58",
} as const;

type Kg = 5 | 10 | 25;

type Props = {
  titleText: string | null;
  harvestYear: number;
  riceVarietyLabel?: string | null;
  loading: boolean;
  errorMsg: string | null;
  sizes: readonly { kg: Kg; label: string; price: number | null }[];
  selectedKg: Kg;
  qtyByKg: { 5: number; 10: number; 25: number };
  onSelectKg: (kg: Kg) => void;
  onInc: (kg: Kg) => void;
  onDec: (kg: Kg) => void;
  money: (n: number) => string;
  farm: any;
  ownerFullName: string | null;
  shortLocation: string | null;
  pickupTextCard: string;
  centerLat?: number;
  centerLng?: number;
  /** ★ 追加: 農家が予約受付中か（false なら価格カード操作をロック） */
  isAccepting: boolean;
};

export default function FarmDetailBody({
  titleText,
  harvestYear,
  riceVarietyLabel,
  loading,
  errorMsg,
  sizes,
  selectedKg,
  qtyByKg,
  onSelectKg,
  onInc,
  onDec,
  money,
  farm,
  ownerFullName,
  shortLocation,
  pickupTextCard,
  centerLat,
  centerLng,
  isAccepting, // ★ 追加
}: Props) {
  return (
    <>
      {/* タイトル */}
      {titleText && (
        <h1
          style={{
            textAlign: "center",
            fontSize: 19,
            fontWeight: 600,
            color: C.ink,
            margin: "4px 0 6px",
            lineHeight: 1.4,
            fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif",
          }}
        >
          {titleText}
        </h1>
      )}

      {/* 品種 */}
      {riceVarietyLabel && (
        <div
          style={{
            textAlign: "center",
            fontSize: 14,
            fontWeight: 500,
            color: C.ink2,
            marginBottom: 16,
          }}
        >
          {harvestYear}年産　{riceVarietyLabel}
        </div>
      )}

      <FarmDetailPriceCard
        loading={loading}
        errorMsg={errorMsg}
        sizes={sizes}
        selectedKg={selectedKg}
        qtyByKg={qtyByKg}
        onSelectKg={onSelectKg}
        onInc={onInc}
        onDec={onDec}
        money={money}
        disabled={!isAccepting} // ★ 追加: 受付停止中はロック
      />

      <FarmDetailProfileCard
        farm={farm}
        ownerFullName={ownerFullName}
        shortLocation={shortLocation}
        faceImageUrl={farm?.face_image_url}
      />

      <FarmDetailPickupTimeCard pickupTextCard={pickupTextCard} />

      <FarmDetailAreaMapCard
        centerLat={centerLat}
        centerLng={centerLng}
        riceBagIcon={undefined}
      />
    </>
  );
}