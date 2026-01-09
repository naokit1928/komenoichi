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
            ・受け渡し開始の3時間前までキャンセルできます。
          </p>
          <p style={{ margin: 0, marginBottom: 4 }}>
            ・農家へのお支払い分にはキャンセル料はかかりません。
          </p>
          <p style={{ margin: 0 }}>
            ※ システム利用料（300円）は返金されません。
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
          }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => onChange(e.target.checked)}
            style={{
              width: 18,
              height: 18,
              accentColor: "#1f7a36",
            }}
          />
          上記に同意します
        </label>
      </div>
    </>
  );
}
