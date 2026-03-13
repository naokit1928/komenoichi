// src/pages/public/ReservationBooked/InstallAppCard.tsx
export function InstallAppCard() {
  return (
    <section
      style={{
        border: "1px solid #e8e2d8",
        borderRadius: 12,
        padding: "16px",
        marginBottom: 24, // 他のカードと同じ余白感に
        background: "#ffffff",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)", // ほんのり影をつけてカード感を強調
      }}
    >
      {/* 上部：タイトルとアイコン */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <div
          style={{
            background: "#f4f1ed",
            width: 40,
            height: 40,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          📱
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1108", marginBottom: 2 }}>
            当日の受け取りをスムーズに
          </div>
          <div style={{ fontSize: 12, color: "#7a6c58" }}>
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
        <div>
          <strong style={{ color: "#1a1108" }}>[ iPhone ]</strong> 下部の「共有ボタン [↑]」から<br />
          <strong style={{ color: "#1a1108" }}>[ Android ]</strong> 右上の「メニュー [⋮]」から
        </div>
      </div>
    </section>
  );
}