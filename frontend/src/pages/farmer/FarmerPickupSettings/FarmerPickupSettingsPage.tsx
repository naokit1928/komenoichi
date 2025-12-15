import React, { useEffect, useMemo, useState } from "react";
import PickupLocationCard from "./PickupLocationCard";
import PickupPlaceNameCard from "./PickupPlaceNameCard";
import PickupNotesCard from "./PickupNotesCard";
import PickupTimeCard from "./PickupTimeCard";
import FarmerSettingsHeader from "../FarmerSettings/FarmerSettingsHeader";

import { API_BASE } from "@/config/api";



// =============================
// 共通 fetch
// =============================
async function requestJson(path: string, options?: RequestInit) {
  const res = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const ct = res.headers.get("content-type") || "";
  let data: any = null;
  try {
    data = ct.includes("application/json") ? await res.json() : await res.text();
  } catch {}
  return { ok: res.ok, status: res.status, data };
}

// =============================
// v2 settings GET
// =============================
async function fetchPickupSettings(farmId: string) {
  const res = await requestJson(
    `/api/farmer/pickup-settings?farm_id=${encodeURIComponent(farmId)}`
  );
  if (!res.ok) return null;
  const data = res.data;
  if (!data || !data.farm || !data.status) return null;
  return data;
}

// =============================
// v2 settings POST
// =============================
async function savePickupSettings(farmId: string, current: any, changes: any) {
  const payload = {
    farm_id: Number(farmId),
    pickup_lat:
      changes.pickup_lat !== undefined ? changes.pickup_lat : current.pickup_lat,
    pickup_lng:
      changes.pickup_lng !== undefined ? changes.pickup_lng : current.pickup_lng,
    pickup_place_name:
      changes.pickup_place_name !== undefined
        ? changes.pickup_place_name
        : current.pickup_place_name,
    pickup_notes:
      changes.pickup_notes !== undefined
        ? changes.pickup_notes
        : current.pickup_notes,
    pickup_time:
      changes.pickup_time !== undefined
        ? changes.pickup_time
        : current.pickup_time,
  };

  const res = await requestJson(`/api/farmer/pickup-settings`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("保存に失敗しました");

  const data = res.data;
  if (!data || !data.farm || !data.status)
    throw new Error("レスポンス不正");

  return data;
}

// =============================
// メイン
// =============================
const FarmerPickupSettingsPage: React.FC = () => {
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [baseLat, setBaseLat] = useState<number | null>(null);
  const [baseLng, setBaseLng] = useState<number | null>(null);

  const [pickupPlaceName, setPickupPlaceName] = useState("");
  const [pickupNotes, setPickupNotes] = useState("");
  const [pickupTime, setPickupTime] = useState<string | null>(null);

  const [activeReservationsCount, setActiveReservationsCount] = useState(0);

  const [initialLoading, setInitialLoading] = useState(true);
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingPlaceName, setSavingPlaceName] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingTime, setSavingTime] = useState(false);

  const farmId = useMemo(() => {
    return new URLSearchParams(window.location.search).get("farm_id");
  }, []);

  // owner_lat / owner_lng を優先してアンカーに使うためのユーティリティ
  const parseNumberOrNull = (v: any): number | null => {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      return Number.isNaN(n) ? null : n;
    }
    return null;
  };

  const applyFarmStateFromResponse = (farm: any, status: any) => {
    const pickupLatRaw = farm.pickup_lat ?? null;
    const pickupLngRaw = farm.pickup_lng ?? null;
    const ownerLatRaw = farm.owner_lat ?? null;
    const ownerLngRaw = farm.owner_lng ?? null;

    const parsedPickupLat = parseNumberOrNull(pickupLatRaw);
    const parsedPickupLng = parseNumberOrNull(pickupLngRaw);
    const parsedOwnerLat = parseNumberOrNull(ownerLatRaw);
    const parsedOwnerLng = parseNumberOrNull(ownerLngRaw);

    setPickupLat(parsedPickupLat);
    setPickupLng(parsedPickupLng);

    const anchorLat = parsedOwnerLat ?? parsedPickupLat;
    const anchorLng = parsedOwnerLng ?? parsedPickupLng;
    setBaseLat(anchorLat);
    setBaseLng(anchorLng);

    setPickupPlaceName(farm.pickup_place_name ?? "");
    setPickupNotes(farm.pickup_notes ?? "");
    setPickupTime(
      typeof farm.pickup_time === "string"
        ? farm.pickup_time.toUpperCase()
        : null
    );

    setActiveReservationsCount(status.active_reservations_count ?? 0);
  };

  // =============================
  // 初期ロード
  // =============================
  useEffect(() => {
    let canceled = false;

    async function run() {
      if (!farmId) {
        setInitialLoading(false);
        return;
      }

      const result = await fetchPickupSettings(farmId);
      if (!result || canceled) return;

      const farm = result.farm;
      const status = result.status;

      applyFarmStateFromResponse(farm, status);
      setInitialLoading(false);
    }

    run();
    return () => {
      canceled = true;
    };
  }, [farmId]);

  // =============================
  // 編集可能かどうか
  // =============================
  const canEdit = activeReservationsCount === 0;

  const locDisabled = initialLoading || !canEdit || savingLocation;
  const placeDisabled = initialLoading || !canEdit || savingPlaceName;
  const notesDisabled = initialLoading || !canEdit || savingNotes;

  const lockReason =
    !canEdit && activeReservationsCount > 0
      ? "今週すでに予約が入っているため、今は編集できません。"
      : undefined;

  const currentForSave = {
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    pickup_place_name: pickupPlaceName,
    pickup_notes: pickupNotes,
    pickup_time: pickupTime,
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <FarmerSettingsHeader title="受け渡し設定" />
      <div style={{ height: "72px" }} />

      <div className="mx-auto max-w-md px-4 py-6 space-y-6">
        {/* 受け渡し場所（地図） */}
        <PickupLocationCard
          initialLat={pickupLat}
          initialLng={pickupLng}
          baseLat={baseLat}
          baseLng={baseLng}
          radiusMeters={400}
          saving={savingLocation}
          disabled={locDisabled}
          cannotChangeReason={
            lockReason
              ? "今週すでに予約が入っているため、今は受け渡し場所を変更できません。"
              : undefined
          }
          onSave={async (lat, lng) => {
            if (!farmId) return;

            try {
              setSavingLocation(true);
              const data = await savePickupSettings(farmId, currentForSave, {
                pickup_lat: lat,
                pickup_lng: lng,
              });

              const farm = data.farm;
              const status = data.status;

              applyFarmStateFromResponse(farm, status);
            } catch {
              alert("受け渡し場所の保存に失敗しました");
            } finally {
              setSavingLocation(false);
            }
          }}
        />

        {/* 受け渡し場所名 */}
        <PickupPlaceNameCard
          value={pickupPlaceName}
          saving={savingPlaceName}
          disabled={placeDisabled}
          cannotChangeReason={
            lockReason
              ? "今週すでに予約が入っているため、今は受け渡し場所名を変更できません。"
              : undefined
          }
          onSave={async (v) => {
            if (!farmId) return;

            try {
              setSavingPlaceName(true);
              const data = await savePickupSettings(farmId, currentForSave, {
                pickup_place_name: v,
              });

              const farm = data.farm;
              const status = data.status;

              applyFarmStateFromResponse(farm, status);
            } catch {
              alert("受け渡し場所名の保存に失敗しました");
            } finally {
              setSavingPlaceName(false);
            }
          }}
        />

        {/* 補足メモ */}
        <PickupNotesCard
          value={pickupNotes}
          saving={savingNotes}
          disabled={notesDisabled}
          cannotChangeReason={
            lockReason
              ? "今週すでに予約が入っているため、今は補足メモを変更できません。"
              : undefined
          }
          onSave={async (v) => {
            if (!farmId) return;

            try {
              setSavingNotes(true);
              const data = await savePickupSettings(farmId, currentForSave, {
                pickup_notes: v,
              });

              const farm = data.farm;
              const status = data.status;

              applyFarmStateFromResponse(farm, status);
            } catch {
              alert("補足メモの保存に失敗しました");
            } finally {
              setSavingNotes(false);
            }
          }}
        />

        {/* 受け取り日時 */}
        <PickupTimeCard
          value={pickupTime as any}
          saving={savingTime}
          disabled={!canEdit || savingTime || initialLoading}
          cannotChangeReason={
            lockReason
              ? "今週すでに予約が入っているため、今は受け取り日時を変更できません。"
              : undefined
          }
          onSave={async (slot: any) => {
            if (!farmId) return;

            try {
              setSavingTime(true);
              const data = await savePickupSettings(farmId, currentForSave, {
                pickup_time: String(slot),
              });

              const farm = data.farm;
              const status = data.status;

              applyFarmStateFromResponse(farm, status);
            } catch {
              alert("受け取り時間の保存に失敗しました");
            } finally {
              setSavingTime(false);
            }
          }}
        />

        <p className="text-xs text-gray-500 mt-3">
          active_reservations_count: {activeReservationsCount} / canEdit:{" "}
          {canEdit ? "true" : "false"}
        </p>
      </div>
    </div>
  );
};

export default FarmerPickupSettingsPage;
