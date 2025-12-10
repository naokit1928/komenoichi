// frontend/src/features/farmer-pickup/PickupTimeCard.tsx
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";

export type TimeSlotOption = "WED_19_20" | "SAT_10_11";

type Props = {
  value?: TimeSlotOption | null;
  onChange?: (v: TimeSlotOption) => void;
  onSave?: (v: TimeSlotOption) => void | Promise<void>;
  saving?: boolean;
  disabled?: boolean;
  className?: string;
  /** 変更不可の理由をカード内に表示（任意） */
  cannotChangeReason?: string;
};

/* ===== 時間枠の一覧 ===== */
const OPTIONS: { id: TimeSlotOption; label: string; subLabel: string }[] = [
  {
    id: "WED_19_20",
    label: "毎週水曜 19:00–20:00",
    subLabel: "平日夜に受け取りたい方向け",
  },
  {
    id: "SAT_10_11",
    label: "毎週土曜 10:00–11:00",
    subLabel: "週末の午前中に受け取りたい方向け",
  },
];

/* ===== 共通ユーティリティ ===== */
function useDisableScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [active]);
}

const cardBaseStyle: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  border: "1px solid rgba(0, 0, 0, 0.07)",
  borderRadius: 24,
  padding: "32px 28px",
  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.04)",
  cursor: "pointer",
  textAlign: "center",
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  letterSpacing: ".01em",
  color: "#111827",
};

/* =====================
   モーダル（下書き draft を内部に持つ版）
===================== */
function PickupTimeModal({
  open,
  initialValue,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  initialValue: TimeSlotOption | null;
  onClose: () => void;
  onConfirm: (v: TimeSlotOption) => void | Promise<void>;
  busy: boolean;
}) {
  useDisableScroll(open);

  // モーダル内だけで使う「仮選択値」
  const [draft, setDraft] = useState<TimeSlotOption | null>(
    initialValue ?? null
  );

  // モーダルを開くたびに initialValue から draft を初期化
  useEffect(() => {
    if (!open) return;
    setDraft(initialValue ?? null);
  }, [open, initialValue]);

  if (!open) return null;

  const canSave = !!draft && !busy;

  return ReactDOM.createPortal(
    <>
      {/* 黒いオーバーレイ（クリックで閉じるだけ／保存しない） */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          zIndex: 2147483646,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-[2147483647] -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "min(560px, 92vw)",
          borderRadius: 28,
          background: "#FFFFFF",
          boxShadow: "0 28px 70px rgba(0,0,0,.32)",
          padding: "22px 18px 18px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-start justify-between">
          <div
            className="text-gray-800"
            style={{ fontSize: 16, fontWeight: 700, letterSpacing: ".01em" }}
          >
            受け取り日時を選択
          </div>

          <button
            aria-label="閉じる"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
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

        {/* 説明文 */}
        <p
          style={{
            marginTop: 8,
            fontSize: 13,
            color: "#6B7280",
            lineHeight: 1.6,
          }}
        >
          毎週の受け取り時間を選んでください。
        </p>

        {/* 選択肢（draft のみ更新） */}
        <div style={{ marginTop: 14 }} className="space-y-3">
          {OPTIONS.map((opt) => {
            const selected = draft === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDraft(opt.id)}
                className="w-full text-left transition"
                style={{
                  borderRadius: 16,
                  border: selected
                    ? "2px solid #111827"
                    : "1px solid rgba(0,0,0,0.12)",
                  padding: "12px 14px",
                  backgroundColor: selected ? "#F3F4F6" : "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#111827",
                    }}
                  >
                    {opt.label}
                  </div>

                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 13,
                      color: "#6B7280",
                    }}
                  >
                    {opt.subLabel}
                  </div>
                </div>

                <div>
                  {selected ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 22,
                        height: 22,
                        borderRadius: "999px",
                        backgroundColor: "#111827",
                        color: "#FFFFFF",
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      ✓
                    </span>
                  ) : (
                    <span
                      style={{
                        display: "inline-flex",
                        width: 22,
                        height: 22,
                        borderRadius: "999px",
                        border: "1px solid rgba(0,0,0,0.18)",
                      }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* 保存ボタン（draft が選ばれているときだけ有効） */}
        <div style={{ marginTop: 18 }}>
          <button
            onClick={async () => {
              if (!draft || !canSave) return;
              await onConfirm(draft); // ← ここでだけ確定保存
              onClose();
            }}
            disabled={!canSave}
            aria-label="保存"
            style={{
              width: "100%",
              height: 60,
              background: "#000000",
              color: "#FFFFFF",
              borderRadius: 16,
              fontSize: 22,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: canSave ? 1 : 0.5,
              cursor: canSave ? "pointer" : "not-allowed",
            }}
          >
            {busy ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

/* =====================
   カード本体
===================== */
const PickupTimeCard: React.FC<Props> = ({
  value = null,
  onChange,
  onSave,
  saving = false,
  disabled = false,
  className = "",
  cannotChangeReason,
}) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TimeSlotOption | null>(null);

  // 親からの「確定値」をローカル state に反映
  useEffect(() => {
    setSelected(value ?? null);
  }, [value]);

  const selectedOption =
    OPTIONS.find((o) => o.id === selected) ?? null;

  const mainText = selectedOption
    ? selectedOption.label
    : "受け取り日時を選択";

  const isPlaceholder = !selectedOption;

  const handleConfirm = async (next: TimeSlotOption) => {
    // 保存ボタンを押したときだけ確定
    setSelected(next);
    onChange?.(next);
    if (onSave) {
      await onSave(next);
    }
  };

  return (
    <section className={`w-full ${className}`} style={{ marginTop: 24 }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        style={{
          ...cardBaseStyle,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        className="w-full"
        aria-label="受け取り日時を編集"
      >
        <div className="flex flex-col items-center">
          <div style={cardTitleStyle} className="text-gray-700">
            受け取り日時
          </div>

          <div
            style={{
              marginTop: 6,
              fontSize: selectedOption ? 26 : 20,
              fontWeight: selectedOption ? 800 : 500,
              lineHeight: 1.3,
              letterSpacing: "-.01em",
              color: isPlaceholder ? "#9CA3AF" : "#111827",
            }}
          >
            {mainText}
          </div>

          {/* 変更不可理由（赤字） */}
          {cannotChangeReason && (
            <p
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "#DC2626",
                lineHeight: 1.6,
              }}
            >
              {cannotChangeReason}
            </p>
          )}
        </div>
      </button>

      <PickupTimeModal
        open={open}
        initialValue={selected}
        onClose={() => !saving && setOpen(false)}
        busy={!!saving}
        onConfirm={async (v) => {
          await handleConfirm(v);
        }}
      />
    </section>
  );
};

export default PickupTimeCard;
