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
      {/* ラベル（常に1行目） */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 400, // 太字にしない
          color: "#6b7280", // 少し薄め
          marginBottom: 4,
        }}
      >
        次回受け渡し日時
      </div>

      {/* 日時（常に2行目） */}
      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: "#111827",
          lineHeight: 1.4,
          wordBreak: "keep-all",
        }}
      >
        {pickupTextCard}
      </div>
    </div>
  );
}
