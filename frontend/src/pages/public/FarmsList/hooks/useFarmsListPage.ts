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

  // ★ 1. "pending" を廃止し、初期値を null に。これで即座にフェッチが走るようになる
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
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


  // ---- 2. 位置情報の取得（バックグラウンドで実行） ----
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        // 失敗しても userLocation は null のままなので、fallback（徳島中心など）が使われる
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }, []);

  // ---- 3. APIフェッチ関数 ----
  const fetchPage = useCallback(
    async (page: number, append: boolean, lat: number | null, lng: number | null) => {
      // 2回目以降のフェッチ（GPS確定後の再取得など）で、
      // 既にデータがある場合は「loading（全画面）」ではなく「loadingMore（下部）」で処理する工夫
      if (append) {
        setLoadingMore(true);
      } else {
        // すでに farms がある状態（GPS取得後の再読み込み）なら、
        // 全画面 loading にせず裏でこっそり更新するとUXが良い
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

  // ---- 4. 初回 & 位置情報確定時のフェッチ ----
  useEffect(() => {
    // userLocation が null（未確定）でも一回目を叩く。
    // その後 GPS が取れて userLocation が更新されたら、もう一度叩いて「近い順」に更新する。
    const lat = userLocation?.lat ?? null;
    const lng = userLocation?.lng ?? null;
    fetchPage(1, false, lat, lng);
  }, [userLocation]); // userLocation を監視


  // ---- 5. 無限スクロール ----
  useEffect(() => {
    const el = observerTarget.current;
    // ★ "pending" チェックを削除
    if (!el || loading || loadingMore || !hasNext) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const lat = userLocation?.lat ?? null;
          const lng = userLocation?.lng ?? null;
          fetchPage(currentPage + 1, true, lat, lng);
        }
      },
      { rootMargin: "300px" } 
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasNext, currentPage, userLocation, fetchPage]);

  return {
    farms,
    publicFarms,
    noFarmsWithin100km,
    loading,
    loadingMore,
    errorMsg,
    lastConfirmedFarmId,
    // ★ userLocation が null ならデフォルトを表示
    effectiveMapCenter: userLocation ?? TOKUSHIMA_CENTER,
    observerTarget,
  };
}