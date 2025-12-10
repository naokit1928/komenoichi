import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";

/* ===== Scroll lock ===== */
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

/* ===== Const ===== */
const MIN_LEN = 3;
const MAX_LEN = 25;

/* ===== Helpers ===== */

// 文字数（バリデ用）: 改行は除去
const countLen = (s: string) => s.replace(/\r?\n/g, "").trim().length;


/** 指定 cut で折り返し（安全域にクランプ） */
function wrapAt(s: string, cut: number): string {
  const n = s.length;
  const minTail = Math.max(3, Math.floor(n * 0.33));
  const c = Math.min(n - minTail, Math.max(minTail, cut));
  return s.slice(0, c) + "\n" + s.slice(c);
}

/**
 * 表示用ラップ：
 * - 手動の preferredCut があるときだけ改行を入れる
 * - それ以外は改行なし（= 自動バランス改行を廃止）
 */
function applyDisplayWrap(plain: string, preferredCut: number | null): string {
  const s = plain.replace(/\r?\n/g, "").trim();
  if (!s) return "";
  if (preferredCut != null) return wrapAt(s, preferredCut);
  return s; // ← 自動改行なし。中央ぞろえのみ
}

/* ===== Modal ===== */
function TitleEditModal({
  open,
  initialPlain,
  initialPreferredCut,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  initialPlain: string; // 改行を除いた“保存済みプレーン”
  initialPreferredCut: number | null;
  onClose: () => void;
  /** 保存ボタン or Enter 確定時だけ呼ばれる（プレーン + 改行位置） */
  onConfirm: (plain: string, preferredCut: number | null) => void | Promise<void>;
  busy: boolean;
}) {
  useDisableScroll(open);

  // モーダル内だけで使う「下書き」のタイトル
  const [draftPlain, setDraftPlain] = useState<string>("");
  const [draftPreferredCut, setDraftPreferredCut] = useState<number | null>(null);

  // textarea に見せる文字列（表示用：手動折返しのみ反映）
  const displayText = useMemo(
    () => applyDisplayWrap(draftPlain, draftPreferredCut),
    [draftPlain, draftPreferredCut]
  );

  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // モーダルを開くたびに「保存済み値」から draft を初期化
  useEffect(() => {
    if (!open) return;
    const base = initialPlain ?? "";
    setDraftPlain(base);
    setDraftPreferredCut(initialPreferredCut ?? null);

    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = el.value.length;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    });
  }, [open, initialPlain, initialPreferredCut]);

  const len = countLen(draftPlain);
  const isValid = len >= MIN_LEN && len <= MAX_LEN;
  const canSave = isValid && !busy;

  const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    const limited = e.target.value.slice(0, MAX_LEN); // 上限ガード

    // 入力値から「プレーン文字列」と「手動改行位置」を抽出
    const lfIdx = limited.indexOf("\n");
    if (lfIdx >= 0) {
      // 1つ目の改行位置を cut として採用
      setDraftPreferredCut(lfIdx);
      setDraftPlain(limited.replace(/\r?\n/g, "")); // プレーンを更新
    } else {
      setDraftPlain(limited);
      setDraftPreferredCut(null); // 改行が消えたら改行なし
    }

    // オートリサイズ
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    // Enterで保存、Shift+Enterで手動改行位置を記録
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSave) {
        onConfirm(draftPlain.trim(), draftPreferredCut);
      }
      return;
    }
    if (e.key === "Enter" && e.shiftKey) {
      const el = e.currentTarget;
      const caret = el.selectionStart ?? 0;
      // 表示テキスト上の caret からプレーンの cut を推定（表示は1箇所のみ改行想定）
      const before = displayText.slice(0, caret);
      const cut = before.replace(/\r?\n/g, "").length;
      setDraftPreferredCut(cut);
    }
  };

  if (!open) return null;

  return ReactDOM.createPortal(
    <>
      {/* 背景：クリックで閉じるだけ（保存はしない） */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          zIndex: 2147483646,
        }}
      />
      {/* 本体 */}
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
        {/* ヘッダ */}
        <div className="flex items-start justify-between">
          <div
            className="text-gray-800"
            style={{ fontSize: 16, fontWeight: 700, letterSpacing: ".01em" }}
          >
            タイトル
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

        {/* 入力 */}
        <div className="mt-5 w-full flex justify-center">
          <textarea
            ref={taRef}
            value={displayText}
            onChange={handleChange}
            onKeyDown={onKeyDown}
            rows={1}
            spellCheck={false}
            aria-label="タイトルを入力"
            className="outline-none"
            style={{
              width: "100%",
              maxWidth: 560,
              textAlign: "center",
              resize: "none",
              overflow: "hidden",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              fontWeight: 800,
              fontSize: 27,
              lineHeight: 1.25,
              letterSpacing: "-.01em",
              border: "none",
              borderBottom: `2px solid ${isValid ? "transparent" : "#ef4444"}`,
              padding: "6px 8px",
            }}
            maxLength={MAX_LEN}
          />
        </div>

        {/* 注意書き：位置は入力欄の直下、保存ボタンの直前 */}
        <p
          className="text-center"
          style={{
            marginTop: 10,
            color: "#6B7280",
            fontSize: 12.5,
            lineHeight: 1.6,
          }}
        >
          文字数 <strong>{MIN_LEN}〜{MAX_LEN} 文字</strong>
        </p>

        {/* 保存 */}
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => {
              if (!canSave) return;
              onConfirm(draftPlain.trim(), draftPreferredCut);
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
            {busy ? (
              <span className="inline-flex items-center gap-3">
                <span
                  className="inline-block animate-spin"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "9999px",
                    border: "2.5px solid rgba(255,255,255,0.35)",
                    borderTopColor: "#FFFFFF",
                  }}
                  aria-hidden="true"
                />
                <span>保存中...</span>
              </span>
            ) : (
              "保存"
            )}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

/* ===== Main (card + modal) ===== */
type Props = {
  value: string; // DB上は1行テキスト
  onChange: (nextPlain: string) => void;
  onSave: (nextPlain: string) => void | Promise<void>;
  saving?: boolean;
  disabled?: boolean;
  className?: string;
};

export default function TitleEditor({
  value,
  onChange,
  onSave,
  saving,
  disabled,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);

  // 「保存済み」のプレーン文字列
  const [plain, setPlain] = useState<string>(value ?? "");
  // 「保存済み」の手動改行位置（null なら改行なし）
  const [preferredCut, setPreferredCut] = useState<number | null>(null);

  // 親からの外部更新に追従
  useEffect(() => {
    setPlain(value ?? "");
    setPreferredCut(null); // 外部更新時は改行位置をリセット
  }, [value]);

  // カード表示用（保存済みテキスト + 手動改行のみ反映）
  const displayOnCard = useMemo(
    () => applyDisplayWrap(plain, preferredCut),
    [plain, preferredCut]
  );

  return (
    <section className={`w-full ${className}`} style={{ marginTop: 24 }}>
      {/* PriceEditor準拠のカード */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        className="w-full bg-white"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 24,
          padding: "44px 46px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "center",
        }}
        aria-label="タイトルを編集"
      >
        <div
          className="text-gray-800"
          style={{ fontSize: 16, fontWeight: 700, letterSpacing: ".01em" }}
        >
          タイトル
        </div>

        <div
          className="text-black"
          style={{
            fontWeight: 800,
            fontSize: 27,
            lineHeight: 1.25,
            letterSpacing: "-.01em",
            marginTop: 6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            textAlign: "center",
          }}
        >
          {displayOnCard || "　"}
        </div>
      </button>

      {/* モーダル */}
      <TitleEditModal
        open={open}
        initialPlain={plain}
        initialPreferredCut={preferredCut}
        onClose={() => !saving && setOpen(false)}
        busy={!!saving}
        onConfirm={async (nextPlain, nextCut) => {
          const trimmed = nextPlain.trim();
          const l = countLen(trimmed);
          if (!trimmed || l < MIN_LEN || l > MAX_LEN) return;

          await onSave(trimmed); // DBへは1行で保存
          onChange(trimmed);

          setPlain(trimmed);
          setPreferredCut(nextCut ?? null);
          setOpen(false);
        }}
      />
    </section>
  );
}
