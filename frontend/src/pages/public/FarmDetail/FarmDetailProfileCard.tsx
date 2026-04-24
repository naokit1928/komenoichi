import type { PublicFarmDetailDTO } from "../../../types/publicFarmDetail";

// ── Brand tokens ──────────────────────────────────
const C = {
  ink:       "#1a1108",
  ink2:      "#4b3e2a", // 住所や本文に使用（一覧ページと統一）
  ink3:      "#7a6c58",
  border:    "#e8e2d8",
  linkBlue:  "#2563EB", // ★ 追加: リンク用の青色
} as const;

type Props = {
  farm: PublicFarmDetailDTO | null;
  ownerFullName: string | null;
  shortLocation: string | null;
  faceImageUrl?: string | null;
};

// ── IDから安全なリンク先URL（href用）を組み立てる関数 ──
function buildSafeUrl(platform: string, accountId: string): string {
  // 先頭の @ や前後の空白を除去
  const id = accountId.replace(/^@/, "").trim();
  switch (platform) {
    case "instagram": return `https://www.instagram.com/${id}`;
    case "x":         return `https://x.com/${id}`;
    case "facebook":  return `https://www.facebook.com/${id}`;
    case "youtube":   return `https://www.youtube.com/@${id}`;
    case "tiktok":    return `https://www.tiktok.com/@${id}`;
    case "line":      
      // LINEは「@」を含める必要がある場合が多いので復元
      return `https://line.me/R/ti/p/${accountId.trim().startsWith("@") ? accountId.trim() : "@" + id}`;
    default:          return "";
  }
}

// ── IDから画面表示用（テキスト用）のURLを組み立てる関数 ──
function buildDisplayUrl(platform: string, accountId: string): string {
  const id = accountId.replace(/^@/, "").trim();
  const domains: Record<string, string> = {
    instagram: "instagram.com/",
    line:      "line.me/R/ti/p/",
    x:         "x.com/",
    facebook:  "facebook.com/",
    youtube:   "youtube.com/@",
    tiktok:    "tiktok.com/@",
  };
  
  // LINEの場合は @ を付ける
  const displayId = platform === "line" ? (accountId.trim().startsWith("@") ? accountId.trim() : "@" + id) : id;
  return (domains[platform] || "") + displayId;
}

export default function FarmDetailProfileCard({
  farm,
  ownerFullName,
  shortLocation,
  faceImageUrl,
}: Props) {
  const displayName = ownerFullName ? `${ownerFullName}さんのお米` : null;

  // 顔写真、名前、プロフィールのいずれも無ければ非表示
  if (!(faceImageUrl || displayName || farm?.pr_text)) {
    return null;
  }

  // ★ バックエンドから渡ってくるSNSリンクデータ
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

      {/* プロフィール本文とSNSリンク */}
      {farm?.pr_text && (
        <div style={{ marginTop: 10 }}>
          {/* PR本文：15px, 濃い茶色 (Level 2) */}
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

          {/* ★ SNS・連絡先リンク */}
          {links.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {links.map((link, idx) => {
                const url = buildSafeUrl(link.platform, link.account_id);
                const displayUrl = buildDisplayUrl(link.platform, link.account_id);
                
                // 未知のプラットフォームや不正なURLは弾く
                if (!url) return null;

                return (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "flex-start", // 長いURLが折り返した時にアイコンを上揃えにする
                      gap: 6,
                      fontSize: 14,
                      fontWeight: 500,
                      color: C.linkBlue, // 青色
                      textDecoration: "none",
                      lineHeight: 1.5,
                      wordBreak: "break-word",
                    }}
                  >
                    {/* 汎用的なリンクアイコン */}
                    <svg 
                      width="15" 
                      height="15" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      style={{ marginTop: 3, flexShrink: 0 }} // テキストとの縦位置を微調整
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