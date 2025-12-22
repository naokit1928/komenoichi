type Line = {
  label: string;
  amount: number;
};

type Props = {
  riceSubtotal: number;
  lines: Line[];
};

export function RiceBreakdown({ riceSubtotal, lines }: Props) {
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
          fontWeight: 700,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
        <span>{money(riceSubtotal)}円</span>
      </div>

      <div>
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
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
