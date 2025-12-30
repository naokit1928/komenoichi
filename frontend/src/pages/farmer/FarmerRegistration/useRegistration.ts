import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { RegistrationValues } from "../../../lib/registration";
import { validate } from "../../../lib/registration";
import type { TimeSlotOption } from "./PickupTimeCardForRegistration";
import { API_BASE } from "@/config/api";


/* ======================
   util（元コード踏襲）
====================== */

async function postRaw(url: string, body: any) {
  const res = await fetch(API_BASE + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    credentials: "include", // ★ 追加：session(cookie) を必ず送る
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

/* ======================
   validation helpers
====================== */

function computeAddressErrors(v: RegistrationValues): string[] {
  const res: string[] = [];
  const postalDigits = (v.ownerPostal || "").replace(/\D/g, "");

  if (postalDigits.length !== 7)
    res.push("郵便番号は7桁の数字で入力してください");
  if (!v.pref?.trim()) res.push("都道府県を入力してください");
  if (!v.city?.trim()) res.push("市区町村を入力してください");
  if (!v.addr1?.trim())
    res.push("番地・建物名（住所1）を入力してください");

  return res;
}

function computePhoneError(phone: string): string | null {
  const digits = (phone || "").replace(/[^\d]/g, "");
  if (!digits) return "携帯電話番号を入力してください";
  if (digits.length !== 11) return "無効な携帯電話番号です";
  if (!/^(070|080|090|060)\d{8}$/.test(digits))
    return "無効な携帯電話番号です";
  return null;
}

/* ======================
   geocode
====================== */

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
  if (typeof res.data.lat !== "number" || typeof res.data.lng !== "number")
    return null;
  return { lat: res.data.lat, lng: res.data.lng };
}

function normalizeErrorMessage(msg: string): string {
  if (
    msg.includes("受け渡し場所の緯度（lat）") ||
    msg.includes("受け渡し場所の経度（lng）")
  ) {
    return "受け渡し場所を設定してください。";
  }
  return msg;
}

/* ======================
   hook 本体（最終）
====================== */

export function useRegistration() {
  const navigate = useNavigate();

 

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

  const [pickupTimeOption, setPickupTimeOption] =
    useState<TimeSlotOption | null>(null);

  const [postalValid, setPostalValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [msg, setMsg] = useState("");

  /* ---------- validation ---------- */

  const baseValidateErrors = useMemo(() => validate(values), [values]);
  const addressErrors = useMemo(
    () => computeAddressErrors(values),
    [values.ownerPostal, values.pref, values.city, values.addr1]
  );
  const phoneError = useMemo(
    () => computePhoneError(values.phone),
    [values.phone]
  );

  const allErrors = useMemo(() => {
    const arr: string[] = [];
    const push = (m: string) => !arr.includes(m) && arr.push(m);

    baseValidateErrors.forEach((e) => push(normalizeErrorMessage(e)));
    addressErrors.forEach((e) => push(normalizeErrorMessage(e)));
    if (phoneError) push(phoneError);
    if (postalValid === false) push("存在しない郵便番号です。");

    return arr;
  }, [baseValidateErrors, addressErrors, phoneError, postalValid]);

  /* ---------- geocode ---------- */

  const fullAddressForMap = useMemo(
    () => buildFullAddressForGeocoding(values),
    [values.ownerPostal, values.pref, values.city, values.addr1, values.addr2]
  );

  const [baseLat, setBaseLat] = useState<number | null>(null);
  const [baseLng, setBaseLng] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle"
  );
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

  /* ---------- submit（確定） ---------- */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setMsg("");

    if (allErrors.length > 0) return;

    try {
      setLoading(true);

    

      const res = await postRaw(
        "/api/farmer/registration/finish_registration",
        {
          owner_last_name: values.lastName.trim(),
          owner_first_name: values.firstName.trim(),
          owner_last_kana: values.lastKana.trim(),
          owner_first_kana: values.firstKana.trim(),

          owner_postcode: values.ownerPostal.trim(),
          owner_pref: values.pref.trim(),
          owner_city: values.city.trim(),
          owner_addr_line: [values.addr1, values.addr2]
            .map((v) => v.trim())
            .filter(Boolean)
            .join(" "),
          owner_phone: values.phone.trim(),

          pickup_lat: Number(values.lat),
          pickup_lng: Number(values.lng),
          pickup_place_name: values.pickupPlaceName.trim(),
          pickup_notes: values.pickupNotes
            ? values.pickupNotes.trim()
            : null,
          pickup_time: String(values.pickupTime),
        }
      );

      if (res.ok) {
        // ★ farm_id は扱わない。ガードに全委譲
        navigate("/farmer/settings", { replace: true });
        return;
      }

      setMsg("サーバーエラーが発生しました");
    } catch (e) {
      console.error(e);
      setMsg("通信エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  const set =
    <K extends keyof RegistrationValues>(key: K) =>
    (v: RegistrationValues[K]) =>
      setValues((prev) => ({ ...prev, [key]: v }));

  return {
    values,
    set,
    pickupTimeOption,
    setPickupTimeOption,
    postalValid,
    setPostalValid,
    baseLat,
    baseLng,
    geoStatus,
    geoError,
    allErrors,
    submitted,
    loading,
    msg,
    handleSubmit,
  };
}
