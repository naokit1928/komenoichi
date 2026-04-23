import { useState, useEffect, useCallback, useRef } from "react";
import type { components } from "@/api/generated/public-farms";
import { API_BASE } from "@/config/api";
import type { FarmCardData } from "../components/FarmCard";

// ===== OpenAPI DTO =====
type PublicFarmCardDTO = components["schemas"]["PublicFarmCardDTO"];
type PublicFarmListResponse = components["schemas"]["PublicFarmListResponse"];

// ===== API =====
const LIST_URL = `${API_BASE}/api/public/farms`;
const LAST_CONFIRMED_URL = `${API_BASE}/api/public/reservations/latest`;

// ===== Geo =====
// 徳島市役所中心（launch初期はユーザー位置情報を取得せず、常にここを中心にする）
const TOKUSHIMA_CENTER = { lat: 34.0703, lng: 134.5548 };

export function useFarmsListPage() {
  const [farms, setFarms] = useState<FarmCardData[] | null>(null);
  const [publicFarms, setPublicFarms] = useState<PublicFarmCardDTO[]>([]);
  const [noFarmsWithin100km, setNoFarmsWithin100km] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [lastConfirmedFarmId, setLastConfirmedFarmId] = useState<number | null>(null);

  // ─────────────────────────────────────────────────────────────
  // ★ 位置情報の取得は launch 初期は廃止（信用が薄い段階での
  //   permission ダイアログは離脱要因になるため）。
  //   プラットフォームの信用が蓄積したら下記をコメントアウト解除すれば復活する。
  // ─────────────────────────────────────────────────────────────
  // const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const observerTarget = useRef<HTMLDivElement | null>(null);

  // ---- 1. 前回予約した農家の取得 ----
  useEffect(() => {
    const fetchLastConfirmed = async () => {
      try {
        const res = await fetch(LAST_CONFIRMED_URL, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (data && typeof data.farm_id === "number") {
          setLastConfirmedFarmId(data.farm_id);
        }
      } catch { /* ignore */ }
    };
    fetchLastConfirmed();
  }, []);

  // ---- 2. 位置情報の取得（★ 一時廃止中） ----
  // useEffect(() => {
  //   if (!("geolocation" in navigator)) return;
  //
  //   navigator.geolocation.getCurrentPosition(
  //     (pos) => {
  //       setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  //     },
  //     () => {
  //       // 失敗しても userLocation は null のままなので、fallback（徳島中心）が使われる
  //     },
  //     { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
  //   );
  // }, []);

  // ---- 3. APIフェッチ関数 ----
  const fetchPage = useCallback(
    async (page: number, append: boolean, lat: number | null, lng: number | null) => {
      if (append) {
        setLoadingMore(true);
      } else {
        if (!farms) setLoading(true);
      }

      try {
        const url = new URL(LIST_URL);
        url.searchParams.set("page", String(page));
        if (lat !== null && lng !== null) {
          url.searchParams.set("lat", String(lat));
          url.searchParams.set("lng", String(lng));
        }

        const res = await fetch(url.toString(), { credentials: "include" });
        if (!res.ok) throw new Error("Network response was not ok");
        const data = (await res.json()) as PublicFarmListResponse;

        const mapped: FarmCardData[] = data.farms.map((f) => ({
          id: f.farm_id,
          name: f.owner_label,
          price10kg: Number(f.price_10kg || 0),
          avatarUrl: f.face_image_url || "",
          images: f.pr_images?.length ? f.pr_images.slice(0, 6) : [],
          title: f.pr_title || "",
          addressLabel: f.owner_address_label || "",
          pickupTime: f.next_pickup_display || "",
          lat: typeof f.pickup_lat === "number" ? f.pickup_lat : null,
          lng: typeof f.pickup_lng === "number" ? f.pickup_lng : null,
        }));

        setFarms((prev) => (append && prev ? [...prev, ...mapped] : mapped));
        setPublicFarms((prev) => (append ? [...prev, ...data.farms] : data.farms));

        setNoFarmsWithin100km(!!data.no_farms_within_100km);
        setHasNext(!!data.has_next);
        setCurrentPage(data.page ?? page);
      } catch {
        setErrorMsg("現在はバックエンドに接続できません。");
      } finally {
        setLoadingMore(false);
        setLoading(false);
      }
    },
    [farms]
  );

  // ---- 4. 初回フェッチ（★ userLocation 監視は廃止、lat/lng は常に null） ----
  useEffect(() => {
    fetchPage(1, false, null, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 5. 無限スクロール ----
  useEffect(() => {
    const el = observerTarget.current;
    if (!el || loading || loadingMore || !hasNext) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchPage(currentPage + 1, true, null, null);
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasNext, currentPage, fetchPage]);

  return {
    farms,
    publicFarms,
    noFarmsWithin100km,
    loading,
    loadingMore,
    errorMsg,
    lastConfirmedFarmId,
    // ★ 位置情報廃止中：常に徳島中心を返す
    effectiveMapCenter: TOKUSHIMA_CENTER,
    observerTarget,
  };
}