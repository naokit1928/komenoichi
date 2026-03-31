import React from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function ActiveReservationGuardPage() {
  const navigate = useNavigate();
  const { farmId } = useParams();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f9fafb",
        paddingTop: 48,
        paddingBottom: 48,
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 24px" }}>
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: "32px 20px",
            background: "#fff",
            boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
          }}
        >
          {/* ★ 中央揃えを廃止（左揃え）し、理由を太字で強調 */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 16, fontWeight: 550, color: "#111827", marginBottom: 12 }}>
              すでに確定しているご予約があります。
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: "#374151" }}>
              次のご予約は、現在のご予約分の受け取りを完了後、もしくはキャンセル後に行うことができます。
            </div>
          </div>

          <button
            onClick={() => navigate("/reservations")}
            style={{
              display: "block",
              maxWidth: 360,
              width: "100%",
              margin: "0 auto",
              padding: "14px 16px",
              background: "#111827",
              color: "#fff",
              borderRadius: 9999,
              border: "none",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              transition: "transform 0.1s ease, box-shadow 0.1s ease",
              boxShadow: "0 4px 12px rgba(17,24,39,0.2)",
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "scale(0.98)";
              e.currentTarget.style.boxShadow = "0 2px 6px rgba(17,24,39,0.2)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(17,24,39,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(17,24,39,0.2)";
            }}
          >
            現在の予約を確認する
          </button>

          {farmId && (
            <button
              onClick={() => navigate(`/farms/${farmId}`)}
              style={{
                display: "block",
                maxWidth: 360,
                width: "100%",
                margin: "16px auto 0",
                padding: "14px 16px",
                background: "#fff",
                color: "#111827",
                borderRadius: 9999,
                border: "1px solid #d1d5db",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
                transition: "background 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              農家詳細に戻る
            </button>
          )}
        </section>
      </div>
    </div>
  );
}