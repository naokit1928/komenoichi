import React from "react";

import RegistrationLayout from "./RegistrationLayout";
import { useRegistration } from "./useRegistration";

import OwnerSection from "./OwnerSection";

import PickupLocationCard from "../FarmerPickupSettings/PickupLocationCard";
import PickupPlaceNameCard from "../FarmerPickupSettings/PickupPlaceNameCard";
import PickupNotesCard from "../FarmerPickupSettings/PickupNotesCard";

import PickupTimeCardForRegistration from "./PickupTimeCardForRegistration";
import type { TimeSlotOption } from "./PickupTimeCardForRegistration";

export default function FarmerRegistrationPage() {
  const reg = useRegistration();

  const pickupLatNumber =
    reg.values.lat && !isNaN(Number(reg.values.lat))
      ? Number(reg.values.lat)
      : null;

  const pickupLngNumber =
    reg.values.lng && !isNaN(Number(reg.values.lng))
      ? Number(reg.values.lng)
      : null;

  const addressReady =
    !!reg.values.ownerPostal &&
    !!reg.values.pref &&
    !!reg.values.city &&
    !!reg.values.addr1 &&
    reg.postalValid !== false;

  const disableLocationCard = reg.geoStatus === "loading";

  const errorListClass =
    "mt-3 text-[14px] font-semibold space-y-1 list-none text-red-600";

  return (
    <RegistrationLayout>
      {/* タイトル */}
      <h2 className="text-base font-semibold text-center mb-4">
        農家の新規登録
      </h2>

      <form onSubmit={reg.handleSubmit} className="space-y-6">
        {/* 基本情報 */}
        <div className="bg-white rounded-2xl shadow-sm px-4 py-5">
          <OwnerSection
            lastName={reg.values.lastName}
            setLastName={reg.set("lastName")}
            firstName={reg.values.firstName}
            setFirstName={reg.set("firstName")}
            lastKana={reg.values.lastKana}
            setLastKana={reg.set("lastKana")}
            firstKana={reg.values.firstKana}
            setFirstKana={reg.set("firstKana")}
            phone={reg.values.phone}
            setPhone={reg.set("phone")}
            pref={reg.values.pref}
            setPref={reg.set("pref")}
            city={reg.values.city}
            setCity={reg.set("city")}
            ownerPostal={reg.values.ownerPostal}
            setOwnerPostal={reg.set("ownerPostal")}
            addr1={reg.values.addr1}
            setAddr1={reg.set("addr1")}
            postalValid={reg.postalValid}
            setPostalValid={reg.setPostalValid}
          />
        </div>

        {/* 受け渡し設定 */}
        <div className="bg-white rounded-2xl shadow-sm px-4 py-5 space-y-4">
          <PickupLocationCard
            mode="new"
            initialLat={pickupLatNumber}
            initialLng={pickupLngNumber}
            onSave={(lat, lng) => {
              reg.set("lat")(String(lat));
              reg.set("lng")(String(lng));
            }}
            saving={reg.geoStatus === "loading"}
            disabled={disableLocationCard}
            baseLat={reg.baseLat}
            baseLng={reg.baseLng}
            radiusMeters={400}
            addressReady={addressReady}
          />

          {reg.geoError && (
            <p className="text-[11px] text-red-600 mt-1">{reg.geoError}</p>
          )}

          <PickupPlaceNameCard
            value={reg.values.pickupPlaceName}
            saving={false}
            onSave={(v) => reg.set("pickupPlaceName")(v)}
          />

          <PickupNotesCard
            value={reg.values.pickupNotes}
            saving={false}
            onSave={(v) => reg.set("pickupNotes")(v)}
          />

          <PickupTimeCardForRegistration
            value={reg.pickupTimeOption}
            onSave={(slot: TimeSlotOption) => {
              reg.setPickupTimeOption(slot);
              reg.set("pickupTime")(slot);
            }}
          />
        </div>

        {/* エラー表示 */}
        {reg.submitted && reg.allErrors.length > 0 && (
          <ul
            className={errorListClass}
            style={{
              color: "#DC2626",
              fontSize: 13,
              fontWeight: 600,
              listStyle: "none",
            }}
          >
            {reg.allErrors.map((err, i) => (
              <li key={i}>・{err}</li>
            ))}
          </ul>
        )}

        {/* ボタン前余白 */}
        <div style={{ height: 50 }} aria-hidden="true" />

        {/* 登録ボタン */}
        <div>
          <button
            type="submit"
            disabled={reg.loading}
            aria-label="登録を完了する"
            style={{
              width: "100%",
              height: 60,
              background: "#000000",
              color: "#FFFFFF",
              borderRadius: 9999,
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            {reg.loading ? "登録中..." : "登録を完了する"}
          </button>
        </div>

        {/* サーバーエラー */}
        {reg.msg && (
          <p className="text-sm whitespace-pre-wrap text-red-600 mt-3">
            {reg.msg}
          </p>
        )}
      </form>
    </RegistrationLayout>
  );
}
