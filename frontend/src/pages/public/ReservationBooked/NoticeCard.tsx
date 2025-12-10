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
        <li>
          精米・袋づめのため、当日はお渡しまでに10分ほどお待ちいただく場合があります。
        </li>
        <li>
          来られなくなった場合は、受け渡し開始の3時間前までにキャンセル手続きを行ってください。
        </li>
      </ul>
    </section>
  );
};

export default NoticeCard;
