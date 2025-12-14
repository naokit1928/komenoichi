// frontend/src/pages/public/ReservationBooked/CancelActionCard.tsx
import React from "react";

type Props = {
  cancelActionUri: string | null;
};

const CancelActionCard: React.FC<Props> = ({ cancelActionUri }) => {
  const disabled = !cancelActionUri;

  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#f9fafb",
        padding: 14,
        marginBottom: 4,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        キャンセル手続き
      </div>

      <div style={{ fontSize: 13, marginBottom: 12 }}>
        この予約を取り消す場合は、下のボタンから手続きできます。
      </div>

      {disabled ? (
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          この予約はキャンセルできません。
        </div>
      ) : (
        <a
          href={cancelActionUri}
          style={{
            display: "block",
            width: "100%",
            textAlign: "center",
            padding: "12px 16px",
            borderRadius: 9999,
            background: "#b91c1c",
            color: "#ffffff",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          この予約をキャンセルする
        </a>
      )}
    </section>
  );
};

export default CancelActionCard;
