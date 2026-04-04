// frontend/src/features/farmer-pickup/PickupNotesCard.tsx
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

const MAX_LEN = 100;

type Props = {
  value?: string;
  onChange?: (v: string) => void;
  onSave?: (v: string) => void | Promise<void>;
  saving?: boolean;
  disabled?: boolean;
  /** 今週予約があるときの「変更できません」メッセージ */
  cannotChangeReason?: string;
  className?: string;
};

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

function sanitize(input: string): string {
  let v = input ?? "";
  v = v.replace(/\s+$/g, ""); // 末尾の空白（改行含む）を削る
  v = v.replace(/\n{3,}/g, "\n\n"); // 改行が続いたら 2 行まで
  if (v.length > MAX_LEN) v = v.slice(0, MAX_LEN);
  return v;
}

/* =====================
   モーダル本体
   ===================== */
function PickupNotesModal({
  open,
  initialValue,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  initialValue: string;
  onClose: () => void;
  onConfirm: (v: string) => void | Promise<void>;
  busy: boolean;
}) {
  useDisableScroll(open);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [draft, setDraft] = useState<string>(sanitize(initialValue ?? ""));

  // モーダルを開くたびに initialValue から draft を初期化
  useEffect(() => {
    if (!open) return;
    setDraft(sanitize(initialValue ?? ""));
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = el.value.length;
    });
  }, [open]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <>
      {/* 背景オーバーレイ */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.75)",
          zIndex: 2147483646,
        }}
      />

      {/* モーダル本体 */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-[2147483647] -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "min(560px, 92vw)",
          borderRadius: 28,
          background: "#FFF",
          boxShadow: "0 28px 70px rgba(0,0,0,.32)",
          padding: "22px 18px 18px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-start justify-between">
          <div>
            <div
              className="text-gray-800"
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: ".01em",
              }}
            >
              来訪ルール・駐車案内
            </div>
            {/* ヒント行 */}
            <div
              style={{
                marginTop: 4,
                fontSize: 12.5,
                color: "#6B7280",
                lineHeight: 1.6,
              }}
            >
              駐車場所・ハウスルールなど、お客様に伝えておきたいことを記入してください。
            </div>
          </div>
          <button
            aria-label="閉じる"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              flexShrink: 0,
              marginLeft: 12,
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

        {/* 文字数カウンター */}
        <div
          className="w-full text-right"
          style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}
        >
          <span
            style={{
              fontSize: 12.5,
              color: draft.length > MAX_LEN ? "#ef4444" : "#6B7280",
              lineHeight: 1.6,
            }}
            aria-live="polite"
          >
            {draft.length}/{MAX_LEN}
          </span>
        </div>

        {/* textarea（モーダル内の draft のみ更新） */}
        <div className="mt-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(sanitize(e.target.value))}
            placeholder={"例）駐車は看板を立ててあるスペースに最大3台まで。\n道路への駐車はご遠慮ください。"}
            className="w-full outline-none"
            style={{
              background: "transparent",
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: 16,
              padding: "14px 14px",
              fontSize: 15,
              lineHeight: 1.6,
              color: "#374151",
              minHeight: 120,
              resize: "vertical",
            }}
            maxLength={MAX_LEN + 50}
            aria-label="来訪ルール・駐車案内を入力"
          />
        </div>

        {/* 保存ボタン */}
        <div style={{ marginTop: 18 }}>
          <button
            onClick={async () => {
              if (busy) return;
              const sanitized = sanitize(draft);

              await onConfirm(sanitized);
              onClose();
            }}
            disabled={busy}
            aria-label="保存"
            style={{
              width: "100%",
              height: 60,
              background: "#000",
              color: "#FFF",
              borderRadius: 16,
              fontSize: 22,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 0 rgba(0,0,0,.02)",
              opacity: busy ? 0.6 : 1,
              cursor: busy ? "not-allowed" : "pointer",
            }}
            className="transition active:scale-[.99]"
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
const PickupNotesCard: React.FC<Props> = ({
  value = "",
  onChange,
  onSave,
  saving = false,
  disabled = false,
  cannotChangeReason,
  className = "",
}) => {
  const [open, setOpen] = useState(false);

  const confirmed = sanitize(value ?? "");
  const isEmpty = confirmed.trim() === "";

  const handleConfirm = async (next: string) => {
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
          backgroundColor: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 24,
          padding: "24px 20px",
          paddingRight: 28,
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        className="w-full text-left"
      >
        {/* タイトル行 */}
        <div className="flex items-start justify-between">
          <div>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: ".01em",
                color: "#111827",
              }}
            >
              来訪ルール・駐車案内
            </span>

          </div>

          <span
            style={{
              marginLeft: 8,
              fontSize: 11,
              color: "#9CA3AF",
              lineHeight: 1.6,
              flexShrink: 0,
            }}
          >
            任意
          </span>
        </div>

        {/* 本文プレビュー */}
        <div
          style={{
            marginTop: 10,
            fontSize: 14.5,
            lineHeight: 1.7,
            color: isEmpty ? "#9CA3AF" : "#374151",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          }}
        >
          {isEmpty
            ? "ルールや駐車場所などをここに記入できます"
            : confirmed.trim()}
        </div>

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
      </button>

      <PickupNotesModal
        open={open}
        initialValue={confirmed}
        onClose={() => !saving && setOpen(false)}
        busy={!!saving}
        onConfirm={async (v) => {
          await handleConfirm(v);
          setOpen(false);
        }}
      />
    </section>
  );
};

export default PickupNotesCard;
