import React from "react";

type Props = {
  onGoBooked: () => void;
};

export default function ActiveReservationGuardCard({
  onGoBooked,
}: Props) {
  return (
    <section
      style={{
        position: "relative",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
        marginBottom: 12,
      }}
    >
      {/* 左アクセント（控えめな注意表現） */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3, // ← 少し細く
          borderTopLeftRadius: 12,
          borderBottomLeftRadius: 12,
          background: "rgba(234,179,8,0.30)",
        }}
      />

      {/* 本文 */}
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.7,
          color: "#111827",
          marginBottom: 16,
        }}
      >
        すでに確定しているご予約があります。
        <br />
        次のご予約は、現在のご予約を受け取ったあと、
        もしくはキャンセル後に行うことができます。
      </div>

      {/* CTA（補助アクション） */}
      <button
        onClick={onGoBooked}
        style={{
          display: "block",
          maxWidth: 360,
          width: "100%",
          margin: "0 auto",
          padding: "12px 16px",
          background: "#1f7a36",
          color: "#fff",
          borderRadius: 9999,
          border: "none",
          fontWeight: 600,
          fontSize: 15,
        }}
      >
        現在の予約を確認する
      </button>
    </section>
  );
}
