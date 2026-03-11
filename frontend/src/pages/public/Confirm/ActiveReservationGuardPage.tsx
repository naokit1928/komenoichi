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
        paddingTop: 36,
        paddingBottom: 48,
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 24px" }}>
        <section
          style={{
            position: "relative",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 4, // 少し太く
              borderTopLeftRadius: 12,
              borderBottomLeftRadius: 12,
              background: "rgba(196,154,26,0.30)", // ★ 黄金色へ
            }}
          />

          <div style={{ fontSize: 14, lineHeight: 1.7, color: "#111827", marginBottom: 28 }}>
            すでに確定しているご予約があります。<br />
            次のご予約は、現在のご予約分の受け取りを完了後、もしくはキャンセル後に行うことができます。
          </div>

          <button
            onClick={() => navigate("/reservations")} // ★ ここを "/reservations" に変更しました
            style={{
              display: "block",
              maxWidth: 360,
              width: "100%",
              margin: "0 auto",
              padding: "12px 16px",
              background: "#4b3e2a", // ★ 緑から濃い茶色へ
              color: "#fff",
              borderRadius: 9999,
              border: "none",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
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
                margin: "12px auto 0",
                padding: "10px 16px",
                background: "#fff",
                color: "#111827",
                borderRadius: 9999,
                border: "1px solid #e5e7eb",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              農家詳細に戻る
            </button>
          )}
        </section>
      </div>
    </div>
  );
}