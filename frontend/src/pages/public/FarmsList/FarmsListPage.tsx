import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import MapLayerPortal from "./MapLayerPortal";
import { FarmCard, type FarmCardData } from "./components/FarmCard";
import { useFarmsListPage } from "./hooks/useFarmsListPage";

/* ★ ヘッダー */
import { FarmsListHeader as PublicPageHeader } from "@/components/PublicPageHeader";
import SimplePageHeader from "@/components/SimplePageHeader";

/* ★ identity 取得用 */
import { API_BASE } from "@/config/api";

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
  } catch {}
}

// ====== Page ======
export default function FarmsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMapOpen = searchParams.get("map") === "1";

  const {
    farms,
    publicFarms,
    noFarmsWithin100km,
    loading,
    loadingMore,
    errorMsg,
    lastConfirmedFarmId,
    effectiveMapCenter,
  } = useFarmsListPage();

  /* ★ consumer email（ログイン判定） */
  const [consumerEmail, setConsumerEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/consumers/identity`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.is_logged_in && d.email) {
          setConsumerEmail(d.email);
        }
      })
      .catch(() => {});
  }, []);

  // ===== map open/close =====
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

  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    loadFavoriteIds()
  );

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

  const featuredFarm: FarmCardData | null =
    lastConfirmedFarmId != null && farms
      ? farms.find((f) => f.id === lastConfirmedFarmId) || null
      : null;

  const otherFarms: FarmCardData[] =
    featuredFarm && farms
      ? farms.filter((f) => f.id !== featuredFarm.id)
      : farms || [];

  const pageStyle = {
    padding: 16,
    maxWidth: 960,
    margin: "0 auto",
    background: "#fafafa",
  } as const;

  return (
    <>
      {/* ===== ヘッダー ===== */}
      {consumerEmail ? (
        <PublicPageHeader title={null} consumerEmail={consumerEmail} />
      ) : (
        <SimplePageHeader title="近くの農家を探す" />
      )}

      <section style={pageStyle}>
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
            {featuredFarm && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ marginBottom: 8 }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 10px",
                      borderRadius: 9999,
                      background: "rgba(31,122,54,0.08)",
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
              {otherFarms.map((f) => (
                <Link
                  key={f.id}
                  to={`/farms/${f.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <FarmCard
                    farm={f}
                    isFav={favoriteIds.includes(String(f.id))}
                    toggleFav={toggleFav}
                  />
                </Link>
              ))}
            </div>

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

        <button
          type="button"
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            if (isMapOpen) next.delete("map");
            else next.set("map", "1");
            setSearchParams(next, { replace: false });
          }}
          aria-expanded={isMapOpen}
          aria-label={isMapOpen ? "地図を閉じる" : "地図を表示"}
          style={{
            position: "fixed",
            left: "50%",
            top: isMapOpen ? "83vh" : "auto",
            bottom: isMapOpen
              ? "auto"
              : "calc(56px + env(safe-area-inset-bottom))",
            transform: isMapOpen
              ? "translate(-50%, -50%)"
              : "translateX(-50%)",
            zIndex: 70,
            padding: "12px 18px",
            borderRadius: 9999,
            border: "1px solid rgba(0,0,0,0.2)",
            background: "#000000",
            color: "#ffffff",
            boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
            fontWeight: 700,
            fontSize: 14,
            whiteSpace: "nowrap",
          }}
        >
          {isMapOpen ? "地図を閉じる（Esc）" : "地図を表示"}
        </button>

        <MapLayerPortal
          open={isMapOpen}
          onRequestClose={() => {
            const next = new URLSearchParams(searchParams);
            next.delete("map");
            setSearchParams(next, { replace: false });
          }}
          farms={publicFarms}
          mapCenter={effectiveMapCenter}
          noFarmsWithin100km={noFarmsWithin100km}
        />
      </section>
    </>
  );
}
