type Props = {
  serviceFee: number;
  termLabel: string;
};

export function ServiceFeeCard({ serviceFee, termLabel }: Props) {
  const money = (n: number) => n.toLocaleString("ja-JP");

  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
        marginBottom: 12,
        borderWidth: 2,
        borderColor: "rgba(31,122,54,0.55)",
      }}
    >
      {/* ===== 1行目：費目 × 金額 ===== */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontWeight: 700,
          fontSize: 16,
          marginBottom: 6,
        }}
      >
        <span>{termLabel}</span>
        <span>{money(serviceFee)}円</span>
      </div>

      {/* ===== 2行目：状態バッジ（情報集約） ===== */}
      <div>
        <span
          style={{
            display: "inline-block",
            background: "rgba(31,122,54,0.1)",
            color: "#1f7a36",
            borderRadius: 9999,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          今すぐStripeを通じてオンラインで支払い
        </span>
      </div>
    </section>
  );
}
