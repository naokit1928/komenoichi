import React, { useEffect, useRef, useState } from "react";

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
  selected: PublicFarmCardDTO | null;
  onClose: () => void;
  onHoverChange?: (id: number | null) => void;
};

type SheetState = "closed" | "half" | "full";

export default function MapBottomSheet({
  selected,
  onClose,
  onHoverChange,
}: Props) {
  // ===== Bottom Sheet =====
  const PANEL_VH = 0.88;
  const HALF_H = 140;
  const CLOSE_THRESHOLD = 100;

  const [, setPanelH] = useState(() =>
    Math.round(window.innerHeight * PANEL_VH)
  );
  useEffect(() => {
    const onResize = () =>
      setPanelH(Math.round(window.innerHeight * PANEL_VH));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [sheetH, setSheetH] = useState<number>(HALF_H);
  const [, setSheetState] = useState<SheetState>("closed");
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
      onClose();
      return;
    }
    setSheetH(HALF_H);
    setSheetState("half");
  };

  if (!selected) return null;

  return (
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
          transform: "translateY(0)",
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
            onClose();
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
          onMouseEnter={() => onHoverChange?.(selected.farm_id)}
          onMouseLeave={() => onHoverChange?.(null)}
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
          onMouseEnter={() => onHoverChange?.(selected.farm_id)}
          onMouseLeave={() => onHoverChange?.(null)}
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
  );
}
