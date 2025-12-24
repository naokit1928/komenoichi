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

      {/* ===== お米代合計 ===== */}
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
        <span>お米代合計</span>
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

      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          marginBottom: 12, // ← 注文内容との段差
        }}
      >
        {money(riceSubtotal)}円
      </div>

      {/* ===== 注文内容 ===== */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 6,
          color: "#374151",
        }}
      >
        注文内容
      </div>

      <div>
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 15,          // ← 少しだけ格上げ
              fontWeight: 500,
              color: "#111827",
              padding: "4px 0",      // ← 行間を確保
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
        ※ 受け渡し当日に、農家さんに現金でお支払いください。
      </div>
    </section>
  );
}
