// frontend/src/pages/public/ReservationBooked/PaymentSummaryCard.tsx

import React from "react";

type Props = {
  riceSubtotalText: string;
};

const PaymentSummaryCard: React.FC<Props> = ({ riceSubtotalText }) => {
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
          borderTop: "none",
          paddingTop: 0,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#111827",
            marginBottom: 4,
          }}
        >
          お支払い金額
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#111827",
          }}
        >
          お米代合計：{riceSubtotalText}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            color: "#6b7280",
          }}
        >
          当日は現金でのお支払いとなります。
        </div>
      </div>
    </section>
  );
};

export default PaymentSummaryCard;
