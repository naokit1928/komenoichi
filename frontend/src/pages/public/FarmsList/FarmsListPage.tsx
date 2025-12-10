// src/pages/FarmsListPage.tsx
import React, { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import MapLayerPortal from "./MapLayerPortal";

// ====== API base ======
const ENV_BACKEND = (import.meta as any)?.env?.VITE_BACKEND_BASE_URL as
  | string
  | undefined;
const ENV_API_BASE = (import.meta as any)?.env?.VITE_API_BASE as
  | string
  | undefined;

const API_BASE = (
  (ENV_BACKEND && ENV_BACKEND.trim()) ||
  (ENV_API_BASE && ENV_API_BASE.trim()) ||
  "http://localhost:8000"
).replace(/\/+$/, "");

// V2 Public API
const LIST_URL = `${API_BASE}/api/public/farms`;
const LAST_CONFIRMED_URL = `${API_BASE}/public/last-confirmed-farm`;

// ====== Favorite (local only) ======
const FAVORITES_KEY = "favoriteFarms";

function loadFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function saveFavoriteIds(ids: string[]) {
  try {
    localStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify(Array.from(new Set(ids)))
    );
  } catch {
    // ignore
  }
}

// ====== V2 DTO（FarmsListPage 内で定義） ======
export type PublicFarmCardDTO = {
  farm_id: number;

  owner_label: string;
  owner_address_label: string;
  owner_full_name: string;

  price_10kg: number;

  face_image_url: string;
  pr_images: string[];
  pr_title: string;

  pickup_slot_code: string;
  next_pickup_display: string;
  next_pickup_start: string;
  next_pickup_deadline: string;

  pickup_lat: number;
  pickup_lng: number;
};

export type PublicFarmListResponse = {
  ok: boolean;
  page: number;
  page_size: number;
  total_count: number;
  has_next: boolean;
  no_farms_within_100km: boolean;
  farms: PublicFarmCardDTO[];
};

type LastConfirmedFarmResponse = {
  ok: boolean;
  farm_id: number | null;
};

// 一覧カード用の内部データ
type FarmCardData = {
  id: number;
  name: string; // owner_label （◯◯さんのお米）
  price10kg: number;
  avatarUrl: string; // face_image_url
  images: string[]; // pr_images
  title: string; // pr_title
  addressLabel: string; // owner_address_label
  pickupTime: string; // next_pickup_display
  // ★ 距離ソート用：受け渡し場所の座標を保持
  lat: number | null;
  lng: number | null;
};

const TOKUSHIMA_CENTER = { lat: 34.0703, lng: 134.5548 };

// ====== 距離計算ユーティリティ（メートル） ======
function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000; // 地球半径[m]
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

// ====== UI helpers ======
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "#dc2626" : "none"}
      stroke={filled ? "#dc2626" : "#111827"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61c-1.54-1.4-3.97-1.33-5.43.15L12 8.17l-3.41-3.4c-1.46-1.48-3.89-1.55-5.43-.15-1.74 1.58-1.82 4.28-.18 5.96l3.32 3.44L12 20.5l5.7-6.04 3.32-3.44c1.64-1.68 1.56-4.38-.18-5.96z" />
    </svg>
  );
}

function FarmCard({
  farm,
  isFav,
  toggleFav,
}: {
  farm: FarmCardData;
  isFav: boolean;
  toggleFav: (id: number, e?: React.MouseEvent) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) =>
    setTouchStartX(e.touches[0].clientX);

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (dx > 40)
      setIdx((i) => (i - 1 + farm.images.length) % farm.images.length);
    if (dx < -40) setIdx((i) => (i + 1) % farm.images.length);
    setTouchStartX(null);
  };

  const card = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#fff",
    overflow: "hidden",
    transition: "box-shadow 150ms, transform 150ms",
  } as const;

  const text = { padding: 16 } as const;

  const imageCount = Math.max(farm.images.length, 1);
  const safeIdx = Math.min(Math.max(idx, 0), Math.max(imageCount - 1, 0));
  const mainImage =
    farm.images[safeIdx] || "https://placehold.co/1500x1000?text=No+Image";

  // 表示用タイトル：pr_title があればそれを、なければ owner_label
  const displayTitle = farm.title || farm.name;

  return (
    <article style={card}>
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "3 / 2",
          overflow: "hidden",
          userSelect: "none",
        }}
      >
        <img
          src={mainImage}
          alt={`${displayTitle}の写真 ${safeIdx + 1}`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        <button
          type="button"
          aria-pressed={isFav}
          aria-label={isFav ? "お気に入りから削除" : "お気に入りに追加"}
          title={isFav ? "お気に入りから削除" : "お気に入りに追加"}
          onClick={(e) => toggleFav(farm.id, e)}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 38,
            height: 38,
            borderRadius: 9999,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
            padding: 0,
          }}
        >
          <HeartIcon filled={isFav} />
        </button>
        <div
          style={{
            position: "absolute",
            right: 10,
            bottom: 10,
            padding: "4px 8px",
            borderRadius: 9999,
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            fontSize: 12,
          }}
        >
          {Math.min(safeIdx + 1, imageCount)} / {imageCount}
        </div>
      </div>

      <div style={text}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <img
            src={farm.avatarUrl || "https://placehold.co/80x80?text=F"}
            alt={farm.name}
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              border: "1px solid #d1d5db",
              objectFit: "cover",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* 太文字タイトル：PRタイトル */}
            <h2
              style={{
                fontSize: 19,
                fontWeight: 700,
                color: "#111827",
                margin: 0,
              }}
            >
              {displayTitle}
            </h2>
            {/* その下の行：◯◯さんのお米 */}
            <div
              style={{
                fontSize: 13,
                color: "#4b5563",
              }}
            >
              {farm.name}
            </div>
          </div>
        </div>

        {/* この段落に住所ラベルを表示 */}
        {farm.addressLabel && (
          <p
            style={{
              fontSize: 14,
              color: "#4b5563",
              marginTop: 4,
              lineHeight: 1.6,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as any,
              overflow: "hidden",
            }}
            title={farm.addressLabel}
          >
            {farm.addressLabel}
          </p>
        )}

        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#111827",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <span
              style={{
                textDecoration: "underline",
                textDecorationThickness: "2px",
                textUnderlineOffset: 3,
              }}
            >{`¥${farm.price10kg}`}</span>
            <span
              style={{
                fontSize: 12,
                color: "#6b7280",
                fontWeight: 400,
                marginLeft: 1,
              }}
            >
              （10kg）
            </span>
          </span>
          {farm.pickupTime && (
            <span
              style={{
                fontSize: 12,
                color: "#6b7280",
                fontWeight: 400,
              }}
            >
              次回受取日 {farm.pickupTime}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

// ====== Page ======
export default function FarmsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMapOpen = searchParams.get("map") === "1";

  useEffect(() => {
    if (!isMapOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const next = new URLSearchParams(searchParams);
        next.delete("map");
        setSearchParams(next, { replace: false });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMapOpen, searchParams, setSearchParams]);

  const [farms, setFarms] = useState<FarmCardData[] | null>(null);

  // ★ Map 用に PublicFarmCardDTO も保持
  const [publicFarms, setPublicFarms] = useState<PublicFarmCardDTO[]>([]);
  const [noFarmsWithin100km, setNoFarmsWithin100km] = useState(false);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ---- 無限スクロール用 state ----
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // ★ 現在地（取得できない場合は null）
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // ★ 最後に confirmed した農家ID
  const [lastConfirmedFarmId, setLastConfirmedFarmId] = useState<number | null>(
    null
  );

  // ---- Geolocation で現在地を取得 ----
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        console.warn("[FarmsListPage] geolocation failed:", err);
        // 失敗時は TOKUSHIMA_CENTER のまま
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 600000,
      }
    );
  }, []);

  // ---- 最後に confirmed した農家IDを取得 ----
  useEffect(() => {
    const fetchLastConfirmed = async () => {
      try {
        const res = await fetch(LAST_CONFIRMED_URL, {
          credentials: "include",
        });
        const ct = res.headers.get("content-type") || "";
        if (!res.ok || !ct.toLowerCase().includes("application/json")) {
          return;
        }
        const data = (await res.json()) as LastConfirmedFarmResponse;
        if (data && typeof data.farm_id === "number") {
          setLastConfirmedFarmId(data.farm_id);
        } else {
          setLastConfirmedFarmId(null);
        }
      } catch (err) {
        console.warn(
          "[FarmsListPage] fetch last-confirmed-farm failed:",
          (err as any)?.message || err
        );
      }
    };

    fetchLastConfirmed();
  }, []);

  // ---- 距離順ソートヘルパ（FarmCardData 用）----
  const sortFarmCardsByDistance = useCallback(
    (items: FarmCardData[]): FarmCardData[] => {
      if (!userLocation) return items;
      return [...items].sort((a, b) => {
        if (a.lat == null || a.lng == null) return 1;
        if (b.lat == null || b.lng == null) return -1;
        const da = distanceMeters(userLocation, { lat: a.lat, lng: a.lng });
        const db = distanceMeters(userLocation, { lat: b.lat, lng: b.lng });
        return da - db;
      });
    },
    [userLocation]
  );

  // ---- 距離順ソートヘルパ（PublicFarmCardDTO 用・Map 用）----
  const sortPublicFarmsByDistance = useCallback(
    (items: PublicFarmCardDTO[]): PublicFarmCardDTO[] => {
      if (!userLocation) return items;
      return [...items].sort((a, b) => {
        if (a.pickup_lat == null || a.pickup_lng == null) return 1;
        if (b.pickup_lat == null || b.pickup_lng == null) return -1;
        const da = distanceMeters(userLocation, {
          lat: a.pickup_lat,
          lng: a.pickup_lng,
        });
        const db = distanceMeters(userLocation, {
          lat: b.pickup_lat,
          lng: b.pickup_lng,
        });
        return da - db;
      });
    },
    [userLocation]
  );

  // ---- ページ取得関数（初回 & 追加読み込み両方）----
  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      // append=true のときは「下で追加ロード中」だけ出す
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setErrorMsg(null);
      }

      try {
        const res = await fetch(`${LIST_URL}?page=${page}`, {
          credentials: "include",
        });

        const ct = res.headers.get("content-type") || "";
        if (!res.ok || !ct.toLowerCase().includes("application/json")) {
          throw new Error(`Bad response: ${res.status} ${ct}`);
        }

        const data = (await res.json()) as PublicFarmListResponse;

        if (!data.ok || !Array.isArray(data.farms)) {
          throw new Error("Invalid response body");
        }

        // Map 用
        if (append) {
          setPublicFarms((prev) =>
            sortPublicFarmsByDistance([...prev, ...data.farms])
          );
        } else {
          setPublicFarms(sortPublicFarmsByDistance(data.farms));
        }
        setNoFarmsWithin100km(!!data.no_farms_within_100km);

        // 一覧カード用に整形
        const mapped: FarmCardData[] = data.farms.map((f) => ({
          id: f.farm_id,
          name: f.owner_label,
          price10kg: Number(f.price_10kg || 0),
          avatarUrl: f.face_image_url || "https://placehold.co/80x80?text=F",
          images:
            f.pr_images && f.pr_images.length > 0
              ? f.pr_images.slice(0, 6)
              : ["https://placehold.co/1500x1000?text=No+Image"],
          title: f.pr_title || "",
          addressLabel: f.owner_address_label || "",
          pickupTime: f.next_pickup_display || "",
          lat:
            typeof f.pickup_lat === "number"
              ? f.pickup_lat
              : Number.isFinite(f.pickup_lat)
              ? Number(f.pickup_lat)
              : null,
          lng:
            typeof f.pickup_lng === "number"
              ? f.pickup_lng
              : Number.isFinite(f.pickup_lng)
              ? Number(f.pickup_lng)
              : null,
        }));

        if (append) {
          setFarms((prev) => {
            const base = prev || [];
            return sortFarmCardsByDistance([...base, ...mapped]);
          });
        } else {
          setFarms(sortFarmCardsByDistance(mapped));
        }

        setHasNext(!!data.has_next);
        setCurrentPage(data.page || page);
      } catch (e: any) {
        console.warn("[FarmsListPage] fetch failed:", e?.message || e);
        setErrorMsg("現在はバックエンドに接続できません。");
        if (!append) {
          // 初回だけは空配列でリセット
          setFarms([]);
          setPublicFarms([]);
          setNoFarmsWithin100km(false);
          setHasNext(false);
        }
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [sortFarmCardsByDistance, sortPublicFarmsByDistance]
  );

  // ---- 初回 page=1 ロード ----
  useEffect(() => {
    fetchPage(1, false);
  }, [fetchPage]);

  // ---- 無限スクロール（画面下付近で次ページをロード）----
  useEffect(() => {
    const handleScroll = () => {
      if (loading || loadingMore || !hasNext) return;

      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.body.offsetHeight - 300; // 下から300px以内

      if (scrollPosition >= threshold) {
        fetchPage(currentPage + 1, true);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loading, loadingMore, hasNext, currentPage, fetchPage]);

  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    loadFavoriteIds()
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === FAVORITES_KEY) setFavoriteIds(loadFavoriteIds());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggleFav = (id: number, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setFavoriteIds((prev) => {
      const sid = String(id);
      const next = prev.includes(sid)
        ? prev.filter((x) => x !== sid)
        : [...prev, sid];
      saveFavoriteIds(next);
      return next;
    });
  };

  const pageStyle = {
    padding: 16,
    maxWidth: 960,
    margin: "0 auto",
    background: "#fafafa",
  } as const;

  const cardHover = {
    boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
    transform: "translateY(-2px)",
  } as const;

  const toggleMap = () => {
    const next = new URLSearchParams(searchParams);
    if (isMapOpen) next.delete("map");
    else next.set("map", "1");
    setSearchParams(next, { replace: false });
  };

  const closeMap = () => {
    if (!isMapOpen) return;
    const next = new URLSearchParams(searchParams);
    next.delete("map");
    setSearchParams(next, { replace: false });
  };

  // ★ Map の初期中心：現在地があればそこ、なければ徳島市役所
  const effectiveMapCenter = userLocation ?? TOKUSHIMA_CENTER;

  // ★ 「前回予約した農家」表示用：farms から対象を抽出
  const featuredFarm: FarmCardData | null =
    lastConfirmedFarmId != null && farms
      ? farms.find((f) => f.id === lastConfirmedFarmId) || null
      : null;

  const otherFarms: FarmCardData[] = featuredFarm && farms
    ? farms.filter((f) => f.id !== featuredFarm.id)
    : farms || [];

  return (
    <section style={pageStyle}>
      <header style={{ marginBottom: 12, textAlign: "center" }}>
        <h1
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#111827",
            lineHeight: 1.25,
            margin: 0,
          }}
        >
          徳島の農家一覧
        </h1>
        <p
          style={{
            marginTop: 8,
            fontSize: 14,
            color: "#6b7280",
            lineHeight: 1.5,
          }}
        >
          近くの農家さんから直接お米を購入できます
        </p>
      </header>

      {errorMsg && (
        <div
          style={{
            textAlign: "center",
            color: "#b45309",
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          {errorMsg}
        </div>
      )}

      {loading && (
        <div
          style={{
            textAlign: "center",
            padding: "24px 0",
            color: "#6b7280",
          }}
        >
          読み込み中...
        </div>
      )}

      {!loading && farms && farms.length > 0 && (
        <>
          {/* ★ 前回予約した農家ブロック */}
          {featuredFarm && (
  <div
    style={{
      marginBottom: 20, // すこし余白だけ
    }}
  >
    {/* ConfirmPage のタグとトーンを揃えたピル型ラベル */}
    <div style={{ marginBottom: 8 }}>
      <span
        style={{
          display: "inline-block",
          padding: "2px 10px",
          borderRadius: 9999,
          background: "rgba(31,122,54,0.08)", // 薄いグリーン
          color: "#1f7a36",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        前回予約した農家
      </span>
    </div>

    <Link
      to={`/farms/${featuredFarm.id}`}
      style={{ textDecoration: "none", color: "inherit" }}
      onMouseEnter={(e) =>
        Object.assign(
          (e.currentTarget.firstChild as HTMLElement).style,
          cardHover
        )
      }
      onMouseLeave={(e) => {
        const el = e.currentTarget.firstChild as HTMLElement;
        el.style.boxShadow = "none";
        el.style.transform = "none";
      }}
    >
      <FarmCard
        farm={featuredFarm}
        isFav={favoriteIds.includes(String(featuredFarm.id))}
        toggleFav={toggleFav}
      />
    </Link>
  </div>
)}


          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 16,
            }}
          >
            {otherFarms.map((f) => {
              const isFav = favoriteIds.includes(String(f.id));
              return (
                <Link
                  key={f.id}
                  to={`/farms/${f.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                  onMouseEnter={(e) =>
                    Object.assign(
                      (e.currentTarget.firstChild as HTMLElement).style,
                      cardHover
                    )
                  }
                  onMouseLeave={(e) => {
                    const el = e.currentTarget.firstChild as HTMLElement;
                    el.style.boxShadow = "none";
                    el.style.transform = "none";
                  }}
                >
                  <FarmCard farm={f} isFav={isFav} toggleFav={toggleFav} />
                </Link>
              );
            })}
          </div>

          {/* 追加読み込みインジケータ（無限スクロール用） */}
          {loadingMore && (
            <div
              style={{
                textAlign: "center",
                padding: "12px 0 0",
                color: "#6b7280",
                fontSize: 12,
              }}
            >
              追加読み込み中...
            </div>
          )}
        </>
      )}

      {!loading && farms && farms.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "24px 0",
            color: "#6b7280",
          }}
        >
          公開中の農家が見つかりません。
        </div>
      )}

      <footer
        style={{
          marginTop: 20,
          textAlign: "center",
          color: "#6b7280",
          fontSize: 12,
        }}
      >
        © 2025 米直売@徳島
      </footer>

      <button
        type="button"
        onClick={toggleMap}
        aria-expanded={isMapOpen}
        aria-label={isMapOpen ? "地図を閉じる" : "地図を表示"}
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: "calc(56px + env(safe-area-inset-bottom))",
          zIndex: 70,
          padding: "12px 18px",
          borderRadius: 9999,
          border: "1px solid rgba(0,0,0,0.2)",
          background: "#000000",
          color: "#ffffff",
          boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        {isMapOpen ? "地図を閉じる（Esc）" : "地図を表示"}
      </button>

      <MapLayerPortal
        open={isMapOpen}
        onRequestClose={closeMap}
        farms={publicFarms}
        mapCenter={effectiveMapCenter}
        noFarmsWithin100km={noFarmsWithin100km}
      />
    </section>
  );
}
