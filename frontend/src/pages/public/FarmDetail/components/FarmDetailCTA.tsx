type Props = {
  riceSubtotal: number;
  pickupTextCTA: string; // ← 使わないが契約維持
  onNext: () => void;
  money: (n: number) => string;
  disabled: boolean;
  isOverLimit: boolean;
};

export default function FarmDetailCTA({
  riceSubtotal,
  pickupTextCTA, // ← unused（将来用）
  onNext,
  money,
  disabled,
  isOverLimit,
}: Props) {
  /**
   * 「予約内容を確認」クリック時のハンドラ
   *
   * 目的：
   * - DETAIL PAGE を通過した時刻を保存する
   * - CONFIRM PAGE 側で
   *   「通過時は3時間前／確定時は3時間以内」
   *   のケースだけを検出するため
   *
   * 注意：
   * - 表示ロジックや締切判定は一切ここでは行わない
   * - 既存挙動（通過可否）は変えない
   */
  const handleNext = () => {
    try {
      sessionStorage.setItem(
        "detail_passed_at",
        new Date().toISOString()
      );
    } catch {
      // sessionStorage が使えなくても致命ではないため無視
    }

    onNext();
  };

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
        {/* ===== 左：金額情報 ===== */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            お米代合計
          </div>

          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {money(riceSubtotal)}円
          </div>

          {isOverLimit && (
            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                color: "#b91c1c",
              }}
            >
              ※ 注文は合計50kgまでです
            </div>
          )}
        </div>

        {/* ===== 右：CTA ===== */}
        <button
          onClick={handleNext}
          disabled={disabled}
          style={{
            minWidth: "clamp(140px, 45vw, 184px)",
            padding: "11px 16px",
            background: disabled ? "#9ca3af" : "#1f7a36",
            color: "#fff",
            borderRadius: 9999,
            border: "none",
            fontWeight: 600,
            fontSize: 15,
            cursor: disabled ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          予約内容を確認
        </button>
      </div>
    </div>
  );
}
