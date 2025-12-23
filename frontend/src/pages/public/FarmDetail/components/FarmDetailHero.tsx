import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/**
 * Hero 用 Props
 * - UI責務のみ（データ取得は外）
 */
type Props = {
  photoUrls: string[];
  titleText?: string | null;
  farmId: string;

  isFav: boolean;
  onToggleFav: () => void;
  onShare: () => void;
};

export default function FarmDetailHero({
  photoUrls,
  titleText,
  farmId,
  isFav,
  onToggleFav,
  onShare,
}: Props) {
  const [slideIndex, setSlideIndex] = useState(0);

  // --- swipe handling ---
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [mouseStartX, setMouseStartX] = useState<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) =>
    setTouchStartX(e.touches[0].clientX);

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX == null || photoUrls.length === 0) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (dx > 40) {
      setSlideIndex((i) => (i - 1 + photoUrls.length) % photoUrls.length);
    }
    if (dx < -40) {
      setSlideIndex((i) => (i + 1) % photoUrls.length);
    }
    setTouchStartX(null);
  };

  const onMouseDown = (e: React.MouseEvent) =>
    setMouseStartX(e.clientX);

  const finishMouseSwipe = (clientX: number) => {
    if (mouseStartX == null || photoUrls.length === 0) return;
    const dx = clientX - mouseStartX;
    if (dx > 50) {
      setSlideIndex((i) => (i - 1 + photoUrls.length) % photoUrls.length);
    }
    if (dx < -50) {
      setSlideIndex((i) => (i + 1) % photoUrls.length);
    }
    setMouseStartX(null);
  };

  const onMouseUp = (e: React.MouseEvent) =>
    finishMouseSwipe(e.clientX);

  const onMouseLeave = (e: React.MouseEvent) =>
    finishMouseSwipe(e.clientX);

  // photoUrls が変わったら index をリセット
  useEffect(() => {
    setSlideIndex(0);
  }, [photoUrls.length]);

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      style={{
        position: "relative",
        width: "100vw",
        margin: "0 calc(50% - 50vw)",
        background: "#000",
        overflow: "hidden",
        userSelect: "none",
        marginTop: "-8px",
      }}
    >
      {/* === image area (3:2) === */}
      <div
        style={{
          width: "100%",
          aspectRatio: "3 / 2",
          overflow: "hidden",
          background: photoUrls.length ? "#000" : "#e5e7eb",
        }}
      >
        {photoUrls.length > 0 ? (
          <img
            src={photoUrls[slideIndex]}
            alt={`カバーフォト ${slideIndex + 1}`}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%" }} />
        )}
      </div>

      {/* === pager === */}
      {photoUrls.length > 0 && (
        <div
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            padding: "6px 10px",
            borderRadius: 9999,
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            fontSize: 12,
          }}
        >
          {slideIndex + 1} / {photoUrls.length}
        </div>
      )}

      {/* === back button === */}
      <Link
        to="/farms"
        aria-label="農家一覧に戻る"
        title="戻る"
        style={{
          position: "absolute",
          left: 12,
          top: 12,
          width: 38,
          height: 38,
          borderRadius: 9999,
          border: "1px solid rgba(0,0,0,0.08)",
          background: "rgba(255,255,255,0.95)",
          color: "#111827",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
          boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
          fontSize: 18,
        }}
      >
        ‹
      </Link>

      {/* === share / favorite === */}
      <div
        style={{
          position: "absolute",
          right: 12,
          top: 12,
          display: "flex",
          gap: 8,
        }}
      >
        <button
          onClick={onShare}
          aria-label="ページを共有"
          title="共有"
          style={{
            width: 38,
            height: 38,
            borderRadius: 9999,
            border: "1px solid rgba(0,0,0,0.08)",
            background: "rgba(255,255,255,0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#111827"
            strokeWidth="1.8"
          >
            <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
            <path d="M16 6l-4-4-4 4" />
            <path d="M12 2v14" />
          </svg>
        </button>

        <button
          onClick={onToggleFav}
          aria-pressed={isFav}
          aria-label={isFav ? "お気に入りから削除" : "お気に入りに追加"}
          title={isFav ? "お気に入りから削除" : "お気に入りに追加"}
          style={{
            width: 38,
            height: 38,
            borderRadius: 9999,
            border: "1px solid rgba(0,0,0,0.08)",
            background: "rgba(255,255,255,0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={isFav ? "#dc2626" : "none"}
            stroke={isFav ? "#dc2626" : "#111827"}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61c-1.54-1.4-3.97-1.33-5.43.15L12 8.17l-3.41-3.4c-1.46-1.48-3.89-1.55-5.43-.15-1.74 1.58-1.82 4.28-.18 5.96l3.32 3.44L12 20.5l5.7-6.04 3.32-3.44c1.64-1.68 1.56-4.38-.18-5.96z" />
          </svg>
        </button>
      </div>

      {/* === arrows === */}
      {photoUrls.length > 0 && (
        <>
          <button
            onClick={() =>
              setSlideIndex(
                (i) => (i - 1 + photoUrls.length) % photoUrls.length
              )
            }
            aria-label="前の写真"
            style={{
              position: "absolute",
              left: 6,
              top: "50%",
              transform: "translateY(-50%)",
              width: 32,
              height: 32,
              borderRadius: 9999,
              border: "1px solid rgba(255,255,255,0.35)",
              background: "rgba(255,255,255,0.65)",
              color: "#111827",
              cursor: "pointer",
              opacity: 0.55,
            }}
          >
            ‹
          </button>

          <button
            onClick={() =>
              setSlideIndex(
                (i) => (i + 1) % photoUrls.length
              )
            }
            aria-label="次の写真"
            style={{
              position: "absolute",
              right: 6,
              top: "50%",
              transform: "translateY(-50%)",
              width: 32,
              height: 32,
              borderRadius: 9999,
              border: "1px solid rgba(255,255,255,0.35)",
              background: "rgba(255,255,255,0.65)",
              color: "#111827",
              cursor: "pointer",
              opacity: 0.55,
            }}
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
