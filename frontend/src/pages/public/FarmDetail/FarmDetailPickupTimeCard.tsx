type Props = {
  pickupTextCard: string;
};

export default function FarmDetailPickupTimeCard({ pickupTextCard }: Props) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        background: "#fff",
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          次回受け渡し日時
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: "#111827",
          }}
        >
          {pickupTextCard}
        </div>
      </div>
    </div>
  );
}
