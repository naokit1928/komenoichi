import React, { useMemo } from "react";
import { GoogleMap, useJsApiLoader, Circle, Marker } from "@react-google-maps/api";

/**
 * 詳細ページ用ソフトトーン地図
 * - 一覧(MapLayerPortal)のローダ設定と完全一致に統一（id, language, region）
 * - 店舗系POIをグレイ寄りにトーンダウン
 * - 米袋ピン任意、300m円は任意表示
 */

type Props = {
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  height?: number;             // px
  show300mCircle?: boolean;    // default false
  markerIconUrl?: string;      // 任意
  markerTitle?: string;        // 任意
};

export default function FarmDetailSoftMap({
  centerLat,
  centerLng,
  zoom = 15,
  height = 280,
  show300mCircle = false,
  markerIconUrl,
  markerTitle = "受け渡し予定地点",
}: Props) {
  const tokushimaDefault = useMemo(() => ({ lat: 34.0703, lng: 134.5548 }), []);
  const center = useMemo(() => {
    if (typeof centerLat === "number" && typeof centerLng === "number") {
      return { lat: centerLat, lng: centerLng };
    }
    return tokushimaDefault;
  }, [centerLat, centerLng, tokushimaDefault]);

  const containerStyle: React.CSSProperties = {
    width: "100%",
    height,
    borderRadius: 8,
    overflow: "hidden",
  };

  // ※ 一覧と同一設定に統一（これが肝）
  const { isLoaded } = useJsApiLoader({
    id: "rice-app-map",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    language: "ja",
    region: "JP",
  });

  // 一覧と同トーン + POIアイコンのグレイ化
  const softStyle: google.maps.MapTypeStyle[] = [
    { elementType: "geometry", stylers: [{ saturation: -45 }, { lightness: 30 }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },

    // アイコンの主張を抑える
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
    {
      featureType: "poi",
      elementType: "geometry",
      stylers: [{ saturation: -80 }, { lightness: 30 }],
    },
    {
      featureType: "poi.business",
      elementType: "labels.icon",
      stylers: [{ visibility: "on" }, { saturation: -100 }, { lightness: 40 }],
    },
    {
      featureType: "poi.business",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9ca3af" }],
    },

    { featureType: "road", elementType: "labels", stylers: [{ visibility: "simplified" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ saturation: -40 }] },
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

  // カスタムアイコン（任意）
  const icon: google.maps.Icon | undefined = markerIconUrl
    ? {
        url: markerIconUrl,
        scaledSize: new google.maps.Size(36, 36),
        anchor: new google.maps.Point(18, 36),
      }
    : undefined;

  return (
    <div style={containerStyle}>
      {isLoaded && (
        <GoogleMap
          center={center}
          zoom={zoom}
          mapContainerStyle={{ width: "100%", height: "100%" }}
          options={mapOptions}
        >
          <Marker position={center} title={markerTitle} icon={icon} />
          {show300mCircle && (
            <Circle
              center={center}
              radius={300}
              options={{
                strokeColor: "rgba(31,122,54,0.9)",
                strokeOpacity: 1,
                strokeWeight: 2,
                fillColor: "rgba(31,122,54,0.18)",
                fillOpacity: 0.18,
                clickable: false,
                draggable: false,
                editable: false,
                zIndex: 2,
              }}
            />
          )}
        </GoogleMap>
      )}
    </div>
  );
}
