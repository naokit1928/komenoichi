// frontend/src/pages/public/ReservationBooked/PickupSummaryCard.tsx

import React, { useState, useEffect } from "react";

type Props = {
  pickupDisplay: string;
  pickupPlaceName: string | null;
  pickupMapUrl: string | null;
  farmerPhone?: string | null;
  eventStartAt: string | null; // ISO文字列
};

// 3-4-4 形式に整形（090-1234-5678）
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

// 3時間以内判定ヘルパー
function isWithinThreeHours(eventStartAt: string | null): boolean {
  if (!eventStartAt) return false;
  const start = new Date(eventStartAt).getTime();
  const now = Date.now();
  // 開始3時間前以降であれば連絡可能（遅刻対応のため終了後も含む）
  return start - now < 3 * 60 * 60 * 1000;
}

// ── スタイル定義 ──────────────────────────────
const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#6b7280",
  letterSpacing: "0.04em",
};

const valueStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 15,
  fontWeight: 700,
  color: "#111827",
};

const valueSubStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 14,
  color: "#111827",
};

const SECTION_GAP = 22;

const PickupSummaryCard: React.FC<Props> = ({
  pickupDisplay,
  pickupPlaceName,
  pickupMapUrl,
  farmerPhone,
  eventStartAt,
}) => {
  const [showPhoneSection, setShowPhoneSection] = useState(false);

  // 時間判定の定期チェック
  useEffect(() => {
    if (!eventStartAt) return;

    const check = () => {
      setShowPhoneSection(isWithinThreeHours(eventStartAt));
    };

    check();
    const timer = setInterval(check, 60000); // 1分ごとにチェック
    return () => clearInterval(timer);
  }, [eventStartAt]);

  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#ffffff",
        padding: 16,
        marginBottom: 14,
      }}
    >
      {/* ── 受け渡し日時 ── */}
      <div>
        <div style={labelStyle}>受け渡し日時</div>
        <div style={valueStyle}>{pickupDisplay}</div>
      </div>

      {/* ── 受け渡し場所 ── */}
      <div style={{ marginTop: SECTION_GAP }}>
        <div style={labelStyle}>受け渡し場所</div>
        <div style={valueSubStyle}>{pickupPlaceName || "未設定"}</div>

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
                background: "#111827",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: 13,
                padding: "8px 14px",
                borderRadius: 9999,
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              Googleマップで開く
            </a>
          </div>
        )}
      </div>

      {/* ── 当日の連絡先（3時間以内のみ出現） ── */}
      {farmerPhone && showPhoneSection && (
        <div style={{ marginTop: SECTION_GAP, paddingTop: 16, borderTop: "1px solid #f3f4f6" }}>
          <div style={labelStyle}>当日の連絡先</div>
          <div style={{ marginTop: 6 }}>
            <a
              href={`tel:${farmerPhone}`}
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#2563eb",
                textDecoration: "none",
                letterSpacing: "0.05em",
              }}
            >
              {formatPhone(farmerPhone)}
            </a>
          </div>
        </div>
      )}
    </section>
  );
};

export default PickupSummaryCard;