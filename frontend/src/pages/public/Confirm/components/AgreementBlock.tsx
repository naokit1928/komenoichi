type Props = {
  agreed: boolean;
  onChange: (checked: boolean) => void;
};

export function AgreementBlock({ agreed, onChange }: Props) {
  const card: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  };

  return (
    <>
      {/* タイトル */}
      <div
        style={{
          marginTop: 16,
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        予約に際する同意事項
      </div>

      {/* 内容 */}
      <section
        style={{
          ...card,
          border: "1.5px solid #333333",
          paddingTop: 14,
          paddingBottom: 14,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          
          <p style={{ margin: 0, marginBottom: 4 }}>
            ・受け渡し時間内にお越しください。
          </p>
          
          <p style={{ margin: 0, marginBottom: 8 }}>
            ・無断キャンセルをした場合、次回以降の購入が制限されることがあります。
          </p>

          <div style={{ fontWeight: 600, marginTop: 8, marginBottom: 4 }}>
            【キャンセルについて】
          </div>
          <p style={{ margin: 0, marginBottom: 4 }}>
            ・キャンセルされる場合は、受け渡し開始時刻までにお手続きをお願いします。
          </p>
          <p style={{ margin: 0, marginBottom: 4 }}>
            ・農家へのお支払い分（お米代）にはキャンセル料はかかりません。
          </p>
          <p style={{ margin: 0 }}>
            ※ 運営サポート費（300円）は返金されません。
          </p>
        </div>
      </section>

      {/* チェック */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: 14,  
          marginBottom: 0,
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 500,
            fontSize: 15, // 文字サイズを明示して読みやすく
          }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => onChange(e.target.checked)}
            style={{
              width: 18,
              height: 18,
              accentColor: "#4b3e2a", // こげ茶色
            }}
          />
          {/* ★修正: 枠内だけでなく「利用規約」全体への同意を明示 */}
          上記の内容、および利用規約に同意します
        </label>
      </div>

      {/* 法的保護のためのリンク文言 */}
      <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "#7a6c58", lineHeight: 1.6 }}>
        詳細なキャンセル・返品に関する規定等は<br />
        <a href="/law" target="_blank" rel="noopener noreferrer" style={{ color: "#4b3e2a", textDecoration: "underline" }}>特定商取引法に基づく表記</a> および <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#4b3e2a", textDecoration: "underline" }}>利用規約</a> をご確認ください。
      </div>
    </>
  );
}