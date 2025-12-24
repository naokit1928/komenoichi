import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MapCanvas from "./MapCanvas";
import MapBottomSheet from "./MapBottomSheet";

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
  open: boolean;
  onRequestClose: () => void;
  mapCenter?: { lat: number; lng: number };
};

const DEFAULT_CENTER = { lat: 34.0703, lng: 134.5548 };

// 境界ドラッグ設定
const HANDLE_HEIGHT = 20;      // 境界ゾーンの高さ
const CLOSE_THRESHOLD = 40;    // 上方向にこれ以上ドラッグしたら閉じる

export default function MapLayerPortal({
  open,
  onRequestClose,
  mapCenter,
}: Props) {
  const center = mapCenter ?? DEFAULT_CENTER;

  // =========================================================
  // Portal mount
  // =========================================================
  const rootRef = useRef<HTMLDivElement | null>(null);
  if (!rootRef.current) {
    const el = document.createElement("div");
    el.style.zIndex = "60";
    rootRef.current = el;
  }

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    document.body.appendChild(el);
    return () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }, []);

  // =========================================================
  // URL sel 管理（既存仕様）
  // =========================================================
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

  useEffect(() => {
    const onPop = () => {
      if (open) setSelectedId(parseSelFromURL());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open]);

  const selectFarm = (id: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("map", "1");
    params.set("sel", String(id));
    const url = new URL(window.location.href);
    url.search = params.toString();
    history.pushState({}, "", url.toString());
    setSelectedId(id);
  };

  const clearSelection = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("sel");
    const url = new URL(window.location.href);
    url.search = params.toString();
    history.pushState({}, "", url.toString());
    setSelectedId(null);
  };

  // =========================================================
  // Map → Portal データ
  // =========================================================
  const [mapFarms, setMapFarms] = useState<PublicFarmCardDTO[]>([]);

  const selected = useMemo(
    () => mapFarms.find((f) => f.farm_id === selectedId) || null,
    [mapFarms, selectedId]
  );

  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // =========================================================
  // 境界ドラッグ処理（PC + Android 両対応）
  // =========================================================
  const dragStartY = useRef<number | null>(null);

  const startDrag = (y: number) => {
    dragStartY.current = y;
  };

  const moveDrag = (y: number) => {
    if (dragStartY.current == null) return;
    const dy = y - dragStartY.current;

    // 下 → 上のみ
    if (dy < -CLOSE_THRESHOLD) {
      dragStartY.current = null;
      onRequestClose();
    }
  };

  const endDrag = () => {
    dragStartY.current = null;
  };

  // =========================================================
  // styles
  // =========================================================
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
    height: "83vh",
    background: "#fff",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
    transform: open ? "translateY(0)" : "translateY(-100%)",
    transition: "transform 260ms ease",
    overflow: "hidden",
    pointerEvents: open ? "auto" : "none",
  };

  // =========================================================
  // Render
  // =========================================================
  return createPortal(
    <>
      <div style={backdropStyle} onClick={onRequestClose} />

      <section role="dialog" aria-modal={open} style={panelStyle}>
        <MapCanvas
          center={center}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onHoverChange={setHoveredId}
          onSelectFarm={selectFarm}
          onMapClick={() => {
            if (selectedId !== null) clearSelection();
          }}
          onFarmsChange={setMapFarms}
        />

        {/* ===== 境界ドラッグハンドル（ここだけが閉じる判定） ===== */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: HANDLE_HEIGHT,
            zIndex: 40,
            cursor: "ns-resize",
            touchAction: "none", // ★ Android 対策：必須
          }}
          // PC
          onPointerDown={(e) => startDrag(e.clientY)}
          onPointerMove={(e) => moveDrag(e.clientY)}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          // Mobile
          onTouchStart={(e) => startDrag(e.touches[0].clientY)}
          onTouchMove={(e) => moveDrag(e.touches[0].clientY)}
          onTouchEnd={endDrag}
          onTouchCancel={endDrag}
        />

        <MapBottomSheet
          selected={selected}
          onClose={clearSelection}
          onCloseMap={onRequestClose}
          onHoverChange={setHoveredId}
        />
      </section>
    </>,
    rootRef.current!
  );
}
