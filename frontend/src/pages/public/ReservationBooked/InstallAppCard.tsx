// src/pages/public/ReservationBooked/InstallAppCard.tsx
export function InstallAppCard() {
  return (
    <section
      style={{
        border: "1px solid #e8e2d8",
        borderRadius: 12,
        // ★左右のパディングを 16px → 12px に削って横幅を稼ぐ
        padding: "16px 12px", 
        marginBottom: 24,
        background: "#ffffff",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
      }}
    >
      {/* 上部：タイトルとアイコン */}
      {/* ★gapを 12 → 8 に詰める */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <div
          style={{
            background: "#f4f1ed",
            // ★アイコン枠を 40 → 32 に縮小
            width: 32,
            height: 32,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18, // 20 → 18
            flexShrink: 0,
          }}
        >
          📱
        </div>
        <div>
          {/* ★フォントサイズを 13px にし、文言を少しシャープに */}
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1108", marginBottom: 2 }}>
            ホーム画面追加でスムーズに受取
          </div>
          {/* ★サブテキストもバランスをとって 11px に */}
          <div style={{ fontSize: 11, color: "#7a6c58" }}>
            電波の弱い農地でもすぐ予約画面を開けます
          </div>
        </div>
      </div>

      {/* 下部：具体的な手順（グレーのボックスに入れてスッキリと） */}
      <div
        style={{
          background: "#fdfcfb",
          border: "1px solid #e8e2d8",
          padding: "10px 12px",
          borderRadius: 8,
          fontSize: 12,
          color: "#4b3e2a",
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4, color: "#C49A1A" }}>
          💡 ホーム画面への追加方法
        </div>
        {/* ★手順部分も 11px にして細い画面での改行崩れを防止 */}
        <div style={{ fontSize: 11 }}>
          <strong style={{ color: "#1a1108" }}>[ iPhone ]</strong> 下部の「共有ボタン [↑]」から<br />
          <strong style={{ color: "#1a1108" }}>[ Android ]</strong> 右上の「メニュー [⋮]」から
        </div>
      </div>
    </section>
  );
}