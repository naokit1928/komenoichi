// frontend/src/pages/public/ReservationBooked/CancelActionCard.tsx

import React from "react";
import { useNavigate } from "react-router-dom";

type Props = {
  cancelActionUri: string | null;
};

const CancelActionCard: React.FC<Props> = ({ cancelActionUri }) => {
  const navigate = useNavigate();
  const disabled = !cancelActionUri;

  const handleClick = () => {
    if (!cancelActionUri) return;

    const url = new URL(cancelActionUri, window.location.origin);
    const token = url.searchParams.get("token");

    if (!token) {
      alert("キャンセル用トークンが見つかりません");
      return;
    }

    navigate(`/cancel/confirm?token=${token}`);
  };

  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#ffffff",
        padding: 14,
        marginBottom: 4,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
        キャンセル手続き
      </div>

      {disabled ? (
        <div style={{ fontSize: 13, color: "#b91c1c", lineHeight: 1.5, fontWeight: 500 }}>
          受け渡し時間を過ぎているため、システムからのキャンセルはできません。<br />
          お困りの場合は、直接農家へご相談ください。
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, marginBottom: 12, color: "#374151" }}>
            急用などで受け渡しに行けなくなった場合は、農家さんをお待たせしないよう、
            <strong style={{ color: "#111827" }}>受け渡し開始時刻までに</strong>
            下のボタンから手続きをお願いします。
          </div>
          <button
            onClick={handleClick}
            style={{
              display: "block",
              margin: "0 auto",
              maxWidth: 260,
              width: "100%",
              textAlign: "center",
              padding: "12px 16px",
              background: "#b91c1c",
              color: "#ffffff",
              border: "none",
              borderRadius: 9999,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            予約をキャンセルする
          </button>
        </>
      )}
    </section>
  );
};

export default CancelActionCard;