import type { PublicFarmDetailDTO } from "../../../types/publicFarmDetail";

const C = {
  ink: "#1a1108",
  ink2: "#4b3e2a",
  ink3: "#7a6c58",
  border: "#e8e2d8",
  linkBlue: "#2563EB",
} as const;

type Props = {
  farm: PublicFarmDetailDTO | null;
  ownerFullName: string | null;
  shortLocation: string | null;
  faceImageUrl?: string | null;
};

function buildSafeUrl(platform: string, accountId: string): string {
  const trimmed = accountId.trim();
  const idNoAt = trimmed.replace(/^@/, "");
  switch (platform) {
    case "instagram": return `https://www.instagram.com/${idNoAt}`;
    case "x": return `https://x.com/${idNoAt}`;
    case "facebook": return `https://www.facebook.com/${idNoAt}`;
    case "youtube": return `https://www.youtube.com/@${idNoAt}`;
    case "tiktok": return `https://www.tiktok.com/@${idNoAt}`;
    case "line":
      if (trimmed.startsWith("@")) return `https://line.me/R/ti/p/${trimmed}`;
      return `https://line.me/ti/p/~${idNoAt}`;
    default: return "";
  }
}

function buildDisplayUrl(platform: string, accountId: string): string {
  const trimmed = accountId.trim();
  const idNoAt = trimmed.replace(/^@/, "");
  switch (platform) {
    case "instagram": return `instagram.com/${idNoAt}`;
    case "x": return `x.com/${idNoAt}`;
    case "facebook": return `facebook.com/${idNoAt}`;
    case "youtube": return `youtube.com/@${idNoAt}`;
    case "tiktok": return `tiktok.com/@${idNoAt}`;
    case "line":
      if (trimmed.startsWith("@")) return `line.me/R/ti/p/${trimmed}`;
      return `line.me/ti/p/~${idNoAt}`;
    default: return "";
  }
}

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

  const links = farm?.sns_links || [];

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
          {displayName && (
            <div style={{ fontSize: 16, fontWeight: 500, color: C.ink }}>
              {displayName}
            </div>
          )}
          {shortLocation && (
            <div style={{ fontSize: 13, color: C.ink2, marginTop: 2 }}>
              {shortLocation}
            </div>
          )}
        </div>
      </div>

      {farm?.pr_text && (
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              fontSize: 15,
              color: C.ink2,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {farm.pr_text}
          </div>

          {links.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {links.map((link, idx) => {
                const url = buildSafeUrl(link.platform, link.account_id);
                const displayUrl = buildDisplayUrl(link.platform, link.account_id);
                if (!url) return null;
                return (
                  <a 
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "flex-start",
                      gap: 6,
                      fontSize: 14,
                      fontWeight: 500,
                      color: C.linkBlue,
                      textDecoration: "none",
                      lineHeight: 1.5,
                      wordBreak: "break-word",
                    }}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ marginTop: 3, flexShrink: 0 }}
                    >
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                    <span style={{ borderBottom: "1px solid rgba(37, 99, 235, 0.2)" }}>
                      {displayUrl}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}