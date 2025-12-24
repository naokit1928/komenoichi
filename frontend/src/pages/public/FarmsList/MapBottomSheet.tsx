import React from "react";

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

export default function MapBottomSheet({
  selected,
  onClose,
  onHoverChange,
}: Props) {
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
          background: "#ffffff",
          borderRadius: 20,
          boxShadow: "0 -12px 40px rgba(0,0,0,0.18)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch", // ★ 高さを揃える
        }}
      >
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
            top: 12,
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "1px solid rgba(0,0,0,0.1)",
            background: "#ffffff",
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

        {/* 左：写真（カード高に追従） */}
        <div
          onMouseEnter={() => onHoverChange?.(selected.farm_id)}
          onMouseLeave={() => onHoverChange?.(null)}
          style={{
            width: 140,
            flexShrink: 0,
            alignSelf: "stretch",
          }}
        >
          <img
            src={selected.pr_images[0]}
            alt={selected.owner_label}
            style={{
              width: "100%",
              height: "100%",          // ★ これが決定打
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>

        {/* 右：テキスト */}
        <a
          href={`/farms/${selected.farm_id}`}
          onMouseEnter={() => onHoverChange?.(selected.farm_id)}
          onMouseLeave={() => onHoverChange?.(null)}
          style={{
            textDecoration: "none",
            color: "inherit",
            flex: 1,
            minWidth: 0,
          }}
        >
          <div
            style={{
              padding: "12px 16px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {/* タイトル */}
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#111827",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {selected.pr_title || selected.owner_label}
            </div>

            {/* 住所 */}
            <div
              style={{
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

            {/* 価格 */}
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              ¥{selected.price_10kg.toLocaleString()}（10kg）
            </div>

            {/* 次回受取日（2行固定） */}
            <div
              style={{
                fontSize: 12,
                color: "#6b7280",
                lineHeight: 1.4,
              }}
            >
             
              <div>{selected.next_pickup_display}</div>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}
