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
  onBack: () => void; // ★ 追加
};

export default function FarmDetailHero({
  photoUrls,
  titleText,
  farmId,
  isFav,
  onToggleFav,
  onShare,
  onBack, // ★ 追加
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

  const onMouseDown = (e: React.MouseEvent) => setMouseStartX(e.clientX);

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

  const onMouseUp = (e: React.MouseEvent) => finishMouseSwipe(e.clientX);

  const onMouseLeave = (e: React.MouseEvent) => finishMouseSwipe(e.clientX);

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
        width: "100%",
        background: "#000",
        userSelect: "none",
      }}
    >
      {/* 中央カラム */}
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          position: "relative",
          overflow: "hidden",
          background: "#000",
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
              zIndex: 10,
            }}
          >
            {slideIndex + 1} / {photoUrls.length}
          </div>
        )}

        {/* === back button (ここを追加) === */}
        <div
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            zIndex: 10,
          }}
        >
          <button
            onClick={onBack}
            aria-label="一覧に戻る"
            title="一覧に戻る"
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
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: 2 }} // 視覚的な中央揃えの微調整
            >
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        </div>

        {/* === share / favorite === */}
        <div
          style={{
            position: "absolute",
            right: 12,
            top: 12,
            display: "flex",
            gap: 8,
            zIndex: 10,
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
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
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
                zIndex: 10,
              }}
            >
              ‹
            </button>

            <button
              onClick={() => setSlideIndex((i) => (i + 1) % photoUrls.length)}
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
                zIndex: 10,
              }}
            >
              ›
            </button>
          </>
        )}
      </div>
    </div>
  );
}