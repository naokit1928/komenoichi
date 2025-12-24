// src/pages/FarmsListPage.tsx
import React, { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import MapLayerPortal from "./MapLayerPortal";
import { FarmCard, type FarmCardData } from "./components/FarmCard";
import { useFarmsListPage } from "./hooks/useFarmsListPage";


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
