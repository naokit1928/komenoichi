import React from "react";

// ── Brand tokens ──────────────────────────────────
const C = {
  gold:      "#C49A1A",
  goldLight: "rgba(196,154,26,0.06)", // アクティブ時の淡い背景
  goldBorder:"rgba(196,154,26,0.3)",
  ink:       "#1a1108",
  ink3:      "#7a6c58", 
  border:    "#e8e2d8",
  bgPale:    "#f8f9fa", 
} as const;

type Kg = 5 | 10 | 25;

type Size = {
  kg: Kg;
  label: string;
  price: number | null;
};

type Props = {
  loading: boolean;
  errorMsg: string | null;
  sizes: readonly Size[];
  selectedKg: Kg;
  qtyByKg: { 5: number; 10: number; 25: number };
  onSelectKg: (kg: Kg) => void;
  onInc: (kg: Kg) => void;
  onDec: (kg: Kg) => void;
  money: (n: number) => string;
};

export default function FarmDetailPriceCard({
  loading,
  errorMsg,
  sizes,
  selectedKg,
  qtyByKg,
  onSelectKg,
  onInc,
  onDec,
  money,
}: Props) {
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0", color: "#6b7280" }}>
        読み込み中...
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0", color: "#b91c1c" }}>
        {errorMsg}
      </div>
    );
  }

  return (
    <>
      <div className="price-card-container">
        {sizes.map((s) => {
          const active = selectedKg === s.kg;
          const disabled = s.price == null;

          return (
            <div
              key={s.kg}
              className="price-card"
              role={disabled ? undefined : "button"}
              tabIndex={disabled ? -1 : 0}
              onClick={() => !disabled && onSelectKg(s.kg)}
              onKeyDown={(e) => {
                if (!disabled && (e.key === "Enter" || e.key === " ")) {
                  onSelectKg(s.kg);
                }
              }}
              style={{
                border: active ? `1px solid ${C.gold}` : `1px solid ${C.border}`,
                boxShadow: active ? `0 0 0 1px rgba(196,154,26,0.15)` : "none",
                background: active ? C.goldLight : "#fff",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ width: "100%" }}>
                {/* ラベル（白米○kg）：元の15pxに戻して横幅を節約 */}
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: active ? 700 : 500,
                    color: C.ink,
                    transition: "font-weight 0.15s",
                  }}
                >
                  {s.label}
                </div>
                
                {/* 金額：元の14〜15px感に戻す */}
                <div
                  style={{
                    fontSize: 14,
                    marginTop: 4,
                    color: active ? C.ink : C.ink3,
                    fontWeight: 500,
                  }}
                >
                  {s.price != null ? `${money(s.price)}円` : "未設定"}
                </div>
                
                {/* 選択中バッジ：空間を圧迫しないようスリムに */}
                <div style={{ marginTop: 6, minHeight: 20 }}>
                  {!disabled && active && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 999,
                        background: "#fff", 
                        color: C.gold,
                        border: `1px solid ${C.goldBorder}`,
                        fontWeight: 700,
                        display: "inline-block",
                      }}
                    >
                      選択中
                    </span>
                  )}
                </div>
              </div>

              {/* ── ステッパー（＋ / −）領域 ── */}
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  background: "#fff",
                  padding: 2,
                  borderRadius: 6,
                  border: active ? `1px solid rgba(196,154,26,0.2)` : `1px solid ${C.border}`,
                }}
              >
                {/* マイナスボタン（元の26pxに戻す） */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) onDec(s.kg);
                  }}
                  disabled={disabled || qtyByKg[s.kg] === 0}
                  style={{
                    width: 26,
                    height: 26,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    border: "none",
                    borderRadius: 4,
                    background: qtyByKg[s.kg] > 0 ? C.bgPale : "transparent",
                    color: qtyByKg[s.kg] > 0 ? C.ink : "#d1d5db", 
                    cursor: disabled || qtyByKg[s.kg] === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>

                {/* 数量（横幅を削る） */}
                <span style={{ fontSize: 15, fontWeight: 700, width: 20, textAlign: "center", color: C.ink }}>
                  {qtyByKg[s.kg]}
                </span>

                {/* プラスボタン（元の26pxに戻す） */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) onInc(s.kg);
                  }}
                  disabled={disabled}
                  style={{
                    width: 26,
                    height: 26,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    border: "none",
                    borderRadius: 4,
                    background: C.bgPale,
                    color: C.ink,
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .price-card-container {
          margin-bottom: 12px;
          display: flex;
          gap: 8px; /* 10pxから8pxに減らしてスマホでの収まりを優先 */
          overflow-x: auto;
          padding-bottom: 4px;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory;
        }

        .price-card {
          background: #fff;
          border-radius: 12px;
          padding: 12px 6px; /* 横の余白を削ってスリムに */
          min-height: 126px; /* 元の高さに戻す */
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          text-align: center;
          flex: 1 1 0; /* 3等分で画面にピッタリ収まるように計算 */
          min-width: 80px; /* 安全な最小幅 */
          max-width: 140px;
          scroll-snap-align: start;
        }

        @media (min-width: 768px) {
          .price-card-container {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            overflow-x: visible;
            padding-bottom: 0;
            scroll-snap-type: none;
          }
          .price-card {
            max-width: none;
            scroll-snap-align: unset;
          }
        }
      `}</style>
    </>
  );
}