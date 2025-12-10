// src/components/FarmDetailPriceCard.tsx
import React from "react";

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
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        background: "#fff",
        padding: 14,
        marginBottom: 12,
      }}
    >
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "24px 0",
            color: "#6b7280",
          }}
        >
          読み込み中...
        </div>
      ) : errorMsg ? (
        <div
          style={{
            textAlign: "center",
            padding: "24px 0",
            color: "#b91c1c",
          }}
        >
          {errorMsg}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}
        >
          {sizes.map((s) => {
            const active = selectedKg === s.kg;
            const disabled = s.price == null;
            return (
              <div
                key={s.kg}
                role={disabled ? undefined : "button"}
                tabIndex={disabled ? -1 : 0}
                onClick={() => !disabled && onSelectKg(s.kg)}
                onKeyDown={(e) => {
                  if (
                    !disabled &&
                    (e.key === "Enter" || e.key === " ")
                  ) {
                    onSelectKg(s.kg);
                  }
                }}
                title={disabled ? "価格未設定" : `${s.label}を選択`}
                style={{
                  border: active
                    ? "1px solid #1f7a36"
                    : "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 14,
                  minHeight: 126,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  alignItems: "center",
                  textAlign: "center",
                  boxShadow: active ? "0 0 0 2px #bbf7d0" : "none",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    {s.label}
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      color: "#374151",
                      marginTop: 4,
                    }}
                  >
                    {s.price != null ? `${money(s.price)}円` : "未設定"}
                  </div>
                  {!disabled && active && (
                    <div
                      style={{
                        marginTop: 8,
                        display: "inline-block",
                        fontSize: 12,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "#ecfdf5",
                        color: "#166534",
                        border: "1px solid #a7f3d0",
                      }}
                    >
                      選択中
                    </div>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!disabled) onDec(s.kg);
                    }}
                    aria-label={`${s.label}の数量を1減らす`}
                    title="−"
                    disabled={disabled}
                    style={{
                      width: 30,
                      height: 30,
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      background: "#fff",
                    }}
                  >
                    −
                  </button>
                  <span
                    aria-live="polite"
                    style={{
                      minWidth: 18,
                      textAlign: "center",
                      fontSize: 14,
                    }}
                  >
                    {qtyByKg[s.kg]}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!disabled) onInc(s.kg);
                    }}
                    aria-label={`${s.label}の数量を1増やす`}
                    title="+"
                    disabled={disabled}
                    style={{
                      width: 30,
                      height: 30,
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
      )}
    </div>
  );
}
