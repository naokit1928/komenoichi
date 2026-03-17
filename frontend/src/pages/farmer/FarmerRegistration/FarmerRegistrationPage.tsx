import React, { useState } from "react";
import ReactDOM from "react-dom";

import RegistrationLayout from "./RegistrationLayout";
import { useRegistration } from "./useRegistration";

import OwnerSection from "./OwnerSection";

import PickupLocationCard from "../FarmerPickupSettings/PickupLocationCard";
import PickupPlaceNameCard from "../FarmerPickupSettings/PickupPlaceNameCard";
import PickupNotesCard from "../FarmerPickupSettings/PickupNotesCard";

import PickupTimeCardForRegistration from "./PickupTimeCardForRegistration";
import type { TimeSlotOption } from "./PickupTimeCardForRegistration";

// ============================
// 確認モーダル
// ============================
function ConfirmModal({
  values,
  onConfirm,
  onCancel,
}: {
  values: {
    lastName: string;
    firstName: string;
    lastKana: string;
    firstKana: string;
    phone: string;
    ownerPostal: string;
    pref: string;
    city: string;
    addr1: string;
  };
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const rows: { label: string; value: string }[] = [
    { label: "氏名", value: `${values.lastName} ${values.firstName}` },
    { label: "氏名（かな）", value: `${values.lastKana} ${values.firstKana}` },
    { label: "電話番号", value: values.phone },
    { label: "郵便番号", value: values.ownerPostal },
    { label: "都道府県", value: values.pref },
    { label: "市区町村", value: values.city },
    { label: "番地", value: values.addr1 },
  ];

  return ReactDOM.createPortal(
    <>
      {/* 背景 */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 9998,
        }}
      />

      {/* モーダル本体 */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 9999,
          width: "min(480px, 92vw)",
          background: "#fff",
          borderRadius: 20,
          padding: "28px 24px 24px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
        }}
      >
        {/* タイトル */}
        <h3
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "#111",
            marginBottom: 6,
          }}
        >
          登録内容の最終確認
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "#C62828",
            fontWeight: 600,
            marginBottom: 20,
            lineHeight: 1.6,
          }}
        >
          以下の情報は登録後に変更できません。
          <br />
          正確に入力されているかご確認ください。
        </p>

        {/* 確認テーブル */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          {rows.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                borderTop: i === 0 ? "none" : "1px solid #e5e7eb",
                fontSize: 14,
              }}
            >
              <div
                style={{
                  width: 120,
                  flexShrink: 0,
                  padding: "10px 12px",
                  background: "#F7F7F7",
                  color: "#6b7280",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {row.label}
              </div>
              <div
                style={{
                  padding: "10px 12px",
                  color: "#111",
                  fontWeight: 600,
                  wordBreak: "break-all",
                }}
              >
                {row.value || "（未入力）"}
              </div>
            </div>
          ))}
        </div>

        {/* ボタン */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 9999,
              border: "1px solid #d1d5db",
              background: "#fff",
              color: "#374151",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            戻って修正する
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 9999,
              border: "none",
              background: "#C62828",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            この内容で登録する
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

// ============================
// メインページ
// ============================
export default function FarmerRegistrationPage() {
  const reg = useRegistration();
  const [showConfirm, setShowConfirm] = useState(false);

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

  // ★ ボタン押下時：バリデーションのみ走らせてモーダルを出す
  function handleButtonClick() {
    // submitted を立てることでエラー表示を有効にする
    if (reg.allErrors.length > 0) {
      // バリデーションエラーがある場合はモーダルを出さずエラー表示
      // useRegistration の handleSubmit を e なしで呼べないため
      // フォームを仮 submit してバリデーションを走らせる
      const form = document.querySelector("form");
      if (form) {
        const event = new Event("submit", { bubbles: true, cancelable: true });
        form.dispatchEvent(event);
      }
      return;
    }
    setShowConfirm(true);
  }

  // ★ モーダルで「この内容で登録する」を押したとき
  function handleConfirm() {
    setShowConfirm(false);
    const form = document.querySelector("form");
    if (form) {
      const event = new Event("submit", { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
    }
  }

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

        <div style={{ height: 32 }} aria-hidden="true" />

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

        {/* ★ type="button" に変更してフォーム直接submitを防ぐ */}
        <div className="mt-8">
          <button
            type="button"
            onClick={handleButtonClick}
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
              border: "none",
              cursor: reg.loading ? "not-allowed" : "pointer",
            }}
          >
            {reg.loading ? "登録中..." : "登録を完了する"}
          </button>
        </div>

        <div style={{ height: 48 }} aria-hidden="true" />

        {reg.msg && (
          <p className="text-sm whitespace-pre-wrap text-red-600 mt-3">
            {reg.msg}
          </p>
        )}
      </form>

      {/* 確認モーダル */}
      {showConfirm && (
        <ConfirmModal
          values={reg.values}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </RegistrationLayout>
  );
}