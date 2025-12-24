import React, { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import debounce from "lodash/debounce";
import { API_BASE } from "@/config/api";
import { jitterLatLng } from "./mapJitter";

/* ======================================================
   generated DTO を唯一の正として参照
   ====================================================== */
import type {
  components as PublicFarmsComponents,
} from "@/api/generated/public-farms";

type PublicFarmCardDTO =
  PublicFarmsComponents["schemas"]["PublicFarmCardDTO"];

/* ====================================================== */

type Props = {
  center: { lat: number; lng: number };
  selectedId: number | null;
  onSelectFarm: (id: number) => void;
  hoveredId: number | null;
  onHoverChange: (id: number | null) => void;
  onMapClick?: () => void;

  // 親に farms を渡す（MapLayerPortal 用）
  onFarmsChange?: (farms: PublicFarmCardDTO[]) => void;
};

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

  const hasBoundsMovedEnough = (
    prev: google.maps.LatLngBounds,
    next: google.maps.LatLngBounds
  ) => {
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

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
  };

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
      onClick={() => {
        onMapClick?.();
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
              aria-selected={active}
              style={
                active
                  ? bubbleActive
                  : hovered
                  ? { ...bubbleBase, transform: "translate(-50%,-50%) scale(1.18)" }
                  : bubbleBase
              }
              onMouseEnter={() => onHoverChange(f.farm_id)}
              onMouseLeave={() => onHoverChange(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectFarm(f.farm_id);
              }}
            >
              ¥{f.price_10kg.toLocaleString()}
            </button>
          </OverlayView>
        );
      })}
    </GoogleMap>
  );
}
