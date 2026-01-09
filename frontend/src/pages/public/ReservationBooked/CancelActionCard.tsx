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

    // cancelActionUri は
    // /api/reservation/cancel?token=xxxx
    // の想定なので token だけ抜く
    const url = new URL(cancelActionUri, window.location.origin);
    const token = url.searchParams.get("token");

    if (!token) {
      alert("キャンセル用トークンが見つかりません");
      return;
    }

    // フロントのキャンセル確認ページへ遷移
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

      <div style={{ fontSize: 13, marginBottom: 12 }}>
        この予約を取り消す場合は、下のボタンから手続きできます。
      </div>

      {disabled ? (
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          この予約はキャンセルできません。
        </div>
      ) : (
        <button
          onClick={handleClick}
          style={{
            display: "block",
            margin: "0 auto",
            maxWidth: 260,
            width: "100%",
            textAlign: "center",
            padding: "11px 16px",
            borderRadius: 9999,
            background: "#b91c1c",
            color: "#ffffff",
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          この予約をキャンセルする
        </button>
      )}
    </section>
  );
};

export default CancelActionCard;
