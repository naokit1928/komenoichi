import React, { useEffect, useState } from "react";
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
    credentials: "include",
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
// GET /me
// =============================
async function fetchPickupSettingsMe() {
  const res = await requestJson("/api/farmer/pickup-settings/me");
  if (!res.ok) return null;
  if (!res.data?.farm || !res.data?.status) return null;
  return res.data;
}

// =============================
// POST /me
// =============================
async function savePickupSettings(current: any, changes: any) {
  const payload = {
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

  const res = await requestJson("/api/farmer/pickup-settings/me", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("保存に失敗しました");
  if (!res.data?.farm || !res.data?.status)
    throw new Error("レスポンス不正");

  return res.data;
}

// =============================
// Main
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

  const parseNumberOrNull = (v: any): number | null => {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      return Number.isNaN(n) ? null : n;
    }
    return null;
  };

  const applyFarmStateFromResponse = (farm: any, status: any) => {
    const parsedPickupLat = parseNumberOrNull(farm.pickup_lat);
    const parsedPickupLng = parseNumberOrNull(farm.pickup_lng);
    const parsedOwnerLat = parseNumberOrNull(farm.owner_lat);
    const parsedOwnerLng = parseNumberOrNull(farm.owner_lng);

    setPickupLat(parsedPickupLat);
    setPickupLng(parsedPickupLng);
    setBaseLat(parsedOwnerLat ?? parsedPickupLat);
    setBaseLng(parsedOwnerLng ?? parsedPickupLng);

    setPickupPlaceName(farm.pickup_place_name ?? "");
    setPickupNotes(farm.pickup_notes ?? "");
    setPickupTime(
      typeof farm.pickup_time === "string"
        ? farm.pickup_time.toUpperCase()
        : null
    );

    setActiveReservationsCount(status.active_reservations_count ?? 0);
  };

  // 初期ロード
  useEffect(() => {
    let canceled = false;

    (async () => {
      const result = await fetchPickupSettingsMe();
      if (!result || canceled) return;

      applyFarmStateFromResponse(result.farm, result.status);
      setInitialLoading(false);
    })();

    return () => {
      canceled = true;
    };
  }, []);

  const canEdit = activeReservationsCount === 0;
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
              const data = await savePickupSettings(currentForSave, {
                pickup_lat: lat,
                pickup_lng: lng,
              });
              applyFarmStateFromResponse(data.farm, data.status);
            } catch {
              alert("受け渡し場所の保存に失敗しました");
            } finally {
              setSavingLocation(false);
            }
          }}
        />

        <PickupPlaceNameCard
          value={pickupPlaceName}
          saving={savingPlaceName}
          disabled={initialLoading || !canEdit || savingPlaceName}
          cannotChangeReason={lockReason}
          onSave={async (v) => {
            try {
              setSavingPlaceName(true);
              const data = await savePickupSettings(currentForSave, {
                pickup_place_name: v,
              });
              applyFarmStateFromResponse(data.farm, data.status);
            } catch {
              alert("受け渡し場所名の保存に失敗しました");
            } finally {
              setSavingPlaceName(false);
            }
          }}
        />

        <PickupNotesCard
          value={pickupNotes}
          saving={savingNotes}
          disabled={initialLoading || !canEdit || savingNotes}
          cannotChangeReason={lockReason}
          onSave={async (v) => {
            try {
              setSavingNotes(true);
              const data = await savePickupSettings(currentForSave, {
                pickup_notes: v,
              });
              applyFarmStateFromResponse(data.farm, data.status);
            } catch {
              alert("補足メモの保存に失敗しました");
            } finally {
              setSavingNotes(false);
            }
          }}
        />

        <PickupTimeCard
          value={pickupTime as any}
          saving={savingTime}
          disabled={initialLoading || !canEdit || savingTime}
          cannotChangeReason={lockReason}
          onSave={async (slot: any) => {
            try {
              setSavingTime(true);
              const data = await savePickupSettings(currentForSave, {
                pickup_time: String(slot),
              });
              applyFarmStateFromResponse(data.farm, data.status);
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
