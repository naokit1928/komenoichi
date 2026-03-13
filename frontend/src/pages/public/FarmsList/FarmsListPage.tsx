import React, { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom"; // ★ useNavigate を追加
import MapLayerPortal from "./MapLayerPortal";
import { FarmCard, type FarmCardData } from "./components/FarmCard";
import { useFarmsListPage } from "./hooks/useFarmsListPage";

import { PublicPageHeader } from "@/components/PublicPageHeader";
import { PublicBottomBar } from "@/components/PublicBottomBar";
import Footer from "@/components/Footer";
import { API_BASE } from "@/config/api";

// ── Brand tokens ──────────────────────────────────
const C = {
  red:       "#C62828",
  ink2:      "#4b3e2a", // 濃い茶色（ラベルテキスト用）
  ink3:      "#7a6c58", // 薄い茶色（区切り線用）
  border:    "#e8e2d8", // 枠線用
  bgPale:    "#f4f1ed", // 薄い茶系の背景（当日現地払いと同じ色）
} as const;

// ── Sub-components ────────────────────────────────

/** 「前回予約した農家」などのセクションラベル */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 12px 3px 8px",
        borderRadius: 9999,
        background: C.bgPale,            // 当日現地払いと同じ背景色
        border: `1px solid ${C.border}`, // 当日現地払いと同じ枠線
        fontSize: 11,
        fontWeight: 600,                 // 700から600へ調整
        color: C.ink2,                   // 当日現地払いと同じ濃い茶色
        letterSpacing: "0.04em",
        marginBottom: 10,
      }}
    >
      {/* Dot (テキストと同じ濃い茶色で統一) */}
      <span
        style={{
          display: "block",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: C.ink2,
          flexShrink: 0,
        }}
      />
      {children}
    </div>
  );
}

/** セクション間の区切り線 */
function Divider({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        margin: "24px 0 16px",
        fontSize: 11,
        color: C.ink3,
        letterSpacing: "0.12em",
      }}
    >
      <span style={{ flex: 1, height: 1, background: C.border, display: "block" }} />
      {label}
      <span style={{ flex: 1, height: 1, background: C.border, display: "block" }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────
export default function FarmsListPage() {
  const navigate = useNavigate(); // ★ 追加
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
    observerTarget,
  } = useFarmsListPage();

  const [consumerEmail, setConsumerEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/consumers/identity`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.is_logged_in && d.email) setConsumerEmail(d.email);
      })
      .catch(() => {});
  }, []);

  // Map open/close
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

  // ★ 修正: DB連動型の Favorites
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  
  // 初回表示時にAPIからお気に入りを取得
  useEffect(() => {
    if (consumerEmail) {
      fetch(`${API_BASE}/api/public/favorites`, { credentials: "include" })
        .then(r => r.ok ? r.json() : [])
        .then(ids => setFavoriteIds(ids.map(String)))
        .catch(() => {});
    } else {
      setFavoriteIds([]);
    }
  }, [consumerEmail]);

  const toggleFav = async (id: number, e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }

    // 未ログイン時はログインへ促す
    if (!consumerEmail) {
      navigate("/login-only?redirect=/farms");
      return;
    }

    const sid = String(id);
    const isFav = favoriteIds.includes(sid);

    // 快適な操作感のために、UIを即座に更新する（楽観的UI更新）
    setFavoriteIds((prev) => isFav ? prev.filter((x) => x !== sid) : [...prev, sid]);

    try {
      const method = isFav ? "DELETE" : "POST";
      const res = await fetch(`${API_BASE}/api/public/favorites/${id}`, {
        method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("API Error");
    } catch (err) {
      // 失敗したらUIを元の状態に戻す
      setFavoriteIds((prev) => isFav ? [...prev, sid] : prev.filter((x) => x !== sid));
    }
  };

  const featuredFarm: FarmCardData | null =
    lastConfirmedFarmId != null && farms
      ? farms.find((f) => f.id === lastConfirmedFarmId) || null
      : null;

  const otherFarms: FarmCardData[] =
    featuredFarm && farms
      ? farms.filter((f) => f.id !== featuredFarm.id)
      : farms || [];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        backgroundColor: "#fdfcfa",
      }}
    >
      <div style={{ flexGrow: 1 }}>

        {/* Header */}
        <PublicPageHeader title="農家一覧" />

        <section
          style={{
            padding: "20px 16px 16px",
            maxWidth: 540,
            margin: "0 auto",
          }}
        >
          {/* Error */}
          {errorMsg && (
            <div
              style={{
                textAlign: "center",
                color: C.red,
                marginBottom: 12,
                fontSize: 13,
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div
              style={{
                textAlign: "center",
                padding: "40px 0",
                color: C.ink3,
                fontSize: 14,
              }}
            >
              読み込み中...
            </div>
          )}

          {!loading && farms && farms.length > 0 && (
            <>
              {/* ── Featured card ── */}
              {featuredFarm && (
                <div style={{ marginBottom: 24 }}>
                  <SectionLabel>前回予約した農家</SectionLabel>

                  <Link
                    to={`/farms/${featuredFarm.id}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    {/* カード自体の赤い枠線・影も、茶系の優しいトーンに変更 */}
                    <div
                      style={{
                        borderRadius: 14,
                        border: `1.5px solid ${C.border}`,
                        boxShadow: `0 4px 16px rgba(122,108,88,0.12)`, 
                        overflow: "hidden",
                      }}
                    >
                      <FarmCard
                        farm={featuredFarm}
                        isFav={favoriteIds.includes(String(featuredFarm.id))}
                        toggleFav={toggleFav}
                      />
                    </div>
                  </Link>
                </div>
              )}

              {/* ── Divider ── */}
              {featuredFarm && otherFarms.length > 0 && (
                <Divider label="ほかの農家" />
              )}

              {/* ── Card grid ── */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
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

              {/* Loading more */}
              {loadingMore && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "12px 0 0",
                    color: C.ink3,
                    fontSize: 12,
                  }}
                >
                  追加読み込み中...
                </div>
              )}

              <div ref={observerTarget} style={{ height: 1, width: "100%" }} />
            </>
          )}

          {!loading && farms && farms.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "48px 0",
                color: C.ink3,
                fontSize: 14,
                lineHeight: 1.8,
              }}
            >
              公開中の農家が見つかりません。
            </div>
          )}

          {/* ── Map FAB ── */}
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
              // ★ 83vh から変更：画面の真の高さから140pxと安全領域を引く
              top: isMapOpen ? "calc(100dvh - 140px - env(safe-area-inset-bottom))" : "auto",
              bottom: isMapOpen
                ? "auto"
                : "calc(72px + env(safe-area-inset-bottom))",
              transform: isMapOpen
                ? "translate(-50%, -50%)"
                : "translateX(-50%)",
              zIndex: 70,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "13px 22px",
              borderRadius: 9999,
              border: "none",
              background: isMapOpen ? "#111827" : C.red,
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
              letterSpacing: "0.04em",
              cursor: "pointer",
              boxShadow: isMapOpen
                ? "0 8px 28px rgba(0,0,0,0.25)"
                : "0 8px 28px rgba(168,48,32,0.35), 0 2px 8px rgba(168,48,32,0.2)",
              whiteSpace: "nowrap",
              transition: "background 150ms, box-shadow 150ms",
            }}
          >
            {/* Map icon */}
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              <line x1="9" y1="3" x2="9" y2="18" />
              <line x1="15" y1="6" x2="15" y2="21" />
            </svg>
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
      </div>

      <Footer />
      <PublicBottomBar consumerEmail={consumerEmail} />
    </div>
  );
}