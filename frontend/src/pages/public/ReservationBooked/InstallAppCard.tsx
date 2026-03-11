// frontend/src/pages/public/ReservationBooked/InstallAppCard.tsx

export function InstallAppCard() {
  return (
    <section
      style={{
        backgroundColor: "#fef8f1", // 少し目立たせるための温かい背景色
        border: "1.5px solid #d97757", // 赤とんぼカラーのアクセント
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          color: "#d97757",
          fontWeight: 600,
          fontSize: 16,
        }}
      >
        <span style={{ fontSize: 20 }}>📱</span> 当日の受け取りをスムーズに
      </div>

      <p style={{ margin: 0, fontSize: 14, color: "#333", lineHeight: 1.6, marginBottom: 12 }}>
        農家さんの直売所や農地付近は、電波が弱い場合があります。
        通信環境がなくてもワンタップでこの「予約詳細画面」を出せるよう、今のうちにスマホの<strong>ホーム画面に追加（インストール）</strong>しておくのがおすすめです。
      </p>

      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 8,
          padding: 12,
          fontSize: 13,
          color: "#555",
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>💡 追加方法</div>
        <div style={{ marginBottom: 4 }}>
          ・<b>iPhone (Safari):</b> 下部の「共有ボタン [↑]」から「ホーム画面に追加」
        </div>
        <div>
          {/* ★ ここを実際の画面に合わせて正確に修正！ */}
          ・<b>Android (Chrome):</b> 上部の「メニュー [⋮]」から「ホーム画面に追加」を押し、<b>「インストール」</b>を選択
        </div>
      </div>
    </section>
  );
}