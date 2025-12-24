type Line = {
  label: string;
  amount: number;
};

type Props = {
  riceSubtotal: number;
  lines: Line[];
  pickupDisplay?: string | null;
};

export function RiceBreakdown({
  riceSubtotal,
  lines,
  pickupDisplay,
}: Props) {
  const money = (n: number) => n.toLocaleString("ja-JP");

  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
        marginBottom: 12,
      }}
    >
      {/* ===== 受け取り日時（最優先） ===== */}
      {pickupDisplay && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginBottom: 2,
            }}
          >
            受け取り日時
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#111827",
              whiteSpace: "nowrap",
            }}
          >
            {pickupDisplay}
          </div>
        </div>
      )}

      {/* ===== お米代ヘッダー ===== */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 2,
        }}
      >
        <span>お米代</span>
        <span
          style={{
            background: "#f3f4f6",
            color: "#374151",
            borderRadius: 9999,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          当日現地払い
        </span>
      </div>

      {/* ===== 合計金額（主役） ===== */}
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          marginBottom: 8,
        }}
      >
        {money(riceSubtotal)}円
      </div>

      {/* ===== 内訳（小計） ===== */}
      <div>
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 14,
              color: "#374151",
              marginTop: 2,
            }}
          >
            <span>{l.label}</span>
            <span>{money(l.amount)}円</span>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 8,
          color: "#6b7280",
          fontSize: 12,
        }}
      >
        ※ 受け渡し当日に、農家さんへ現金でお支払いください。
      </div>
    </section>
  );
}
