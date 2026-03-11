import React, { useEffect, useMemo, useRef, useState, memo, useCallback } from "react";
import { GoogleMap, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import debounce from "lodash/debounce";
import { API_BASE } from "@/config/api";
import { jitterLatLng } from "./mapJitter";

import type { components as PublicFarmsComponents } from "@/api/generated/public-farms";
type PublicFarmCardDTO = PublicFarmsComponents["schemas"]["PublicFarmCardDTO"];

type Props = {
  center: { lat: number; lng: number };
  selectedId: number | null;
  onSelectFarm: (id: number) => void;
  hoveredId: number | null;
  onHoverChange: (id: number | null) => void;
  onMapClick?: () => void;
  onFarmsChange?: (farms: PublicFarmCardDTO[]) => void;
};

// ============================================================
// ★ 追加：マーカーのスタイル定義を外に出す（再生成を防ぐため）
// ============================================================
const bubbleBase: React.CSSProperties = {
  transform: "translate(-50%,-50%)",
  padding: "6px 10px",
  borderRadius: 9999,
  border: "1px solid rgba(0,0,0,0.08)",
  fontWeight: 700,
  fontSize: 13,
  whiteSpace: "nowrap",
  cursor: "pointer",
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

const bubbleHovered: React.CSSProperties = {
  ...bubbleBase,
  transform: "translate(-50%,-50%) scale(1.18)",
};

// ============================================================
// ★ 追加：マーカーコンポーネントの分離とメモ化
// React.memoにより、isActiveやisHoveredが変わらない限り再描画されない
// ============================================================
type MarkerProps = {
  farm: PublicFarmCardDTO;
  isActive: boolean;
  isHovered: boolean;
  onHoverEnter: (id: number) => void;
  onHoverLeave: () => void;
  onClick: (id: number) => void;
};

const FarmMarker = memo(({ farm, isActive, isHovered, onHoverEnter, onHoverLeave, onClick }: MarkerProps) => {
  // jitterLatLngの計算もこの中で1回だけ行うように最適化
  const pos = useMemo(() => jitterLatLng(farm.pickup_lat, farm.pickup_lng, farm.farm_id), [farm.pickup_lat, farm.pickup_lng, farm.farm_id]);

  return (
    <OverlayView position={pos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
      <button
        type="button"
        aria-selected={isActive}
        style={isActive ? bubbleActive : isHovered ? bubbleHovered : bubbleBase}
        onMouseEnter={() => onHoverEnter(farm.farm_id)}
        onMouseLeave={onHoverLeave}
        onClick={(e) => {
          e.stopPropagation();
          onClick(farm.farm_id);
        }}
      >
        ¥{farm.price_10kg.toLocaleString()}
      </button>
    </OverlayView>
  );
});

// ============================================================
// 本体
// ============================================================
export default function MapCanvas({
  center,
  selectedId,
  onSelectFarm,
  hoveredId,
  onHoverChange,
  onMapClick,
  onFarmsChange,
}: Props) {
  const [mapFarms, setMapFarms] = useState<PublicFarmCardDTO[]>([]);
  const mapRef = useRef<google.maps.Map | null>(null);
  const lastBoundsRef = useRef<google.maps.LatLngBounds | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: "rice-app-map",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    language: "ja",
    region: "JP",
  });

  const fetchMapFarms = async (bounds: google.maps.LatLngBounds) => {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const url = `${API_BASE}/api/public/farms/map?min_lat=${sw.lat()}&max_lat=${ne.lat()}&min_lng=${sw.lng()}&max_lng=${ne.lng()}&limit=200`;

    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const data = (await res.json()) as PublicFarmCardDTO[];
      setMapFarms(data);
      onFarmsChange?.(data);
    } catch (err) {
      console.error("map fetch error:", err);
    }
  };

  const debouncedFetch = useMemo(
    () =>
      debounce((bounds: google.maps.LatLngBounds) => {
        fetchMapFarms(bounds);
      }, 400),
    []
  );

  const hasBoundsMovedEnough = (prev: google.maps.LatLngBounds, next: google.maps.LatLngBounds) => {
    const p = prev.getCenter();
    const n = next.getCenter();
    const dLat = Math.abs(p.lat() - n.lat());
    const dLng = Math.abs(p.lng() - n.lng());
    return dLat > 0.01 || dLng > 0.01;
  };

  const handleMapIdle = () => {
    if (!mapRef.current) return;
    const bounds = mapRef.current.getBounds();
    if (!bounds) return;

    const last = lastBoundsRef.current;
    if (last && !hasBoundsMovedEnough(last, bounds)) return;

    lastBoundsRef.current = bounds;
    debouncedFetch(bounds);
  };

  const containerStyle: React.CSSProperties = { position: "absolute", inset: 0 };

  const softStyle: google.maps.MapTypeStyle[] = [
    { elementType: "geometry", stylers: [{ saturation: -45 }, { lightness: 30 }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { featureType: "poi.business", stylers: [{ visibility: "simplified" }] },
    { featureType: "road", elementType: "labels", stylers: [{ visibility: "simplified" }] },
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

  // ★ 追加：子コンポーネントに渡すコールバックを安定させる
  const handleHoverEnter = useCallback((id: number) => onHoverChange(id), [onHoverChange]);
  const handleHoverLeave = useCallback(() => onHoverChange(null), [onHoverChange]);
  const handleClick = useCallback((id: number) => onSelectFarm(id), [onSelectFarm]);

  if (!isLoaded) return null;

  return (
    <GoogleMap
      center={center}
      zoom={12}
      mapContainerStyle={containerStyle}
      options={mapOptions}
      onLoad={(map) => {
        mapRef.current = map;
        const b = map.getBounds();
        if (b) {
          lastBoundsRef.current = b;
          fetchMapFarms(b);
        }
      }}
      onIdle={handleMapIdle}
      onClick={() => onMapClick?.()}
    >
      {mapFarms.map((f) => (
        <FarmMarker
          key={f.farm_id}
          farm={f}
          isActive={selectedId === f.farm_id}
          isHovered={hoveredId === f.farm_id}
          onHoverEnter={handleHoverEnter}
          onHoverLeave={handleHoverLeave}
          onClick={handleClick}
        />
      ))}
    </GoogleMap>
  );
}