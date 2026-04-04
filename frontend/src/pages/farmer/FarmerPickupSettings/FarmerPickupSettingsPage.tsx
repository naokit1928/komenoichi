import React, { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import PickupLocationCard from "./PickupLocationCard";
import PickupPlaceNameCard from "./PickupPlaceNameCard";
import PickupNotesCard from "./PickupNotesCard";
import PickupTimeCard from "./PickupTimeCard";
import type { TimeSlotOption } from "./PickupTimeCard";

import FarmerSettingsHeader from "../FarmerSettings/FarmerSettingsHeader";

// API関連のインポート
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

  // トースト
  const [toast, setToast] = useState<{ kind: "ok" | "ng"; text: string } | null>(null);
  const showToast = useCallback((kind: "ok" | "ng", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 1800);
  }, []);

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

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <FarmerSettingsHeader title="受け渡し設定" />
      
      {/* ── 他ページと同じ最大幅640pxの中央寄せ ── */}
      <div style={{ maxWidth: 640, margin: "0 auto", paddingTop: 24 }}>
        
        {/* 予約ロックバナー */}
        {!canEdit && (
          <div style={{
            margin: "0 16px 24px",
            padding: "12px 16px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 16,
            fontSize: 13,
            color: "#DC2626",
            fontWeight: 600,
            lineHeight: 1.6,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            今週すでに予約が入っているため、設定は変更できません。
          </div>
        )}

        <div style={{ padding: "0 16px 64px", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* 場所カード */}
          <PickupLocationCard
            initialLat={pickupLat}
            initialLng={pickupLng}
            baseLat={baseLat}
            baseLng={baseLng}
            radiusMeters={400}
            saving={savingLocation}
            disabled={initialLoading || !canEdit || savingLocation}
            onSave={async (lat, lng) => {
              try {
                setSavingLocation(true);
                const data = await updatePickupSettingsMe({
                  pickup_lat: lat,
                  pickup_lng: lng,
                });
                applyFarmState(data.farm, data.status);
                showToast("ok", "受け渡し場所を保存しました。");
              } catch {
                showToast("ng", "受け渡し場所の保存に失敗しました");
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
            onSave={async (val) => {
              try {
                setSavingPlaceName(true);
                const data = await updatePickupSettingsMe({
                  pickup_place_name: val,
                });
                applyFarmState(data.farm, data.status);
                showToast("ok", "場所名を保存しました。");
              } catch {
                showToast("ng", "受け渡し場所名の保存に失敗しました");
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
            onSave={async (val) => {
              try {
                setSavingNotes(true);
                const data = await updatePickupSettingsMe({
                  pickup_notes: val,
                });
                applyFarmState(data.farm, data.status);
                showToast("ok", "補足メモを保存しました。");
              } catch {
                showToast("ng", "補足メモの保存に失敗しました");
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
            onSave={async (slot) => {
              try {
                setSavingTime(true);
                const data = await updatePickupSettingsMe({
                  pickup_time: String(slot),
                });
                applyFarmState(data.farm, data.status);
                showToast("ok", "受け取り時間を保存しました。");
              } catch {
                showToast("ng", "受け取り時間の保存に失敗しました");
              } finally {
                setSavingTime(false);
              }
            }}
          />
        </div>
      </div>

      {/* トースト */}
      {toast && ReactDOM.createPortal(
        <div
          role="status"
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 2147483647,
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderRadius: 18,
            padding: "12px 20px",
            background: toast.kind === "ok" ? "rgba(16,185,129,.95)" : "rgba(239,68,68,.95)",
            color: "white",
            fontSize: 15,
            fontWeight: 600,
            boxShadow: "0 8px 32px rgba(0,0,0,.2)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            {toast.kind === "ok" ? (
              <path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            ) : (
              <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            )}
          </svg>
          {toast.text}
        </div>,
        document.body
      )}
    </div>
  );
};

export default FarmerPickupSettingsPage;