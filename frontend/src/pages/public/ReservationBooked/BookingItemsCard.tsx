// frontend/src/pages/public/ReservationBooked/BookingItemsCard.tsx

import React from "react";

type Props = {
  items: string[];
};

const BookingItemsCard: React.FC<Props> = ({ items }) => {
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
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#111827",
            marginBottom: 4,
          }}
        >
          ご予約内容
        </div>
        {items.length > 0 ? (
          <ul
            style={{
              paddingLeft: 18,
              margin: 0,
              listStyle: "disc",
              fontSize: 13,
              color: "#111827",
              lineHeight: 1.6,
            }}
          >
            {items.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            ご予約内容は登録されていません。
          </div>
        )}
      </div>
    </section>
  );
};

export default BookingItemsCard;
