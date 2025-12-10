// PublicFarmDetailDTO
// GET /api/public/farms/{farm_id} のレスポンス 1件分と 1:1 対応させる想定

export type PublicFarmDetailDTO = {
  // --- 基本識別子 ---
  farm_id: number;

  // --- オーナー情報（表示用ラベル）---
  owner_full_name: string;      // "山田太郎"
  owner_label: string;          // "山田太郎さんのお米"
  owner_address_label: string;  // "徳島県阿南市見能林の農家"
  pickup_address_label: string; // 受け渡し住所の表示用ラベル（将来の拡張も想定）

  // --- 画像 ---
  face_image_url: string;
  cover_image_url: string;
  pr_images: string[];          // URL の配列（先頭がカバー）

  // --- お米の情報 ---
  rice_variety_label: string;   // 品種ラベル（例: "コシヒカリ"）
  harvest_year: number;         // 自動計算された収穫年度（例: 2025）

  // --- 価格（円：5kg / 10kg / 25kg）---
  price_5kg: number;
  price_10kg: number;
  price_25kg: number;

  // --- PR テキスト ---
  pr_title: string;
  pr_text: string;

  // --- 受け渡しスロット / 次回日時 ---
  pickup_slot_code: string;     // "WED_19_20" など
  next_pickup_display: string;  // "11/27（水）19:00–20:00"
  next_pickup_start: string;    // ISO文字列 "2025-11-27T19:00:00+09:00"
  next_pickup_deadline: string; // ISO文字列 "2025-11-27T16:00:00+09:00"

  // --- 受け渡し場所（地図＋ラベル）---
  pickup_place_name: string;    // 受け渡し場所名
  pickup_notes: string;         // メモ（空文字もあり得る）
  pickup_lat: number;
  pickup_lng: number;
};
