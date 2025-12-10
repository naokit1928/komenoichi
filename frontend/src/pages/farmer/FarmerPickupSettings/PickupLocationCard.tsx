// frontend/src/features/farmer-pickup/PickupLocationCard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { GoogleMap, useJsApiLoader, Circle } from "@react-google-maps/api";
import FarmDetailSoftMap from "../../../components/FarmDetailSoftMap";
import LocationConsentModal from "./LocationConsentModal";

const cardBaseStyle: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  border: "1px solid rgba(0, 0, 0, 0.07)",
  borderRadius: 24,
  padding: "24px 0", // 横方向のpaddingはインナー側で管理する
  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.04)",
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 16, // ← 受け取り日時と同じ
  fontWeight: 700, // ← 受け取り日時と同じ
  letterSpacing: ".01em",
  color: "#111827",
};

type Mode = "new" | "existing";

type Props = {
  /** 新規登録時: "new" / 既存編集時: "existing"（デフォルト） */
  mode?: Mode;
  /** 既存のピン位置（ミニマップ & モーダル初期中心） */
  initialLat?: number | null;
  initialLng?: number | null;
  /** 保存時に親へ通知 */
  onSave?: (lat: number, lng: number) => void | Promise<void>;
  saving?: boolean;
  disabled?: boolean;
  className?: string;

  /**
   * 住所から geocoding した「基準座標」
   * - ここから radiusMeters 以内でないと保存不可、という制限をかける
   * - 自宅住所のジオコーディング結果を渡す前提
   */
  baseLat?: number | null;
  baseLng?: number | null;
  /** 基準座標からの最大距離[m]（デフォルト 400m） */
  radiusMeters?: number;

  /** カード内に表示する「変更不可メッセージ（任意）」 */
  cannotChangeReason?: string;

  /**
   * 郵便番号＋都道府県＋市区町村＋番地まで入力済みかどうか。
   * 新規登録画面では false のときに「住所を先に入力してください」モーダルだけ出して地図を開かない。
   * 既存編集画面などで指定しない場合は true 扱い（従来どおり）。
   */
  addressReady?: boolean;
};

function useDisableScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [active]);
}

const tokushimaDefault = { lat: 34.0703, lng: 134.5548 };

// 共通マップスタイル（FarmDetailSoftMap と同じトーン）
const softStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ saturation: -45 }, { lightness: 30 }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ saturation: -80 }, { lightness: 30 }] },
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
  { featureType: "water", elementType: "geometry", stylers: [{ saturation: -10 }, { lightness: 10 }] },
];

const baseMapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  clickableIcons: false,
  gestureHandling: "greedy",
  zoomControl: true,
  minZoom: 9,
  maxZoom: 18,
  styles: softStyle,
};

/** 2点間の距離[m]（球面近似） */
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

/* =====================
   「住所未入力です」注意モーダル
   ===================== */
function AddressWarningModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useDisableScroll(open);
  if (!open) return null;

  return ReactDOM.createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 2147483646,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-[2147483647] -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "min(420px, 92vw)",
          borderRadius: 24,
          background: "#FFFFFF",
          boxShadow: "0 20px 50px rgba(0,0,0,.28)",
          padding: "18px 20px 16px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="text-gray-800"
          style={{ fontSize: 15, fontWeight: 700, letterSpacing: ".01em" }}
        >
          先に住所を入力してください
        </div>
        <p
          style={{
            marginTop: 8,
            fontSize: 13,
            color: "#4B5563",
            lineHeight: 1.6,
          }}
        >
          郵便番号・都道府県・市区町村・番地まで入力してから、
          もう一度「受け渡し場所を設定」ボタンを押してください。
        </p>

        <div style={{ marginTop: 16, textAlign: "right" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              minWidth: 96,
              height: 40,
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "#111827",
              color: "#FFFFFF",
              fontSize: 13,
              fontWeight: 600,
              padding: "0 18px",
              cursor: "pointer",
            }}
          >
            OK
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

/* =====================
   モーダル（中央ピン固定＋400m制限オプション）
   ===================== */
function PickupLocationModal({
  open,
  lat,
  lng,
  onClose,
  onSave,
  busy,
  baseLat,
  baseLng,
  radiusMeters,
}: {
  open: boolean;
  lat: number | null;
  lng: number | null;
  onClose: () => void;
  onSave: (lat: number, lng: number) => void | Promise<void>;
  busy: boolean;
  baseLat?: number | null;
  baseLng?: number | null;
  radiusMeters?: number;
}) {
  useDisableScroll(open);

  const baseCenter = useMemo(() => {
  if (typeof baseLat === "number" && typeof baseLng === "number") {
    return { lat: baseLat, lng: baseLng };
  }
  return null;
}, [baseLat, baseLng]);

const initialCenter = useMemo(() => {
  // 1. すでに選択済みの受け渡し位置があれば、それを最優先で使う
  if (typeof lat === "number" && typeof lng === "number") {
    return { lat, lng };
  }
  // 2. まだ選択していない場合は、住所から算出したアンカー座標を初期位置にする
  if (baseCenter) {
    return baseCenter;
  }
  // 3. どちらも無いときだけ徳島市役所をフォールバックとして使う
  return tokushimaDefault;
}, [lat, lng, baseCenter]);


  const [center, setCenter] = useState(initialCenter);
  const [distanceError, setDistanceError] = useState<string | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);

  const effectiveRadius = radiusMeters && radiusMeters > 0 ? radiusMeters : 400;

  const recomputeDistanceError = (c: { lat: number; lng: number }) => {
    if (!baseCenter || !effectiveRadius) {
      // 基準座標がない場合は制限なし（= 400m ルールOFF）
      setDistanceError(null);
      return;
    }
    const d = distanceMeters(baseCenter, c);
    if (d > effectiveRadius) {
      // ★ 文言だけ「住所から近くのみ指定できます」に変更（距離は内部ロジックだけに保持）
      setDistanceError("住所から近くのみ指定できます");
    } else {
      setDistanceError(null);
    }
  };

  useEffect(() => {
    if (!open) return;
    setCenter(initialCenter);
    // 初期位置でのチェック
    recomputeDistanceError(initialCenter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCenter.lat, initialCenter.lng, baseCenter?.lat, baseCenter?.lng, effectiveRadius]);

  // 一覧・詳細と同じ Loader 設定に統一（id / language / region）
  const { isLoaded } = useJsApiLoader({
    id: "rice-app-map",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    language: "ja",
    region: "JP",
  });

  const handleDragEnd = () => {
    const m = mapRef.current;
    if (!m) return;
    const c = m.getCenter();
    if (!c) return;
    const next = { lat: c.lat(), lng: c.lng() };
    setCenter(next);
    recomputeDistanceError(next);
  };

  const canSave =
    !busy &&
    !!center &&
    // 基準座標＋半径指定がある場合のみ distanceError を見る
    (!(baseCenter && effectiveRadius) || !distanceError);

  if (!open) return null;

  return ReactDOM.createPortal(
    <>
      {/* 背景オーバーレイ */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          zIndex: 2147483646,
        }}
      />

      {/* モーダル本体 */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-[2147483647] -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "min(560px, 96vw)",
          maxHeight: "90vh",
          borderRadius: 28,
          background: "#FFFFFF",
          boxShadow: "0 28px 70px rgba(0,0,0,.32)",
          padding: "18px 16px 16px",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-start justify-between">
          <div
            className="text-gray-800"
            style={{ fontSize: 16, fontWeight: 700, letterSpacing: ".01em" }}
          >
            受け渡し場所にピンを設定
          </div>
          <button
            aria-label="閉じる"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path
                d="M18 6L6 18M6 6l12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* 説明文（短くした版） */}
        <p
          style={{
            marginTop: 6,
            fontSize: 13,
            color: "#6B7280",
            lineHeight: 1.6,
          }}
        >
          地図をドラッグして、画面中央のピンを受け渡し場所に合わせてください。
          この位置が今後の受け渡し場所になります。
        </p>

        {/* 距離エラーがあれば表示 */}
        {distanceError && (
          <p
            style={{
              marginTop: 4,
              fontSize: 12,
              color: "#DC2626",
              lineHeight: 1.5,
            }}
          >
            {distanceError}
          </p>
        )}

        {/* 地図エリア（サークル付き） */}
        <div
          style={{
            marginTop: 12,
            borderRadius: 16,
            overflow: "hidden",
            position: "relative",
            height: 320,
          }}
        >
          {isLoaded && (
            <GoogleMap
              onLoad={(m) => {
                mapRef.current = m;
              }}
              center={center}
              zoom={15}
              onDragEnd={handleDragEnd}
              mapContainerStyle={{ width: "100%", height: "100%" }}
              options={baseMapOptions}
            >
              {/* 400m サークル（基準座標がある場合はそこを中心） */}
              <Circle
                center={baseCenter ?? center}
                radius={effectiveRadius}
                options={{
                  strokeColor: "#1F7A36",
                  strokeOpacity: 0.65,
                  strokeWeight: 2,
                  fillColor: "rgba(31,122,54,0.18)",
                  fillOpacity: 0.18,
                  clickable: false,
                  draggable: false,
                  editable: false,
                  zIndex: 2,
                }}
              />
            </GoogleMap>
          )}

          {/* 中央固定ピン */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -100%)",
              pointerEvents: "none",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24">
              <path
                d="M12 2C8.962 2 6.5 4.462 6.5 7.5c0 3.89 3.5 7.77 5.02 9.37.26.28.7.28.96 0 1.52-1.6 5.02-5.48 5.02-9.37C17.5 4.462 15.038 2 12 2z"
                fill="#EF4444"
              />
              <circle cx="12" cy="7.5" r="2.2" fill="#F9FAFB" />
            </svg>
          </div>
        </div>

        {/* 保存ボタン */}
        <div style={{ marginTop: 16 }}>
          <button
            onClick={async () => {
              if (!canSave || !center) return;
              await onSave(center.lat, center.lng);
            }}
            disabled={!canSave}
            aria-label="この位置に保存"
            style={{
              width: "100%",
              height: 56,
              background: "#000000",
              color: "#FFFFFF",
              borderRadius: 16,
              fontSize: 20,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 0 rgba(0,0,0,.02)",
              opacity: canSave ? 1 : 0.5,
              cursor: canSave ? "pointer" : "not-allowed",
            }}
            className="transition active:scale-[.99]"
          >
            {busy ? "保存中..." : "この位置に保存"}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

/* =====================
   PickupLocationCard（ミニマップ＋テキスト＋ボタン）
   ===================== */
const PickupLocationCard: React.FC<Props> = ({
  mode = "existing",
  initialLat = null,
  initialLng = null,
  onSave,
  saving = false,
  disabled = false,
  className = "",
  baseLat = null,
  baseLng = null,
  radiusMeters,
  cannotChangeReason,
  addressReady = true,
}) => {
  const [open, setOpen] = useState(false);
  const [lat, setLat] = useState<number | null>(initialLat);
  const [lng, setLng] = useState<number | null>(initialLng);

  // 同意モーダルと同意状態
  const [showConsent, setShowConsent] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);

  // 住所未入力時の注意モーダル
  const [showAddressWarning, setShowAddressWarning] = useState(false);

  useEffect(() => {
    setLat(initialLat ?? null);
  }, [initialLat]);

  useEffect(() => {
    setLng(initialLng ?? null);
  }, [initialLng]);

  const handleSavedFromModal = async (nextLat: number, nextLng: number) => {
    setLat(nextLat);
    setLng(nextLng);
    if (onSave) {
      try {
        await onSave(nextLat, nextLng);
      } catch (e) {
        console.error("pickup location save failed", e);
      }
    }
    setOpen(false);
  };

  const displayLat = typeof lat === "number" ? lat : undefined;
  const displayLng = typeof lng === "number" ? lng : undefined;

  const buttonLabel =
    mode === "new" ? "受け渡し場所を設定" : "受け渡し場所を変更";

  const handleClickChangeLocation = () => {
    if (disabled || saving) return;

    // 住所がまだそろっていない場合は、注意モーダルだけ出して終了
    if (!addressReady) {
      setShowAddressWarning(true);
      return;
    }

    // まだ同意していない場合は、まず同意モーダルを開く
    if (!hasConsented) {
      setShowConsent(true);
      return;
    }

    // 同意済みならそのまま地図モーダルを開く
    setOpen(true);
  };

  return (
    <section className={`w-full ${className}`} style={{ marginTop: 0 }}>
      <div style={cardBaseStyle} className="w-full bg-white text-left">
        {/* ▼ インナーコンテナ：カードより一回り小さくして中央寄せ */}
        <div
          style={{
            width: "calc(100% - 32px)", // カードより左右16pxずつ小さい
            margin: "0 auto",
          }}
        >
          {/* タイトル */}
          <div className="flex items-start justify-between">
            <span style={cardTitleStyle}>受け渡し場所</span>
          </div>

          {/* ミニマップ：インナー幅いっぱいだが、カードより一回り小さい */}
          <div
            style={{
              marginTop: 12,
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <FarmDetailSoftMap
              centerLat={displayLat}
              centerLng={displayLng}
              zoom={15}
              height={220}
              show300mCircle={false} // ★ タップ前の地図にはサークル無し
              markerTitle="現在の受け渡し場所"
            />
          </div>

          {/* 予約がある場合の「変更不可」メッセージ（カード内に表示） */}
          {cannotChangeReason && (
            <p
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "#DC2626",
                lineHeight: 1.6,
              }}
            >
              {cannotChangeReason}
            </p>
          )}

          {/* テキスト＋ボタン：同じインナー幅の中で左右に余白 */}
          <div className="mt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClickChangeLocation}
              disabled={disabled || saving}
              className="shrink-0"
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(0,0,0,0.12)",
                fontSize: 13,
                fontWeight: 600,
                backgroundColor: disabled || saving ? "#F3F4F6" : "#FFFFFF",
                color: "#111827",
                opacity: disabled || saving ? 0.6 : 1,
                cursor: disabled || saving ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      </div>

      {/* 住所未入力時の注意モーダル */}
      <AddressWarningModal
        open={showAddressWarning}
        onClose={() => setShowAddressWarning(false)}
      />

      {/* 同意モーダル */}
      <LocationConsentModal
        open={showConsent}
        onClose={() => setShowConsent(false)}
        onAgreed={() => {
          setHasConsented(true);
          setShowConsent(false);
          setOpen(true); // 同意直後にそのまま地図モーダルを開く
        }}
      />

      {/* 位置選択モーダル */}
      <PickupLocationModal
        open={open}
        lat={lat}
        lng={lng}
        onClose={() => !saving && setOpen(false)}
        onSave={handleSavedFromModal}
        busy={saving}
        baseLat={baseLat ?? undefined}
        baseLng={baseLng ?? undefined}
        radiusMeters={radiusMeters}
      />
    </section>
  );
};

export default PickupLocationCard;
