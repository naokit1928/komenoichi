import React from "react";

// ── Brand tokens ──────────────────────────────────
const C = {
  red:       "#A83020",
  redLight:  "rgba(168,48,32,0.07)",
  redBorder: "rgba(168,48,32,0.16)",
  gold:      "#C49A1A",
  ink:       "#1a1108",
  ink2:      "#4b3e2a",
  ink3:      "#7a6c58",
  border:    "#e8e2d8",
  bg:        "#ffffff",
} as const;

// ── Types ─────────────────────────────────────────
export type FarmCardData = {
  id: number;
  name: string;
  price10kg: number;
  avatarUrl: string;
  images: string[];
  title: string;
  addressLabel: string;
  pickupTime: string;
  lat: number | null;
  lng: number | null;
};

// ── Heart icon ────────────────────────────────────
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "#dc2626" : "none"}
      stroke={filled ? "#dc2626" : C.ink}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61c-1.54-1.4-3.97-1.33-5.43.15L12 8.17l-3.41-3.4c-1.46-1.48-3.89-1.55-5.43-.15-1.74 1.58-1.82 4.28-.18 5.96l3.32 3.44L12 20.5l5.7-6.04 3.32-3.44c1.64-1.68 1.56-4.38-.18-5.96z" />
    </svg>
  );
}

// ── FarmCard ──────────────────────────────────────
export function FarmCard({
  farm,
  isFav,
  toggleFav,
}: {
  farm: FarmCardData;
  isFav: boolean;
  toggleFav: (id: number, e?: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = React.useState(false);

  const coverImage =
    farm.images?.[0] || "https://placehold.co/1500x1000?text=No+Image";
  const displayTitle = farm.title || farm.name;

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        overflow: "hidden",
        transition: "box-shadow 180ms ease, transform 180ms ease",
        boxShadow: hovered
          ? `0 8px 28px rgba(168,48,32,0.10), 0 2px 8px rgba(0,0,0,0.06)`
          : "none",
        transform: hovered ? "translateY(-2px)" : "none",
      }}
    >
      {/* ── Cover image ── */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "3 / 2",
          overflow: "hidden",
          background: "#f0ede8",
        }}
      >
        <img
          src={coverImage}
          alt={`${displayTitle}のカバー写真`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            transition: "transform 300ms ease",
            transform: hovered ? "scale(1.03)" : "scale(1)",
          }}
        />

        {/* Fav button */}
        <button
          type="button"
          aria-pressed={isFav}
          onClick={(e) => toggleFav(farm.id, e)}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.5)",
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "background 150ms",
          }}
        >
          <HeartIcon filled={isFav} />
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "14px 16px 16px" }}>

        {/* Avatar + title */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 2 }}>
          <img
            src={farm.avatarUrl || "https://placehold.co/80x80?text=F"}
            alt={farm.name}
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              border: `1.5px solid ${C.border}`,
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
          <div>
            <h2
              style={{
                fontSize: 17,
                fontWeight: 450,
                lineHeight: 1.35,
                color: C.ink,
                margin: 0,
                marginBottom: 2,
                fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif",
              }}
            >
              {displayTitle}
            </h2>
            <div style={{ fontSize: 12, color: C.ink3 }}>{farm.name}</div>
          </div>
        </div>

        {/* Address */}
        {farm.addressLabel && (
          <p
            style={{
              fontSize: 13,
              color: C.ink2,
              lineHeight: 1.6,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
              overflow: "hidden",
              marginBottom: 2,
            }}
          >
            {farm.addressLabel}
          </p>
        )}

        {/* Price */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 5 }}>
          <span
            style={{
              fontSize: 19,
              fontWeight: 500,
              color: C.ink,
              fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif",
            }}
          >
            ¥{farm.price10kg.toLocaleString()}
          </span>
          <span style={{ fontSize: 12, color: C.ink3 }}>（10kg）</span>
        </div>

        {/* Pickup time */}
        {farm.pickupTime && (
          <div
            style={{
              fontSize: 12,
              color: C.ink3,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {/* Gold dot */}
            <span
              style={{
                display: "inline-block",
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: C.gold,
                flexShrink: 0,
              }}
            />
            次回受取日　{farm.pickupTime}
          </div>
        )}
      </div>
    </article>
  );
}
