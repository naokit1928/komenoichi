import React, { useEffect, useState } from "react";
import PickupLocationCard from "./PickupLocationCard";
import PickupPlaceNameCard from "./PickupPlaceNameCard";
import PickupNotesCard from "./PickupNotesCard";
// ★修正ポイント: コンポーネント（値）と 型（TimeSlotOption）のインポートを分けました
import PickupTimeCard from "./PickupTimeCard";
import type { TimeSlotOption } from "./PickupTimeCard";

import FarmerSettingsHeader from "../FarmerSettings/FarmerSettingsHeader";

// API関連のインポート（型と値を分離済み）
import {
  fetchPickupSettingsMe,
  updatePickupSettingsMe,
} from "@/api/farmer/pickupApi";

import type {
  PickupFarm,
  PickupStatus,
} from "@/api/farmer/pickupApi";

const FarmerPickupSettingsPage: React.FC = () => {
  // ステート群
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [baseLat, setBaseLat] = useState<number | null>(null);
  const [baseLng, setBaseLng] = useState<number | null>(null);

  const [pickupPlaceName, setPickupPlaceName] = useState("");
  const [pickupNotes, setPickupNotes] = useState("");
  const [pickupTime, setPickupTime] = useState<string | null>(null);

  const [activeReservationsCount, setActiveReservationsCount] = useState(0);

  // ローディング状態
  const [initialLoading, setInitialLoading] = useState(true);
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingPlaceName, setSavingPlaceName] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingTime, setSavingTime] = useState(false);

  // レスポンスをステートに反映するヘルパー
  const applyFarmState = (farm: PickupFarm, status: PickupStatus) => {
    setPickupLat(farm.pickup_lat);
    setPickupLng(farm.pickup_lng);
    // baseLat/Lng は owner か pickup のどちらかを基準にする
    setBaseLat(farm.owner_lat ?? farm.pickup_lat);
    setBaseLng(farm.owner_lng ?? farm.pickup_lng);

    setPickupPlaceName(farm.pickup_place_name);
    setPickupNotes(farm.pickup_notes ?? "");
    setPickupTime(farm.pickup_time ? farm.pickup_time.toUpperCase() : null);

    setActiveReservationsCount(status.active_reservations_count);
  };

  // 初期ロード
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const data = await fetchPickupSettingsMe();
        if (canceled) return;
        applyFarmState(data.farm, data.status);
      } catch (e) {
        console.error("Failed to load settings", e);
      } finally {
        if (!canceled) setInitialLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  // 編集可否ロジック
  const canEdit = activeReservationsCount === 0;
  const lockReason =
    !canEdit && activeReservationsCount > 0
      ? "今週すでに予約が入っているため、今は編集できません。"
      : undefined;

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <FarmerSettingsHeader title="受け渡し設定" />
      <div style={{ height: "24px" }} />

      <div className="mx-auto max-w-md px-4 py-6 space-y-6">
        {/* 場所カード */}
        <PickupLocationCard
          initialLat={pickupLat}
          initialLng={pickupLng}
          baseLat={baseLat}
          baseLng={baseLng}
          radiusMeters={400}
          saving={savingLocation}
          disabled={initialLoading || !canEdit || savingLocation}
          cannotChangeReason={lockReason}
          onSave={async (lat, lng) => {
            try {
              setSavingLocation(true);
              // 変更点(lat, lng)だけを送信
              const data = await updatePickupSettingsMe({
                pickup_lat: lat,
                pickup_lng: lng,
              });
              applyFarmState(data.farm, data.status);
            } catch {
              alert("受け渡し場所の保存に失敗しました");
            } finally {
              setSavingLocation(false);
            }
          }}
        />

        {/* 場所名カード */}
        <PickupPlaceNameCard
          value={pickupPlaceName}
          saving={savingPlaceName}
          disabled={initialLoading || !canEdit || savingPlaceName}
          cannotChangeReason={lockReason}
          onSave={async (val) => {
            try {
              setSavingPlaceName(true);
              // 変更点(name)だけを送信
              const data = await updatePickupSettingsMe({
                pickup_place_name: val,
              });
              applyFarmState(data.farm, data.status);
            } catch {
              alert("受け渡し場所名の保存に失敗しました");
            } finally {
              setSavingPlaceName(false);
            }
          }}
        />

        {/* メモカード */}
        <PickupNotesCard
          value={pickupNotes}
          saving={savingNotes}
          disabled={initialLoading || !canEdit || savingNotes}
          cannotChangeReason={lockReason}
          onSave={async (val) => {
            try {
              setSavingNotes(true);
              // 変更点(notes)だけを送信
              const data = await updatePickupSettingsMe({
                pickup_notes: val,
              });
              applyFarmState(data.farm, data.status);
            } catch {
              alert("補足メモの保存に失敗しました");
            } finally {
              setSavingNotes(false);
            }
          }}
        />

        {/* 時間カード */}
        <PickupTimeCard
          value={pickupTime as TimeSlotOption}
          saving={savingTime}
          disabled={initialLoading || !canEdit || savingTime}
          cannotChangeReason={lockReason}
          onSave={async (slot) => {
            try {
              setSavingTime(true);
              // 変更点(time)だけを送信
              const data = await updatePickupSettingsMe({
                pickup_time: String(slot),
              });
              applyFarmState(data.farm, data.status);
            } catch {
              alert("受け取り時間の保存に失敗しました");
            } finally {
              setSavingTime(false);
            }
          }}
        />
      </div>
    </div>
  );
};

export default FarmerPickupSettingsPage;