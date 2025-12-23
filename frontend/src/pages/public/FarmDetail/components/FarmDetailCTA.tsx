type Props = {
  riceSubtotal: number;
  pickupTextCTA: string;
  onNext: () => void;
  money: (n: number) => string;
  disabled: boolean;
  isOverLimit: boolean;
};

export default function FarmDetailCTA({
  riceSubtotal,
  pickupTextCTA,
  onNext,
  money,
  disabled,
  isOverLimit,
}: Props) {
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        background: "#ffffff",
        borderTop: "1px solid #e5e7eb",
        boxShadow: "0 -4px 12px rgba(0,0,0,0.06)",
        padding: "16px 22px",
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 16,
          paddingLeft: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            お米代合計
          </div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {money(riceSubtotal)}円
          </div>

          {isOverLimit ? (
            <div style={{ marginTop: 4, fontSize: 13, color: "#b91c1c" }}>
              ※ 注文は合計50kgまでです
            </div>
          ) : (
            <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>
              {pickupTextCTA}
            </div>
          )}
        </div>

        <button
          onClick={onNext}
          disabled={disabled}
          style={{
            minWidth: 184,
            padding: "11px 16px",
            background: disabled ? "#9ca3af" : "#1f7a36",
            color: "#fff",
            borderRadius: 9999,
            border: "none",
            fontWeight: 600,
            fontSize: 15,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          予約内容を確認
        </button>
      </div>
    </div>
  );
}
