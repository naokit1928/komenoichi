import React, { useState } from "react";
import ReactDOM from "react-dom";

export type TimeSlotOption = "WED_19_20" | "SAT_10_11";

const OPTIONS: { id: TimeSlotOption; label: string; subLabel: string }[] = [
  { id: "WED_19_20", label: "毎週水曜 19:00–20:00", subLabel: "" },
  { id: "SAT_10_11", label: "毎週土曜 10:00–11:00", subLabel: "" },
];

export default function PickupTimeCardForRegistration({
  value,
  onSave,
}: {
  value: TimeSlotOption | null;
  onSave: (slot: TimeSlotOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = OPTIONS.find((o) => o.id === value) ?? null;

  return (
    <section className="w-full" style={{ marginTop: 24 }}>
      {/* カード本体 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid rgba(0, 0, 0, 0.07)",
          borderRadius: 24,
          padding: "32px 28px",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.04)",
          cursor: "pointer",
          textAlign: "center",
        }}
      >
        <div className="flex flex-col items-center">
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            受け取り日時
          </div>

          <div
            style={{
              marginTop: 6,
              fontSize: selected ? 26 : 20,
              fontWeight: selected ? 800 : 500,
              color: selected ? "#111827" : "#9CA3AF",
            }}
          >
            {selected ? selected.label : "受け取り日時を選択"}
          </div>
        </div>
      </button>

      {/* モーダル */}
      {open &&
        ReactDOM.createPortal(
          <>
            {/* 黒背景 */}
            <div
              onClick={() => setOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.75)",
                zIndex: 9998,
              }}
            />

            <div
              role="dialog"
              aria-modal="true"
              className="fixed left-1/2 top-1/2 z-[9999] -translate-x-1/2 -translate-y-1/2"
              style={{
                width: "min(560px, 92vw)",
                borderRadius: 28,
                background: "#FFFFFF",
                boxShadow: "0 28px 70px rgba(0,0,0,.32)",
                padding: "22px 18px 18px",
              }}
            >
              <div className="flex items-start justify-between">
                <div
                  className="text-gray-800"
                  style={{ fontSize: 16, fontWeight: 700 }}
                >
                  受け取り日時を選択
                </div>

                <button
                  aria-label="閉じる"
                  onClick={() => setOpen(false)}
                  style={{ background: "transparent", border: "none" }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24">
                    <path
                      d="M18 6L6 18M6 6l12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              <div style={{ marginTop: 14 }} className="space-y-3">
                {OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onSave(opt.id);
                      setOpen(false);
                    }}
                    style={{
                      borderRadius: 16,
                      border: "1px solid rgba(0,0,0,0.12)",
                      padding: "12px 14px",
                      textAlign: "left",
                      background: "#FFFFFF",
                      width: "100%",
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 700 }}>
                      {opt.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body
        )}
    </section>
  );
}
