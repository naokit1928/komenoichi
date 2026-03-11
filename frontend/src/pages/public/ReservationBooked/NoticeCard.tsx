// frontend/src/pages/public/ReservationBooked/NoticeCard.tsx

import React from "react";

const NoticeCard: React.FC = () => {
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
        ご利用上の注意
      </div>
      <ul
        style={{
          paddingLeft: 18,
          margin: 0,
          listStyle: "disc",
          fontSize: 12,
          color: "#111827",
          lineHeight: 1.7,
        }}
      >
        <li style={{ marginBottom: 6 }}>
          精米・袋づめのため、当日はお渡しまでに
          <strong style={{ fontWeight: 700, color: "#111827" }}>
            10分ほどお待ちいただく場合があります。
          </strong>
        </li>
        <li>
          農家と購入者は対等なパートナーです。お互いに思いやりを持った、気持ちの良いお取引をお願いいたします。
        </li>
      </ul>
    </section>
  );
};

export default NoticeCard;