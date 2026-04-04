// frontend/src/pages/public/ReservationBooked/CancelActionCard.tsx

import React from "react";
import { useNavigate } from "react-router-dom";

type Props = {
  cancelActionUri: string | null;
  eventStartAt?: string | null; // 受け渡し開始時刻（ISO文字列）。親から渡す
};

const CancelActionCard: React.FC<Props> = ({ cancelActionUri, eventStartAt }) => {
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

    // event_start_at を一緒に渡してCancelConfirmPage側で時間判定する
    const dest = eventStartAt
      ? `/cancel/confirm?token=${token}&event_start_at=${encodeURIComponent(eventStartAt)}`
      : `/cancel/confirm?token=${token}`;

    navigate(dest);
  };

  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#ffffff",
        padding: 16,
        marginBottom: 4,
        marginTop: 38,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        キャンセル手続き
      </div>

      {disabled ? (
        <div style={{ fontSize: 13, color: "#b91c1c", lineHeight: 1.5, fontWeight: 500 }}>
          受け渡し時間を過ぎているため、システムからのキャンセルはできません。<br />
          お困りの場合は、直接農家へご相談ください。
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, marginBottom: 24, color: "#374151", lineHeight: 1.6 }}>
            {/* ★ 校正済み文言 */}
            農家さんは受け渡し日に合わせて事前に精米しています。やむを得ずキャンセルされる場合は、農家さんへのご配慮として
            <strong style={{ color: "#111827" }}>受け渡しの3時間前まで</strong>
            にお手続きください。
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
              boxShadow: "0 2px 4px rgba(185, 28, 28, 0.2)",
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
