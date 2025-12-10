import React, { useEffect, useMemo, useState } from "react";

import OwnerSection from "./OwnerSection";
import type { RegistrationValues } from "../../../lib/registration";
import { validate } from "../../../lib/registration";

import PickupLocationCard from "../FarmerPickupSettings/PickupLocationCard";
import PickupPlaceNameCard from "../FarmerPickupSettings/PickupPlaceNameCard";
import PickupNotesCard from "../FarmerPickupSettings/PickupNotesCard";

// ▼ ここがポイント：コンポーネントは通常 import、型は「import type」
import PickupTimeCardForRegistration from "./PickupTimeCardForRegistration";
import type { TimeSlotOption } from "./PickupTimeCardForRegistration";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ||
  (import.meta as any).env?.VITE_BACKEND_BASE_URL ||
  "";
const DEV_MODE = (import.meta as any).env?.VITE_DEV_MODE === "1";

async function postRaw(url: string, body: any) {
  const res = await fetch(API_BASE + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const ct = res.headers.get("content-type") || "";
  let data: any = null;
  try {
    data = ct.includes("application/json") ? await res.json() : await res.text();
  } catch {}
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  return { status: res.status, ok: res.ok, data, headers };
}

// 住所のエラーチェック
function computeAddressErrors(v: RegistrationValues): string[] {
  const res: string[] = [];

  const postalDigits = (v.ownerPostal || "").replace(/\D/g, "");
  if (postalDigits.length !== 7) {
    res.push("郵便番号は7桁の数字で入力してください");
  }
  if (!v.pref || !v.pref.trim()) res.push("都道府県を入力してください");
  if (!v.city || !v.city.trim()) res.push("市区町村を入力してください");
  if (!v.addr1 || !v.addr1.trim()) {
    res.push("番地・建物名（住所1）を入力してください");
  }

  return res;
}

// 携帯電話番号のエラーチェック
function computePhoneError(phone: string): string | null {
  const digits = (phone || "").replace(/[^\d]/g, "");
  if (!digits) {
    return "携帯電話番号を入力してください";
  }
  if (digits.length !== 11) {
    return "無効な携帯電話番号です";
  }
  if (!/^(070|080|090|060)\d{8}$/.test(digits)) {
    return "無効な携帯電話番号です";
  }
  return null;
}

function buildFullAddressForGeocoding(v: RegistrationValues): string | null {
  if (computeAddressErrors(v).length > 0) return null;

  const postalDigits = (v.ownerPostal || "").replace(/\D/g, "");
  const postalStr =
    postalDigits.length === 7
      ? `〒${postalDigits.slice(0, 3)}-${postalDigits.slice(3)}`
      : "";

  const parts: string[] = [];
  if (postalStr) parts.push(postalStr);
  if (v.pref) parts.push(v.pref.trim());
  if (v.city) parts.push(v.city.trim());
  if (v.addr1) parts.push(v.addr1.trim());
  if (v.addr2) parts.push(v.addr2.trim());

  if (parts.length === 0) return null;

  return ["日本", parts.join("")].join("");
}

async function geocodeAddress(fullAddress: string) {
  const res = await postRaw("/api/geocode", {
    address: fullAddress,
    region: "jp",
  });
  if (!res.ok || !res.data?.ok) return null;
  const lat = res.data.lat;
  const lng = res.data.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
}

// 緯度・経度関連のエラーメッセージを一つにまとめる
function normalizeErrorMessage(msg: string): string {
  if (
    msg.includes("受け渡し場所の緯度（lat）を入力してください") ||
    msg.includes("受け渡し場所の経度（lng）を入力してください")
  ) {
    return "受け渡し場所を設定してください。";
  }
  return msg;
}

interface FarmerRegistrationPayload {
  line_user_id: string;

  owner_last_name: string;
  owner_first_name: string;
  owner_last_kana: string;
  owner_first_kana: string;

  owner_postcode: string;
  owner_pref: string;
  owner_city: string;
  owner_addr_line: string;

  owner_phone: string;

  pickup_lat: number;
  pickup_lng: number;
  pickup_place_name: string;
  pickup_notes: string | null;
  pickup_time: string;
}

function buildRegistrationPayload(
  values: RegistrationValues,
  lineUserId: string
): FarmerRegistrationPayload {
  const pickupLat = Number(values.lat);
  const pickupLng = Number(values.lng);

  return {
    line_user_id: lineUserId,

    owner_last_name: values.lastName.trim(),
    owner_first_name: values.firstName.trim(),
    owner_last_kana: values.lastKana.trim(),
    owner_first_kana: values.firstKana.trim(),

    owner_postcode: (values.ownerPostal || "").trim(),
    owner_pref: (values.pref || "").trim(),
    owner_city: (values.city || "").trim(),
    owner_addr_line: [values.addr1 || "", values.addr2 || ""]
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .join(" "),
    owner_phone: (values.phone || "").trim(),

    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    pickup_place_name: (values.pickupPlaceName || "").trim(),
    pickup_notes: values.pickupNotes ? values.pickupNotes.trim() : null,
    pickup_time: String(values.pickupTime || ""),
  };
}

export default function FarmerRegistrationPage() {
  const [lineUserId] = useState(
    "dev_" + Math.random().toString(36).slice(2, 10)
  );

  const [values, setValues] = useState<RegistrationValues>({
    lastName: "",
    firstName: "",
    lastKana: "",
    firstKana: "",
    phone: "",
    ownerPostal: "",
    pref: "徳島県",
    city: "",
    addr1: "",
    addr2: "",
    lat: "",
    lng: "",
    pickupPlaceName: "",
    pickupTime: "",
    pickupRoof: true,
    email: "",
    farmName: "",
    pickupNotes: "",
  });

  // 受け渡し時間カード用 state（型だけ TimeSlotOption を使う）
  const [pickupTimeOption, setPickupTimeOption] =
    useState<TimeSlotOption | null>(null);

  const [devAutoFriend] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // 郵便番号が「存在する」かどうか（OwnerSection が更新）
  const [postalValid, setPostalValid] = useState<boolean | null>(null);

  // 既存の validate（必須項目など）
  const baseValidateErrors = useMemo(
    () => validate(values),
    [values]
  );

  // 郵便番号・住所
  const addressErrors = useMemo(
    () => computeAddressErrors(values),
    [values.ownerPostal, values.pref, values.city, values.addr1]
  );

  // 電話番号
  const phoneError = useMemo(
    () => computePhoneError(values.phone),
    [values.phone]
  );

  // full address を geocoding 用に組み立て
  const fullAddressForMap = useMemo(
    () => buildFullAddressForGeocoding(values),
    [values.ownerPostal, values.pref, values.city, values.addr1, values.addr2]
  );

  const [baseLat, setBaseLat] = useState<number | null>(null);
  const [baseLng, setBaseLng] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState("idle");
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!fullAddressForMap) {
        setBaseLat(null);
        setBaseLng(null);
        setGeoStatus("idle");
        setGeoError(null);
        return;
      }

      setGeoStatus("loading");
      const result = await geocodeAddress(fullAddressForMap);
      if (cancelled) return;

      if (!result) {
        setBaseLat(null);
        setBaseLng(null);
        setGeoStatus("error");
        setGeoError("住所から位置を特定できませんでした。");
        return;
      }

      setBaseLat(result.lat);
      setBaseLng(result.lng);
      setGeoStatus("ok");
      setGeoError(null);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [fullAddressForMap]);

  // すべてのエラーを 1 箇所に集約し、lat/lng は「受け渡し場所を設定してください。」にまとめる
  const allErrors = useMemo(() => {
    const setArr: string[] = [];

    const pushUnique = (m: string) => {
      if (!setArr.includes(m)) setArr.push(m);
    };

    for (const e of baseValidateErrors) {
      pushUnique(normalizeErrorMessage(e));
    }
    for (const e of addressErrors) {
      pushUnique(normalizeErrorMessage(e));
    }
    if (phoneError) {
      pushUnique(phoneError);
    }
    if (postalValid === false) {
      pushUnique("存在しない郵便番号です。");
    }

    return setArr;
  }, [baseValidateErrors, addressErrors, phoneError, postalValid]);

  const set =
    <K extends keyof RegistrationValues>(key: K) =>
    (v: RegistrationValues[K]) =>
      setValues((prev) => ({ ...prev, [key]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setMsg("");

    // 1つでもエラーがあれば登録を止める
    if (allErrors.length > 0) {
      return;
    }

    try {
      setLoading(true);

      if (DEV_MODE && devAutoFriend) {
        await postRaw("/dev/test_login", { line_user_id: lineUserId });
        await postRaw("/dev/friendship_override", {
          line_user_id: lineUserId,
          is_friend: true,
        });
      }

      const payload = buildRegistrationPayload(values, lineUserId);
      const res = await postRaw(
        "/api/farmer/registration/finish_registration",
        payload
      );

      if (res.ok) {
        const farmId = res.data?.farm_id || res.data?.id || "";
        if (farmId) {
          localStorage.setItem("last_farm_id", String(farmId));
        }

        const settingsUrlHint =
          (res.data &&
            typeof res.data.settings_url_hint === "string" &&
            res.data.settings_url_hint) ||
          (farmId ? `/farmer/settings?farm_id=${farmId}` : "/farmer/settings");

        window.location.href = settingsUrlHint;
        return;
      }

      // サーバー側のエラーだけ msg に表示
      let detail = res.data?.detail ?? res.data;
      if (Array.isArray(detail)) {
        setMsg(
          "サーバーエラー:\n" +
            detail.map((d: any) => "- " + d.msg).join("\n")
        );
      } else {
        setMsg("サーバーエラー: " + JSON.stringify(detail));
      }
    } catch (e: any) {
      console.error(e);
      setMsg("通信エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  // 住所入力がある程度埋まっているか
  const addressReady =
    !!values.ownerPostal &&
    !!values.pref &&
    !!values.city &&
    !!values.addr1 &&
    postalValid !== false;

  const pickupLatNumber =
    values.lat && !isNaN(Number(values.lat)) ? Number(values.lat) : null;
  const pickupLngNumber =
    values.lng && !isNaN(Number(values.lng)) ? Number(values.lng) : null;

  // 住所エラーではボタンを止めない。地図の読み込み中だけ無効化。
  const disableLocationCard = geoStatus === "loading";

  // エラーリストのスタイル：赤字・小さめ・箇条書き
  const errorListClass =
    "mt-3 text-[14px] font-semibold space-y-1 list-none text-red-600";

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <div className="mx-auto max-w-md px-4 py-6">
        {/* タイトル: 農家の新規登録 / 一回り小さく / 中央揃え */}
        <h2 className="text-base font-semibold text-center mb-4">
          農家の新規登録
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 基本情報 */}
          <div className="bg-white rounded-2xl shadow-sm px-4 py-5">
            <OwnerSection
              lastName={values.lastName}
              setLastName={set("lastName")}
              firstName={values.firstName}
              setFirstName={set("firstName")}
              lastKana={values.lastKana}
              setLastKana={set("lastKana")}
              firstKana={values.firstKana}
              setFirstKana={set("firstKana")}
              phone={values.phone}
              setPhone={set("phone")}
              pref={values.pref}
              setPref={set("pref")}
              city={values.city}
              setCity={set("city")}
              ownerPostal={values.ownerPostal}
              setOwnerPostal={set("ownerPostal")}
              addr1={values.addr1}
              setAddr1={set("addr1")}
              postalValid={postalValid}
              setPostalValid={setPostalValid}
            />
          </div>

          {/* 受け渡しカード群 */}
          <div className="bg-white rounded-2xl shadow-sm px-4 py-5 space-y-4">
            <PickupLocationCard
              mode="new"
              initialLat={pickupLatNumber}
              initialLng={pickupLngNumber}
              onSave={(lat, lng) => {
                set("lat")(String(lat));
                set("lng")(String(lng));
              }}
              saving={geoStatus === "loading"}
              disabled={disableLocationCard}
              baseLat={baseLat}
              baseLng={baseLng}
              radiusMeters={400}
              // 住所が一通り埋まっているかどうか（未入力なら注意モーダルでブロック）
              addressReady={addressReady}
            />

            {geoError && (
              <p className="text-[11px] text-red-600 mt-1">{geoError}</p>
            )}

            <PickupPlaceNameCard
              value={values.pickupPlaceName}
              saving={false}
              onSave={(v) => set("pickupPlaceName")(v)}
            />

            <PickupNotesCard
              value={values.pickupNotes}
              saving={false}
              onSave={(v) => set("pickupNotes")(v)}
            />

            <PickupTimeCardForRegistration
              value={pickupTimeOption}
              onSave={(slot: TimeSlotOption) => {
                setPickupTimeOption(slot);
                set("pickupTime")(slot);
              }}
            />
          </div>

          {/* ▼ エラー表示（ここだけ・登録ボタンの上） */}
          {submitted && allErrors.length > 0 && (
            <ul
              className={errorListClass}
              style={{
                color: "#DC2626",
                fontSize: 13,
                fontWeight: 600,
                listStyle: "none",
              }}
            >
              {allErrors.map((err, i) => (
                <li key={i}>・{err}</li>
              ))}
            </ul>
          )}

          {/* ボタン前の余白 */}
          <div style={{ height: 50 }} aria-hidden="true" />

          {/* 登録ボタン */}
          <div>
            <button
              type="submit"
              disabled={loading}
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
              {loading ? "登録中..." : "登録を完了する"}
            </button>
          </div>

          {/* サーバー側エラーのみここに表示 */}
          {msg && (
            <p className="text-sm whitespace-pre-wrap text-red-600 mt-3">
              {msg}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
