// frontend/src/pages/public/ReservationBooked/MemoCard.tsx

import React from "react";

type Props = {
  memo: string | null;
};

const MemoCard: React.FC<Props> = ({ memo }) => {
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
        農家からの注意事項
      </div>
      {memo ? (
        <div
          style={{
            fontSize: 13,
            color: "#111827",
            whiteSpace: "pre-wrap",
            lineHeight: 1.7,
          }}
        >
          {memo}
        </div>
      ) : (
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          特記事項はありません。
        </div>
      )}
    </section>
  );
};

export default MemoCard;
