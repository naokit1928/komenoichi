// frontend/src/pages/public/ReservationBooked/CancelActionCard.tsx

import React from "react";

type Props = {
  cancelActionUri: string;
};

const CancelActionCard: React.FC<Props> = ({ cancelActionUri }) => {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#f9fafb", // 他カードより一段薄いグレー
        padding: 14,
        marginBottom: 4,
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
        キャンセル手続き
      </div>
      <div
        style={{
          fontSize: 13,
          color: "#374151",
          lineHeight: 1.7,
          marginBottom: 6,
        }}
      >
        この予約を取り消す場合は、下のボタンからキャンセル手続きが行えます。
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#6b7280",
          marginBottom: 12,
        }}
      >
        キャンセルを行っても、お米代のお支払いは発生しません。
        すでにお支払いいただいたシステム利用料（300円）は返金されません。
      </div>

      <a
        href={cancelActionUri}
        style={{
          display: "block",
          width: "100%",
          textAlign: "center",
          padding: "12px 16px",
          borderRadius: 9999,
          background: "#4b5563", // 濃いグレーでやや控えめ
          color: "#ffffff",
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        この予約をキャンセルする
      </a>
    </section>
  );
};

// ★ ここが重要：default export
export default CancelActionCard;
