import React, { useState } from "react";

// 一覧カード用の内部データ
export type FarmCardData = {
  id: number;
  name: string; // owner_label （◯◯さんのお米）
  price10kg: number;
  avatarUrl: string; // face_image_url
  images: string[]; // pr_images
  title: string; // pr_title
  addressLabel: string; // owner_address_label
  pickupTime: string; // next_pickup_display
  lat: number | null;
  lng: number | null;
};

// ====== UI helpers ======
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={filled ? "#dc2626" : "none"}
      stroke={filled ? "#dc2626" : "#111827"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61c-1.54-1.4-3.97-1.33-5.43.15L12 8.17l-3.41-3.4c-1.46-1.48-3.89-1.55-5.43-.15-1.74 1.58-1.82 4.28-.18 5.96l3.32 3.44L12 20.5l5.7-6.04 3.32-3.44c1.64-1.68 1.56-4.38-.18-5.96z" />
    </svg>
  );
}

export function FarmCard({
  farm,
  isFav,
  toggleFav,
}: {
  farm: FarmCardData;
  isFav: boolean;
  toggleFav: (id: number, e?: React.MouseEvent) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) =>
    setTouchStartX(e.touches[0].clientX);

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (dx > 40)
      setIdx((i) => (i - 1 + farm.images.length) % farm.images.length);
    if (dx < -40) setIdx((i) => (i + 1) % farm.images.length);
    setTouchStartX(null);
  };

  const card = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#fff",
    overflow: "hidden",
    transition: "box-shadow 150ms, transform 150ms",
  } as const;

  const text = { padding: 16 } as const;

  const imageCount = Math.max(farm.images.length, 1);
  const safeIdx = Math.min(Math.max(idx, 0), Math.max(imageCount - 1, 0));
  const mainImage =
    farm.images[safeIdx] || "https://placehold.co/1500x1000?text=No+Image";

  const displayTitle = farm.title || farm.name;

  return (
    <article style={card}>
      {/* --- 画像 --- */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "3 / 2",
          overflow: "hidden",
          userSelect: "none",
        }}
      >
        <img
          src={mainImage}
          alt={`${displayTitle}の写真 ${safeIdx + 1}`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />

        <button
          type="button"
          aria-pressed={isFav}
          onClick={(e) => toggleFav(farm.id, e)}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 38,
            height: 38,
            borderRadius: 9999,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "rgba(255,255,255,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <HeartIcon filled={isFav} />
        </button>

        <div
          style={{
            position: "absolute",
            right: 10,
            bottom: 10,
            padding: "4px 8px",
            borderRadius: 9999,
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            fontSize: 12,
          }}
        >
          {Math.min(safeIdx + 1, imageCount)} / {imageCount}
        </div>
      </div>

      {/* --- テキスト --- */}
      <div style={text}>
        <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
          <img
            src={farm.avatarUrl || "https://placehold.co/80x80?text=F"}
            alt={farm.name}
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              border: "1px solid #d1d5db",
              objectFit: "cover",
            }}
          />
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>
              {displayTitle}
            </h2>
            <div style={{ fontSize: 13, color: "#4b5563" }}>{farm.name}</div>
          </div>
        </div>

        {farm.addressLabel && (
          <p
            style={{
              fontSize: 14,
              color: "#4b5563",
              lineHeight: 1.6,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as any,
              overflow: "hidden",
            }}
          >
            {farm.addressLabel}
          </p>
        )}

        {/* ★ 価格表示（正の仕様に復元） */}
        <div style={{ marginTop: 12 }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              textDecoration: "underline",
              marginRight: 6,
            }}
          >
            ¥{farm.price10kg}
          </span>
          <span style={{ fontSize: 13, color: "#374151" }}>(10kg)</span>

          {farm.pickupTime && (
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              次回受取日 {farm.pickupTime}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
