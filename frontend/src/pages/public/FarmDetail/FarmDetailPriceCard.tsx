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
                border: active
                  ? "1px solid #1f7a36"
                  : "1px solid #e5e7eb",
                boxShadow: active ? "0 0 0 2px #bbf7d0" : "none",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: 15, marginTop: 4 }}>
                  {s.price != null ? `${money(s.price)}円` : "未設定"}
                </div>
                <div style={{ marginTop: 8, minHeight: 20 }}>
                  {!disabled && active && (
                    <span
                      style={{
                        fontSize: 12,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "#ecfdf5",
                        color: "#166534",
                        border: "1px solid #a7f3d0",
                      }}
                    >
                      選択中
                    </span>
                  )}
                </div>
              </div>

              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) onDec(s.kg);
                  }}
                  disabled={disabled}
                  style={{
                    width: 26,
                    height: 26,
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    background: "#fff",
                  }}
                >
                  −
                </button>
                <span style={{ width: 14, textAlign: "center" }}>
                  {qtyByKg[s.kg]}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) onInc(s.kg);
                  }}
                  disabled={disabled}
                  style={{
                    width: 26,
                    height: 26,
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    background: "#fff",
                  }}
                >
                  ＋
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .price-card-container {
          margin-bottom: 12px;
        }

        .price-card {
          background: #fff;
          border-radius: 12px;
          padding: 14px;
          min-height: 126px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          text-align: center;
        }

        /* ===== 391px以上：3枚ちょうど自然に並ぶ ===== */
        @media (min-width: 391px) {
          .price-card-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
            gap: 10px;
          }
        }

        /* ===== 390px以下：横スライド ===== */
        @media (max-width: 390px) {
          .price-card-container {
            display: flex;
            gap: 10px;
            overflow-x: auto;
            padding-bottom: 4px;
            -webkit-overflow-scrolling: touch;
            scroll-snap-type: x mandatory;
          }

          .price-card {
            flex: 0 0 140px;
            scroll-snap-align: start;
          }
        }
      `}</style>
    </>
  );
}
