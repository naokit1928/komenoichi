// frontend/src/features/farmer-settings/PrTextEditor.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";

/* ===== 固定ルール（親から変更不可） ===== */
const MAX_LEN = 500; // 文字上限
const MAX_TOTAL_LINES = 28; // 総行数上限
const MAX_BLANKS = 2; // 空行の連続上限

// 例文（DB に保存したくないサンプル文）
const PLACEHOLDER_EXAMPLE =
  "田んぼの景色が広がる静かな場所です。\n朝に収穫したお米を、その日のうちに精米してお渡ししています。";

type Props = {
  value: string; // 任意（0文字OK）
  onChange?: (next: string) => void; // 確定保存時の通知（任意）
  onSave: (next: string) => void | Promise<void>;
  saving?: boolean;
  disabled?: boolean;
  className?: string;
};

/* スクロールロック */
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

/* 改行制御ユーティリティ */
function compressConsecutiveNewlines(
  input: string,
  maxBlanks: number
): string {
  const re = new RegExp(`\\n{${Math.max(1, maxBlanks) + 1},}`, "g");
  return input.replace(re, "\n".repeat(Math.max(1, maxBlanks)));
}

function clampTotalLines(input: string, maxLines: number): string {
  const lines = input.split("\n");
  if (lines.length <= maxLines) return input;
  return lines.slice(0, maxLines).join("\n");
}

/* サニタイズ＋カーソル保持 */
function sanitizeWithCaret(
  raw: string,
  caret: number,
  maxLen: number,
  maxTotalLines: number,
  maxBlankLines: number
): { text: string; caret: number } {
  const norm = raw.replace(/\r\n?/g, "\n");
  const beforeRaw = norm.slice(0, caret);
  let before = compressConsecutiveNewlines(beforeRaw, maxBlankLines);
  let full = compressConsecutiveNewlines(norm, maxBlankLines);

  full = clampTotalLines(full, maxTotalLines);
  const truncatedBoundaryIndex = full.length;
  const beforeClamped = clampTotalLines(before, maxTotalLines);

  const hardCap = maxLen + 200; // 暴走防止
  if (full.length > hardCap) full = full.slice(0, hardCap);

  let newCaret = Math.min(beforeClamped.length, full.length);
  newCaret = Math.min(newCaret, truncatedBoundaryIndex);

  full = full.replace(/\n+$/g, "\n"); // 末尾の大量改行は1つに
  return { text: full, caret: newCaret };
}

/* ===== モーダル（下書き draft を内部に持つ） ===== */
function PrTextModal({
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
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // モーダル内だけで使う「下書き値」
  const [draft, setDraft] = useState<string>("");

  // モーダルを開くたびに initialValue から draft を初期化
  useEffect(() => {
    if (!open) return;
    const src = initialValue ?? "";
    const { text } = sanitizeWithCaret(
      src,
      src.length,
      MAX_LEN,
      MAX_TOTAL_LINES,
      MAX_BLANKS
    );
    setDraft(text);
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = el.value.length;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 360) + "px";
    });
  }, [open, draft]);

  const autosize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 360) + "px";
  };

  const over = draft.length > MAX_LEN;
  const canSave = !busy && !over;

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (
    e
  ) => {
    if (e.key !== "Enter") return;
    const el = e.currentTarget;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (start !== end) return;

    const nextRaw = draft.slice(0, start) + "\n" + draft.slice(end);
    const left = draft.slice(0, start);
    const right = draft.slice(end);
    const leftNL = left.match(/\n+$/)?.[0].length ?? 0;
    const rightNL = right.match(/^\n+/)?.[0].length ?? 0;
    if (leftNL + 1 + rightNL > MAX_BLANKS) {
      e.preventDefault();
      return;
    }

    const totalLines = nextRaw.replace(/\r\n?/g, "\n").split("\n").length;
    if (totalLines > MAX_TOTAL_LINES) {
      e.preventDefault();
      return;
    }
  };

  const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    const el = e.currentTarget;
    const raw = el.value;
    const caret = el.selectionStart ?? raw.length;

    const { text: sanitized, caret: newCaret } = sanitizeWithCaret(
      raw,
      caret,
      MAX_LEN,
      MAX_TOTAL_LINES,
      MAX_BLANKS
    );

    setDraft(sanitized);
    requestAnimationFrame(() => {
      if (!taRef.current) return;
      taRef.current.selectionStart = taRef.current.selectionEnd = newCaret;
      autosize(taRef.current);
    });
  };

  if (!open) return null;

  return ReactDOM.createPortal(
    <>
      {/* 背景クリック → 閉じるだけ。保存はしない */}
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
        <div className="flex items-start justify-between">
          <div
            className="text-gray-800"
            style={{ fontSize: 16, fontWeight: 700, letterSpacing: ".01em" }}
          >
            説明文
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

        <div className="w-full text-right" style={{ marginTop: 6 }}>
          <span
            style={{
              fontSize: 12.5,
              color: over ? "#ef4444" : "#6B7280",
              lineHeight: 1.6,
            }}
            aria-live="polite"
          >
            {draft.length}/{MAX_LEN}
          </span>
        </div>

        <div className="mt-2 w-full">
          <textarea
            ref={taRef}
            value={draft}
            placeholder={PLACEHOLDER_EXAMPLE}
            onKeyDown={handleKeyDown}
            onChange={handleChange}
            rows={6}
            spellCheck={false}
            className="w-full outline-none"
            style={{
              width: "100%",
              resize: "none",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              background: "transparent",
              border: "1px solid rgba(0, 0, 0, 0.1)",
              borderRadius: 16,
              padding: "12px 14px",
              fontSize: 16,
              lineHeight: 1.75,
              color: "#374151",
            }}
            maxLength={MAX_LEN + 200}
            aria-label="PR説明文を入力"
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            onClick={async () => {
              if (!canSave) return;
              const { text: sanitized } = sanitizeWithCaret(
                draft,
                draft.length,
                MAX_LEN,
                MAX_TOTAL_LINES,
                MAX_BLANKS
              );
              await onConfirm(sanitized); // ← ここだけで確定保存
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
              boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
              opacity: canSave ? 1 : 0.5,
              cursor: canSave ? "pointer" : "not-allowed",
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

/* ===== メイン（カード + モーダル起動） ===== */
export default function PrTextEditor({
  value,
  onChange,
  onSave,
  saving = false,
  disabled = false,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string>("");

  // 親からの「確定値」をサニタイズして内部 state へ
  useEffect(() => {
    const raw = value ?? "";
    // もし value が例文そのものなら「未入力扱い」にする
    const base =
      raw.trim() === PLACEHOLDER_EXAMPLE.trim() ? "" : raw;

    const { text: sanitized } = sanitizeWithCaret(
      base,
      base.length,
      MAX_LEN,
      MAX_TOTAL_LINES,
      MAX_BLANKS
    );
    setText(sanitized);
  }, [value]);

  // カード上のプレビュー（未入力ならグレーの説明）
  const preview = useMemo(() => {
    const v = (text ?? "").trim();
    if (!v) return "説明文を追加（任意）";
    return v;
  }, [text]);

  const handleConfirm = async (next: string) => {
    // 保存ボタンを押したときだけ確定
    const { text: sanitized } = sanitizeWithCaret(
      next ?? "",
      (next ?? "").length,
      MAX_LEN,
      MAX_TOTAL_LINES,
      MAX_BLANKS
    );
    setText(sanitized);
    onChange?.(sanitized);
    await onSave(sanitized);
  };

  return (
    <section className={`w-full ${className}`} style={{ marginTop: 24 }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        className="w-full bg-white text-left"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid rgba(0, 0, 0, 0.07)",
          borderRadius: 24,
          padding: "28px 20px",
          paddingRight: 28,
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.04)",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        aria-label="説明文を編集"
      >
        <div className="flex items-start justify-between">
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: ".01em",
              color: "#111827",
            }}
          >
            説明文
          </span>
          <span
            style={{
              fontSize: 12.5,
              color: "#6B7280",
              lineHeight: 1.6,
            }}
          >
            {text.length}/{MAX_LEN}
          </span>
        </div>

        <div
          style={{
            marginTop: 8,
            fontSize: 16,
            lineHeight: 1.75,
            color:
              preview === "説明文を追加（任意）" ? "#9CA3AF" : "#374151",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          }}
        >
          {preview}
        </div>
      </button>

      <PrTextModal
        open={open}
        initialValue={text}
        onClose={() => !saving && setOpen(false)}
        onConfirm={async (v) => {
          await handleConfirm(v);
          setOpen(false);
        }}
        busy={!!saving}
      />
    </section>
  );
}
