import { useState, useEffect, useCallback } from "react";
import type { components } from "@/api/generated/public-farms";
import { API_BASE } from "@/config/api";
import type { FarmCardData } from "../components/FarmCard";

// ===== OpenAPI DTO =====
type PublicFarmCardDTO =
  components["schemas"]["PublicFarmCardDTO"];

type PublicFarmListResponse =
  components["schemas"]["PublicFarmListResponse"];

// ===== API =====
const LIST_URL = `${API_BASE}/api/public/farms`;
const LAST_CONFIRMED_URL = `${API_BASE}/api/public/last-confirmed-farm`;

// ===== Geo =====
const TOKUSHIMA_CENTER = { lat: 34.0703, lng: 134.5548 };

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

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

  const [lastConfirmedFarmId, setLastConfirmedFarmId] =
    useState<number | null>(null);

  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // ---- Geolocation ----
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        /* ignore */
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 600000,
      }
    );
  }, []);

  // ---- sort helpers ----
  const sortFarmCardsByDistance = useCallback(
    (items: FarmCardData[]) => {
      if (!userLocation) return items;
      return [...items].sort((a, b) => {
        if (a.lat == null || a.lng == null) return 1;
        if (b.lat == null || b.lng == null) return -1;
        return (
          distanceMeters(userLocation, { lat: a.lat, lng: a.lng }) -
          distanceMeters(userLocation, { lat: b.lat, lng: b.lng })
        );
      });
    },
    [userLocation]
  );

  const sortPublicFarmsByDistance = useCallback(
    (items: PublicFarmCardDTO[]) => {
      if (!userLocation) return items;
      return [...items].sort((a, b) => {
        if (a.pickup_lat == null || a.pickup_lng == null) return 1;
        if (b.pickup_lat == null || b.pickup_lng == null) return -1;
        return (
          distanceMeters(userLocation, {
            lat: a.pickup_lat,
            lng: a.pickup_lng,
          }) -
          distanceMeters(userLocation, {
            lat: b.pickup_lat,
            lng: b.pickup_lng,
          })
        );
      });
    },
    [userLocation]
  );

  // ---- fetch last confirmed ----
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(LAST_CONFIRMED_URL, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data?.farm_id === "number") {
          setLastConfirmedFarmId(data.farm_id);
        }
      } catch {
        /* ignore */
      }
    };
    run();
  }, []);

  // ---- fetch page ----
  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      append ? setLoadingMore(true) : setLoading(true);

      try {
        const res = await fetch(`${LIST_URL}?page=${page}`, {
          credentials: "include",
        });
        const data = (await res.json()) as PublicFarmListResponse;

        const mapped: FarmCardData[] = data.farms.map((f) => ({
          id: f.farm_id,
          name: f.owner_label,
          price10kg: Number(f.price_10kg || 0),
          avatarUrl: f.face_image_url || "",
          images: f.pr_images?.length
            ? f.pr_images.slice(0, 6)
            : [],
          title: f.pr_title || "",
          addressLabel: f.owner_address_label || "",
          pickupTime: f.next_pickup_display || "",
          lat: typeof f.pickup_lat === "number" ? f.pickup_lat : null,
          lng: typeof f.pickup_lng === "number" ? f.pickup_lng : null,
        }));

        setFarms((prev) =>
          sortFarmCardsByDistance(
            append && prev ? [...prev, ...mapped] : mapped
          )
        );

        setPublicFarms((prev) =>
          sortPublicFarmsByDistance(
            append ? [...prev, ...data.farms] : data.farms
          )
        );

        setNoFarmsWithin100km(!!data.no_farms_within_100km);
        setHasNext(!!data.has_next);
        setCurrentPage(data.page ?? page);
      } catch {
        setErrorMsg("現在はバックエンドに接続できません。");
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
      }
    },
    [sortFarmCardsByDistance, sortPublicFarmsByDistance]
  );

  useEffect(() => {
    fetchPage(1, false);
  }, [fetchPage]);

  useEffect(() => {
    const onScroll = () => {
      if (loading || loadingMore || !hasNext) return;
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 300
      ) {
        fetchPage(currentPage + 1, true);
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [loading, loadingMore, hasNext, currentPage, fetchPage]);

  return {
    farms,
    publicFarms,
    noFarmsWithin100km,
    loading,
    loadingMore,
    errorMsg,
    lastConfirmedFarmId,
    effectiveMapCenter: userLocation ?? TOKUSHIMA_CENTER,
  };
}
