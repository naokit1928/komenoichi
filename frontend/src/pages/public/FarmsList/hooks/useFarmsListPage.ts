import { useState, useEffect, useCallback, useRef } from "react";
import type { components } from "@/api/generated/public-farms";
import { API_BASE } from "@/config/api";
import type { FarmCardData } from "../components/FarmCard";

// ===== OpenAPI DTO =====
type PublicFarmCardDTO = components["schemas"]["PublicFarmCardDTO"];
type PublicFarmListResponse = components["schemas"]["PublicFarmListResponse"];

// ===== API =====
const LIST_URL = `${API_BASE}/api/public/farms`;
// ★ URLを正しいエンドポイントに修正
const LAST_CONFIRMED_URL = `${API_BASE}/api/public/reservations/latest`; 

// ===== Geo =====
const TOKUSHIMA_CENTER = { lat: 34.0703, lng: 134.5548 };

// ===== Hook =====
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

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null | "pending">("pending");
  const observerTarget = useRef<HTMLDivElement | null>(null);

  // ---- 1. 前回予約した農家の取得 ----
  useEffect(() => {
    const fetchLastConfirmed = async () => {
      try {
        const res = await fetch(LAST_CONFIRMED_URL, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        // ★ data.farm_id を確実に受け取る
        if (data && typeof data.farm_id === "number") {
          setLastConfirmedFarmId(data.farm_id);
        }
      } catch {
        /* ignore */
      }
    };
    fetchLastConfirmed();
  }, []);


  // ---- 2. 位置情報の取得 ----
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setUserLocation(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setUserLocation(null); // 拒否やタイムアウト時はnull（フォールバック）
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }, []);

  // ---- 3. APIフェッチ関数 ----
  const fetchPage = useCallback(
    async (page: number, append: boolean, lat: number | null, lng: number | null) => {
      append ? setLoadingMore(true) : setLoading(true);

      try {
        // ★ 変更点3: APIのURLに緯度経度を付与
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

        // ★ 変更点4: バックエンドでソート済みのため、そのままセット
        setFarms((prev) => (append && prev ? [...prev, ...mapped] : mapped));
        setPublicFarms((prev) => (append ? [...prev, ...data.farms] : data.farms));

        setNoFarmsWithin100km(!!data.no_farms_within_100km);
        setHasNext(!!data.has_next);
        setCurrentPage(data.page ?? page);
      } catch {
        setErrorMsg("現在はバックエンドに接続できません。");
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
      }
    },
    []
  );

  // ---- 4. 初回フェッチ（位置情報が確定したら実行） ----
  useEffect(() => {
    if (userLocation === "pending") return;
    const lat = userLocation?.lat ?? null;
    const lng = userLocation?.lng ?? null;
    fetchPage(1, false, lat, lng);
  }, [userLocation, fetchPage]);

  // ---- 5. 無限スクロール（IntersectionObserver） ----
  useEffect(() => {
    const el = observerTarget.current;
    if (!el || loading || loadingMore || !hasNext || userLocation === "pending") return;

    // 要素が画面に入ったかを検知するブラウザ標準API
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const lat = userLocation?.lat ?? null;
          const lng = userLocation?.lng ?? null;
          fetchPage(currentPage + 1, true, lat, lng);
        }
      },
      // 画面下部300pxまで近づいたら事前に読み込みを開始する
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
    effectiveMapCenter: userLocation && userLocation !== "pending" ? userLocation : TOKUSHIMA_CENTER,
    observerTarget, // UI連携用
  };
}