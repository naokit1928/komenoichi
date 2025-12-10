import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GoogleMap, useJsApiLoader, OverlayView } from "@react-google-maps/api";
import debounce from "lodash/debounce";

// ====== V2 DTO ======
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

type Props = {
  open: boolean;
  onRequestClose: () => void;
  farms?: PublicFarmCardDTO[];
  mapCenter?: { lat: number; lng: number };
  noFarmsWithin100km?: boolean;
};

type SheetState = "closed" | "half" | "full";

// ジッター計算
function seededRandom01(seed: number) {
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return ((x >>> 0) % 100000) / 100000;
}
function metersToLatLngDelta(lat: number, dxMeters: number, dyMeters: number) {
  const oneDegLatMeters = 111_320;
  const oneDegLngMeters = 111_320 * Math.cos((lat * Math.PI) / 180);
  const dLat = dyMeters / oneDegLatMeters;
  const dLng = dxMeters / oneDegLngMeters;
  return { dLat, dLng };
}
function jitterLatLng(lat: number, lng: number, id: number) {
  const r = 20 + seededRandom01(id * 97 + 13) * 10;
  const ang = seededRandom01(id * 131 + 7) * Math.PI * 2;
  const dx = Math.cos(ang) * r;
  const dy = Math.sin(ang) * r;
  const { dLat, dLng } = metersToLatLngDelta(lat, dx, dy);
  return { lat: lat + dLat, lng: lng + dLng };
}

const DEFAULT_CENTER = { lat: 34.0703, lng: 134.5548 };

export default function MapLayerPortal({
  open,
  onRequestClose,
  farms,
  mapCenter,
  noFarmsWithin100km,
}: Props) {
  const safeFarms = Array.isArray(farms) ? farms : [];
  const center = mapCenter ?? DEFAULT_CENTER;

  // マップ専用データ（Airbnb方式）
  const [mapFarms, setMapFarms] = useState<PublicFarmCardDTO[]>([]);
  const mapRef = useRef<google.maps.Map | null>(null);

  // ホバー中のピン
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // 前回の bounds（移動量しきい値チェック用）
  const lastBoundsRef = useRef<google.maps.LatLngBounds | null>(null);

  const fetchMapFarms = async (bounds: google.maps.LatLngBounds) => {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    const url = `/api/public/farms/map?min_lat=${sw.lat()}&max_lat=${ne.lat()}&min_lng=${sw.lng()}&max_lng=${ne.lng()}&limit=200`;

    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMapFarms(data);
      }
    } catch (err) {
      console.error("map fetch error:", err);
    }
  };

  // ★ デバウンス版 fetch
  const debouncedFetch = useMemo(
    () =>
      debounce((bounds: google.maps.LatLngBounds) => {
        fetchMapFarms(bounds);
      }, 400), // ← API 呼びすぎ防止
    []
  );

  // bounds がどれくらい動いたか判定（緯度経度の中心差を簡易比較）
  const hasBoundsMovedEnough = (
    prev: google.maps.LatLngBounds,
    next: google.maps.LatLngBounds
  ) => {
    const prevCenter = prev.getCenter();
    const nextCenter = next.getCenter();
    const dLat = Math.abs(prevCenter.lat() - nextCenter.lat());
    const dLng = Math.abs(prevCenter.lng() - nextCenter.lng());

    // 例: 0.01度 ≒ 1km 弱 （緯度方向）
    // 小さなパンやズームでは再ロードしない
    return dLat > 0.01 || dLng > 0.01;
  };

  // Portal
  const rootRef = useRef<HTMLDivElement | null>(null);
  if (!rootRef.current) {
    const el = document.createElement("div");
    el.style.zIndex = "60";
    rootRef.current = el;
  }
  useEffect(() => {
    const el = rootRef.current!;
    document.body.appendChild(el);
    return () => el.parentNode?.removeChild(el);
  }, []);

  // URL sel
  const parseSelFromURL = (): number | null => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("sel");
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const [selectedId, setSelectedId] = useState<number | null>(() =>
    open ? parseSelFromURL() : null
  );

  useEffect(() => {
    if (open) setSelectedId(parseSelFromURL());
    else setSelectedId(null);
  }, [open]);

  // onPopState
  useEffect(() => {
    const onPop = () => {
      if (open) setSelectedId(parseSelFromURL());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open]);

  const selected = useMemo(
    () => mapFarms.find((f) => f.farm_id === selectedId) || null,
    [mapFarms, selectedId]
  );

  // Bottom Sheet
  const PANEL_VH = 0.88;
  const HALF_H = 140;

  const [panelH, setPanelH] = useState(() =>
    Math.round(window.innerHeight * PANEL_VH)
  );
  useEffect(() => {
    const onResize = () =>
      setPanelH(Math.round(window.innerHeight * PANEL_VH));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const CLOSE_THRESHOLD = 100;
  const [sheetH, setSheetH] = useState<number>(HALF_H);
  const [sheetState, setSheetState] = useState<SheetState>("closed");
  const [dragging, setDragging] = useState(false);

  const dragStartY = useRef(0);
  const dragStartH = useRef(0);

  useEffect(() => {
    if (selected) {
      setSheetState("half");
      setSheetH(HALF_H);
    } else {
      setSheetState("closed");
      setSheetH(HALF_H);
    }
  }, [selected]);

  const beginDrag = (y: number) => {
    setDragging(true);
    dragStartY.current = y;
    dragStartH.current = sheetH;
  };
  const updateDrag = (y: number) => {
    if (!dragging) return;
    const dy = y - dragStartY.current;
    if (dy < 0) {
      setSheetH(dragStartH.current);
      return;
    }
    const next = Math.max(
      0,
      Math.min(dragStartH.current, dragStartH.current - dy)
    );
    setSheetH(next);
  };
  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    if (sheetH < CLOSE_THRESHOLD) {
      clearSelection();
      return;
    }
    setSheetH(HALF_H);
    setSheetState("half");
  };

  // Style
  const backdropStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    transition: "opacity 220ms ease",
    opacity: open ? 1 : 0,
    pointerEvents: open ? "auto" : "none",
  };
  const panelStyle: React.CSSProperties = {
    position: "fixed",
    left: 0,
    top: 0,
    width: "100%",
    height: "88vh",
    background: "#fff",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
    transform: open ? "translateY(0)" : "translateY(-100%)",
    transition: "transform 260ms ease",
    overflow: "hidden",
    pointerEvents: open ? "auto" : "none",
  };

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
  };

  // Google Maps
  const { isLoaded } = useJsApiLoader({
    id: "rice-app-map",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    language: "ja",
    region: "JP",
  });

  const softStyle: google.maps.MapTypeStyle[] = [
    { elementType: "geometry", stylers: [{ saturation: -45 }, { lightness: 30 }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ visibility: "simplified" }],
    },
    { featureType: "poi.business", stylers: [{ visibility: "simplified" }] },
    {
      featureType: "road",
      elementType: "labels",
      stylers: [{ visibility: "simplified" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ saturation: -40 }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ saturation: -10 }, { lightness: 10 }],
    },
  ];

  const mapOptions: google.maps.MapOptions = {
    disableDefaultUI: true,
    clickableIcons: false,
    gestureHandling: "greedy",
    zoomControl: true,
    minZoom: 9,
    maxZoom: 18,
    styles: softStyle,
  };

  const bubbleBase: React.CSSProperties = {
    transform: "translate(-50%,-50%)",
    padding: "6px 10px",
    borderRadius: 9999,
    border: "1px solid rgba(0,0,0,0.08)",
    fontWeight: 700,
    fontSize: 13,
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition:
      "transform 120ms ease, background 120ms ease, color 120ms ease, boxShadow 120ms ease",
    boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
    background: "#fff",
    color: "#111827",
  };

  const bubbleActive: React.CSSProperties = {
    ...bubbleBase,
    background: "#111827",
    color: "#fff",
    boxShadow: "0 10px 22px rgba(0,0,0,0.28), 0 0 0 3px rgba(17,24,39,0.65)",
  };

  // 選択
  const selectFarm = (id: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("map", "1");
    params.set("sel", String(id));
    const url = new URL(window.location.href);
    url.search = params.toString();
    history.pushState({}, "", url.toString());
    setSelectedId(id);
    setSheetState("half");
    setSheetH(HALF_H);
  };

  const clearSelection = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("sel");
    const url = new URL(window.location.href);
    url.search = params.toString();
    history.pushState({}, "", url.toString());
    setSelectedId(null);
    setSheetState("closed");
    setSheetH(HALF_H);
  };

  // ★ Map Idle → Debounced fetch + 移動量しきい値
  const handleMapIdle = () => {
    if (!mapRef.current) return;
    const bounds = mapRef.current.getBounds();
    if (!bounds) return;

    const last = lastBoundsRef.current;
    if (last && !hasBoundsMovedEnough(last, bounds)) {
      // ほとんど動いていない → API 呼ばない
      return;
    }

    lastBoundsRef.current = bounds;
    debouncedFetch(bounds);
  };

  // -------------------------
  // 地図＋ピン描画
  // -------------------------
  const tree = (
    <>
      <div style={backdropStyle} onClick={onRequestClose} />

      <section role="dialog" aria-modal={open} style={panelStyle}>
        {isLoaded && (
          <GoogleMap
            center={center}
            zoom={12}
            mapContainerStyle={containerStyle}
            options={mapOptions}
            onLoad={(map) => {
              mapRef.current = map;
              const b = map.getBounds();
              if (b) {
                // 初回ロードは必ず fetch
                lastBoundsRef.current = b;
                fetchMapFarms(b);
              }
            }}
            onIdle={handleMapIdle}
            onClick={() => {
              if (selected) clearSelection();
            }}
          >
            {mapFarms.map((f) => {
              const pos = jitterLatLng(f.pickup_lat, f.pickup_lng, f.farm_id);
              const active = selectedId === f.farm_id;
              const hovered = hoveredId === f.farm_id;

              return (
                <OverlayView
                  key={f.farm_id}
                  position={pos}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <button
                    type="button"
                    aria-label={f.owner_label}
                    aria-selected={active}
                    style={
                      active
                        ? bubbleActive
                        : hovered
                        ? {
                            ...bubbleBase,
                            transform:
                              "translate(-50%,-50%) scale(1.18)",
                          }
                        : bubbleBase
                    }
                    onMouseEnter={() => setHoveredId(f.farm_id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectFarm(f.farm_id);
                    }}
                  >
                    ¥{f.price_10kg.toLocaleString()}
                  </button>
                </OverlayView>
              );
            })}
          </GoogleMap>
        )}

        {/* ===== Bottom Sheet ===== */}
        {selected && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: "44px",
              pointerEvents: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                position: "relative",
                width: "calc(100% - 24px)",
                margin: "0 12px",
                background: "#fff",
                borderRadius: 20,
                boxShadow: "0 -12px 40px rgba(0,0,0,0.18)",
                transform: selected ? "translateY(0)" : "translateY(100%)",
                transition: dragging
                  ? "none"
                  : "transform 260ms ease, height 220ms ease",
                overflow: "hidden",
                display: "flex",
                flexDirection: "row",
                height: sheetH,
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                beginDrag(e.clientY);
                const onMove = (ev: MouseEvent) => updateDrag(ev.clientY);
                const onUp = () => {
                  endDrag();
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp, { once: true });
              }}
              onTouchStart={(e) => {
                const t = e.touches[0];
                if (!t) return;
                beginDrag(t.clientY);
              }}
              onTouchMove={(e) => {
                const t = e.touches[0];
                if (!t) return;
                e.preventDefault();
                updateDrag(t.clientY);
              }}
              onTouchEnd={() => endDrag()}
            >
              {/* ハンドル */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                  top: 6,
                  width: 36,
                  height: 4,
                  borderRadius: 9999,
                  background: "#E5E7EB",
                }}
              />

              {/* × 閉じる */}
              <button
                type="button"
                aria-label="close farm preview"
                onClick={(e) => {
                  e.stopPropagation();
                  clearSelection();
                }}
                style={{
                  position: "absolute",
                  left: 12,
                  top: 8,
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: "1px solid rgba(0,0,0,0.1)",
                  background: "#fff",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  zIndex: 10,
                }}
              >
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#111827",
                    lineHeight: 1,
                  }}
                >
                  ×
                </span>
              </button>

              {/* 左：PR画像 */}
              <div
                onMouseEnter={() => setHoveredId(selected.farm_id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ width: "33%", height: "100%", overflow: "hidden" }}
              >
                <img
                  src={selected.pr_images[0]}
                  alt={selected.owner_label}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>

              {/* 右：テキスト */}
              <a
                href={`/farms/${selected.farm_id}`}
                onMouseEnter={() => setHoveredId(selected.farm_id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ textDecoration: "none", color: "inherit", flex: 1 }}
              >
                <div
                  style={{
                    flex: 1,
                    padding: "20px 16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    minWidth: 0,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#111827",
                      marginBottom: 4,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {selected.pr_title || selected.owner_label}
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      color: "#374151",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {selected.owner_address_label}
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#111827",
                    }}
                  >
                    ¥{selected.price_10kg.toLocaleString()}（10kg）
                  </div>

                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 12,
                      color: "#6b7280",
                    }}
                  >
                    次回受取日 {selected.next_pickup_display}
                  </div>
                </div>
              </a>
            </div>
          </div>
        )}
      </section>
    </>
  );

  return createPortal(tree, rootRef.current!);
}
