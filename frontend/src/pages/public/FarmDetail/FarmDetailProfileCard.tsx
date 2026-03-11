import type { PublicFarmDetailDTO } from "../../../types/publicFarmDetail";

// ── Brand tokens ──────────────────────────────────
const C = {
  ink:       "#1a1108",
  ink2:      "#4b3e2a", // 住所や本文に使用（一覧ページと統一）
  ink3:      "#7a6c58",
  border:    "#e8e2d8",
} as const;

type Props = {
  farm: PublicFarmDetailDTO | null;
  ownerFullName: string | null;
  shortLocation: string | null;
  faceImageUrl?: string | null;
};

export default function FarmDetailProfileCard({
  farm,
  ownerFullName,
  shortLocation,
  faceImageUrl,
}: Props) {
  const displayName = ownerFullName ? `${ownerFullName}さんのお米` : null;

  if (!(faceImageUrl || displayName || farm?.pr_text)) {
    return null;
  }

  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        background: "#fff",
        padding: 12,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {faceImageUrl && (
          <img
            src={faceImageUrl}
            alt="農家プロフィール写真"
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: `1px solid ${C.border}`,
              objectFit: "cover",
            }}
          />
        )}

        <div>
          {/* 農家名：16px, 黒 (Level 1) */}
          {displayName && (
            <div style={{ fontSize: 16, fontWeight: 500, color: C.ink }}>
              {displayName}
            </div>
          )}

          {/* 住所：13px, 濃い茶色 (Level 2 - 一覧ページと統一) */}
          {shortLocation && (
            <div
              style={{
                fontSize: 13,
                color: C.ink2,
                marginTop: 2,
              }}
            >
              {shortLocation}
            </div>
          )}
        </div>
      </div>

      {farm?.pr_text && (
        <div style={{ marginTop: 10 }}>
          {/* PR本文：15px, 濃い茶色 (Level 2) */}
          <div
            style={{
              fontSize: 15,
              color: C.ink2,
              lineHeight: 1.6,
            }}
          >
            {farm.pr_text}
          </div>
        </div>
      )}
    </div>
  );
}