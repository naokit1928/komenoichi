// frontend/src/pages/public/ReservationBooked/PickupSummaryCard.tsx

import React from "react";

type Props = {
  pickupDisplay: string;
  pickupPlaceName: string | null;
  pickupMapUrl: string | null;
};

const PickupSummaryCard: React.FC<Props> = ({
  pickupDisplay,
  pickupPlaceName,
  pickupMapUrl,
}) => {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#ffffff", // ← 他カードと完全統一
        padding: 14,
        marginBottom: 14,
      }}
    >
      {/* 受け渡し日時 */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#6b7280",
            letterSpacing: "0.04em",
          }}
        >
          受け渡し日時
        </div>

        <div
          style={{
            marginTop: 4,
            fontSize: 15,
            fontWeight: 700,
            color: "#111827",
          }}
        >
          {pickupDisplay}
        </div>
      </div>

      {/* 受け渡し場所 */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#6b7280",
            letterSpacing: "0.04em",
          }}
        >
          受け渡し場所
        </div>

        <div
          style={{
            marginTop: 4,
            fontSize: 14,
            color: "#111827",
          }}
        >
          {pickupPlaceName || "未設定"}
        </div>

        {/* Googleマップボタン */}
        {pickupMapUrl && (
          <div style={{ marginTop: 10 }}>
            <a
              href={pickupMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#1f7a36",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: 13,          // ← 少し小さく
                padding: "8px 14px",   // ← 少し小さく
                borderRadius: 9999,
                textDecoration: "none",
                border: "none",
                outline: "none",
                boxShadow: "none",
                cursor: "pointer",
              }}
            >
              Googleマップで開く
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

export default PickupSummaryCard;
