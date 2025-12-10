// frontend/src/pages/public/ReservationBooked/ReservationCodeCard.tsx

import React from "react";

type Props = {
  pickupCode: string | null;
};

const ReservationCodeCard: React.FC<Props> = ({ pickupCode }) => {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#ffffff",
        padding: 14,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#111827",
          marginBottom: 6,
        }}
      >
        予約コード
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: "0.35em",
          color: "#111827",
        }}
      >
        {pickupCode || "-"}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 11,
          color: "#6b7280",
        }}
      >
        当日、農家さんにこの番号をお伝えください。
      </div>
    </section>
  );
};

export default ReservationCodeCard;
