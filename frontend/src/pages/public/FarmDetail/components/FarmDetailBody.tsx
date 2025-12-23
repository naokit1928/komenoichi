import React from "react";

import FarmDetailPriceCard from "../FarmDetailPriceCard";
import FarmDetailProfileCard from "../FarmDetailProfileCard";
import FarmDetailPickupTimeCard from "../FarmDetailPickupTimeCard";
import FarmDetailAreaMapCard from "../FarmDetailAreaMapCard";

type Kg = 5 | 10 | 25;

type Props = {
  titleText: string | null;
  harvestYear: number;
  riceVarietyLabel?: string | null;

  loading: boolean;
  errorMsg: string | null;

  sizes: readonly {
    kg: Kg;
    label: string;
    price: number | null;
  }[];

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
}: Props) {
  return (
    <>
      {titleText && (
        <h1
          style={{
            textAlign: "center",
            fontSize: 20,
            fontWeight: 700,
            margin: "4px 0 8px",
            lineHeight: 1.35,
          }}
        >
          {titleText}
        </h1>
      )}

      {riceVarietyLabel && (
        <div
          style={{
            textAlign: "center",
            fontSize: 15,
            fontWeight: 700,
            marginBottom: 12,
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
