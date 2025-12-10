// frontend/src/lib/registration.ts

// UI から受け取る型
export type RegistrationValues = {
  // 名前（必須）
  lastName: string;
  firstName: string;
  lastKana: string;
  firstKana: string;

  // 連絡先（必須）
  phone: string;

  // 住所（必須）
  ownerPostal: string; // 郵便番号
  pref: string;
  city: string;
  addr1: string; // 番地・建物名まで全部
  addr2: string; // 任意（建物名など）

  // 受け渡し（必須）
  lat: string;
  lng: string;
  pickupPlaceName: string;
  // ★ バックエンド仕様に合わせて "WED_19_20" / "SAT_10_11" を使う
  pickupTime: string;
  pickupRoof: boolean | null; // true のときだけOK（フロント側バリデーション用）

  // 任意
  email: string;
  farmName: string;
  pickupNotes: string;
};

// 受け渡し 2 つ択（value は backend 仕様に合わせる：新コードのみ）
export const PICKUP_TIMES = [
  { label: "水曜 19:00–20:00", value: "WED_19_20" },
  { label: "土曜 10:00–11:00", value: "SAT_10_11" },
] as const;

// ---------- ユーティリティ ----------

function isEmpty(s: unknown): boolean {
  return (
    s === null ||
    s === undefined ||
    (typeof s === "string" && s.trim().length === 0)
  );
}

// 郵便番号を数字7桁に正規化
function normalizePostal(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  return d.slice(0, 7);
}

// 電話番号も数字抽出
function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

// lat/lng を number 化（空は null）
function toFloatOrNull(s: string): number | null {
  if (!s || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ---------- バリデーション ----------

export function validate(values: RegistrationValues): string[] {
  const errors: string[] = [];

  // 名前（必須）
  if (isEmpty(values.lastName)) errors.push("姓を入力してください。");
  if (isEmpty(values.firstName)) errors.push("名を入力してください。");
  if (isEmpty(values.lastKana)) errors.push("セイを入力してください。");
  if (isEmpty(values.firstKana)) errors.push("メイを入力してください。");

  // 郵便番号（7桁）
  const postal = normalizePostal(values.ownerPostal);
  if (!postal || postal.length !== 7) {
    errors.push("郵便番号（7桁）を入力してください。");
  }

  // 住所（pref / city / addr1 は必須）
  if (isEmpty(values.pref)) errors.push("都道府県を入力してください。");
  if (isEmpty(values.city)) errors.push("市区町村を入力してください。");
  if (isEmpty(values.addr1)) {
    errors.push("番地・建物名まで入力してください。");
  }

  // 電話番号（必須）
  const phoneDigits = normalizePhone(values.phone);
  if (!phoneDigits) errors.push("電話番号を入力してください。");

  // 緯度経度（必須・数値変換可能）
  if (toFloatOrNull(values.lat) === null) {
    errors.push("受け渡し場所の緯度（lat）を入力してください。");
  }
  if (toFloatOrNull(values.lng) === null) {
    errors.push("受け渡し場所の経度（lng）を入力してください。");
  }

  // 受け渡し場所名（必須）
  if (isEmpty(values.pickupPlaceName)) {
    errors.push("受け渡し場所名を入力してください。");
  }

  // 受け渡し時間（必須）
  if (isEmpty(values.pickupTime)) {
    errors.push("受け渡し時間を選択してください。");
  }

  // 屋根（true のみ許可）
  if (values.pickupRoof !== true) {
    errors.push(
      "屋根のある場所のみ登録できます（「屋根あり」を選択してください）。"
    );
  }

  // 任意項目（email / farmName / pickupNotes）はバリデーション不要

  return errors;
}

// ---------- ペイロード生成（/api/farms/finish_registration 用） ----------
//
// バックエンドの期待する JSON:
//
//  {
//    "line_user_id": "test_011",
//    "last_name": "山田",
//    "first_name": "太郎",
//    "last_kana": "ヤマダ",
//    "first_kana": "タロウ",
//    "phone": "09011112222",
//    "email": "ntnaokit@gmail.com",
//    "postal_code": "7700932",
//    "pref": "徳島県",
//    "city": "徳島市",
//    "addr1": "仲之町1-2-3",
//    "addr2": "",
//    "farm_name": "山田農園",
//    "pickup_lat": 34.07,
//    "pickup_lng": 134.55,
//    "pickup_place_name": "自宅前スペース",
//    "pickup_time": "WED_19_20" | "SAT_10_11",
//    "pickup_notes": "屋根あり"
//  }
//
// これと同じキーを必ず全部送る。

export function buildPayload(values: RegistrationValues, lineUserId: string) {
  const postal = normalizePostal(values.ownerPostal);
  const phone = normalizePhone(values.phone);
  const lat = toFloatOrNull(values.lat) ?? 0;
  const lng = toFloatOrNull(values.lng) ?? 0;

  return {
    // 認証
    line_user_id: lineUserId,

    // 名前
    last_name: (values.lastName || "").trim(),
    first_name: (values.firstName || "").trim(),
    last_kana: (values.lastKana || "").trim(),
    first_kana: (values.firstKana || "").trim(),

    // 連絡先
    phone,
    email: (values.email || "").trim(), // 任意だが常に送る

    // 住所
    postal_code: postal,
    pref: (values.pref || "").trim(),
    city: (values.city || "").trim(),
    addr1: (values.addr1 || "").trim(),
    addr2: (values.addr2 || "").trim(), // UI で空なら空文字を送る

    // 農園名
    farm_name: (values.farmName || "").trim(),

    // 受け渡し
    pickup_lat: lat,
    pickup_lng: lng,
    pickup_place_name: (values.pickupPlaceName || "").trim(),
    // ★ ここも新コードそのまま送る（"WED_19_20" / "SAT_10_11"）
    pickup_time: values.pickupTime,
    pickup_notes: (values.pickupNotes || "").trim(),
  };
}
