import { API_BASE } from "@/config/api";

// ---------------------------
// 型定義
// ---------------------------

export interface PickupFarm {
  farm_id: number;
  owner_lat?: number;
  owner_lng?: number;
  pickup_lat: number;
  pickup_lng: number;
  pickup_place_name: string;
  pickup_notes?: string;
  pickup_time: string;
}

export interface PickupStatus {
  active_reservations_count: number;
  can_edit_pickup: boolean;
}

export interface PickupSettingsResponse {
  farm: PickupFarm;
  status: PickupStatus;
}

// 更新用ペイロード (全て任意)
export interface PickupUpdatePayload {
  pickup_lat?: number;
  pickup_lng?: number;
  pickup_place_name?: string;
  pickup_notes?: string;
  pickup_time?: string;
}

// ---------------------------
// API関数
// ---------------------------

/**
 * 共通フェッチラッパー
 */
async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include", // セッションCookie送信用
    ...options,
  });

  if (!res.ok) {
    // 必要に応じて 401 のハンドリングなどをここで統一できます
    throw new Error(`API Error: ${res.status}`);
  }

  // レスポンスが空でない場合のみパース
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return res.json();
  }
  return {} as T;
}

/**
 * GET /api/farmer/pickup-settings/me
 */
export async function fetchPickupSettingsMe(): Promise<PickupSettingsResponse> {
  return requestJson<PickupSettingsResponse>("/api/farmer/pickup-settings/me");
}

/**
 * POST /api/farmer/pickup-settings/me
 * 変更点だけを送信する
 */
export async function updatePickupSettingsMe(
  changes: PickupUpdatePayload
): Promise<PickupSettingsResponse> {
  return requestJson<PickupSettingsResponse>("/api/farmer/pickup-settings/me", {
    method: "POST",
    body: JSON.stringify(changes),
  });
}