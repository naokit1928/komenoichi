import { useEffect, useState } from "react";
import ReactDOM from "react-dom";

/* ===== Scroll lock (TitleEditor と同等) ===== */
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

/**
 * フロント側でも収穫年度を自動計算する。
 * - 9月1日〜12月31日 → その年産
 * - 1月1日〜8月31日  → 前年産
 *
 * DB には保存せず、ラベル表示用のプレフィックスとしてのみ使用。
 */
function calcHarvestYear(): number {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // JS は 0 始まりなので +1
  return month >= 9 ? year : year - 1;
}

type ModalProps = {
  open: boolean;
  initialValue: string;
  maxLength: number;
  onClose: () => void;
  onConfirm: (value: string) => void | Promise<void>;
  busy: boolean;
};

function RiceVarietyModal({
  open,
  initialValue,
  maxLength,
  onClose,
  onConfirm,
  busy,
}: ModalProps) {
  useDisableScroll(open);

  const [draft, setDraft] = useState(initialValue ?? "");
  const trimmed = draft.replace(/\r?\n/g, "").trim();
  const realMax = Math.min(maxLength, 15); // 仕様に合わせて 15 文字に制限
  const len = trimmed.length;
  const isValid = len >= 3 && len <= realMax;
  const canSave = isValid && !busy;

  useEffect(() => {
    if (open) {
      setDraft(initialValue ?? "");
    }
  }, [open, initialValue]);

  if (!open) return null;

  const root = document.getElementById("modal-root") ?? document.body;

  const handleSave = async () => {
    if (!canSave) return;
    await onConfirm(trimmed);
  };

  const content = (
    <>
      {/* オーバーレイ：タップで閉じる（保存しない） */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          zIndex: 2147483646,
        }}
      />
      {/* ダイアログ本体 */}
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
            お米の品種（銘柄）
          </div>
          <button
            type="button"
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

        {/* 入力欄（編集するのは銘柄名だけ） */}
        <div className="mt-5 w-full">
          <input
            type="text"
            value={draft}
            maxLength={realMax}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            autoFocus
            aria-label="お米の品種（銘柄）を入力"
            placeholder="コシヒカリ"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.12)",
              fontSize: 20,
              lineHeight: 1.4,
              outline: "none",
            }}
          />
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              textAlign: "right",
              color: isValid ? "#6B7280" : "#DC2626",
            }}
          >
            {len}/{realMax}
          </div>
        </div>

        {/* 説明・注意書き */}
        <p
          className="text-center text-gray-500"
          style={{
            marginTop: 14,
            marginBottom: 20,
            fontSize: 12.5,
            lineHeight: 1.7,
          }}
        >
          3〜15文字で入力してください。
          <br />
          例：コシヒカリ、あきたこまち、自家ブレンド米 など
        </p>

        {/* 保存ボタン（PriceEditor と同等デザイン） */}
        <div>
          <button
            type="button"
            onClick={handleSave}
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
              letterSpacing: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 0 rgba(0,0,0,.02)",
              transform: "translateZ(0)",
              opacity: canSave ? 1 : 0.5,
              cursor: canSave ? "pointer" : "not-allowed",
            }}
            className="transition active:scale-[.99]"
          >
            {busy ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </>
  );

  return ReactDOM.createPortal(content, root);
}

/* ===== メインカード ===== */

type Props = {
  value: string;
  harvestYear?: number;
  onChange: (nextPlain: string) => void;
  onSave: (nextPlain: string) => void | Promise<void>;
  saving?: boolean;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
};

export default function RiceVarietyLabelEditor({
  value,
  harvestYear,
  onChange,
  onSave,
  saving,
  disabled,
  maxLength = 15,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<string>(value ?? "");

  useEffect(() => {
    setLocal(value ?? "");
  }, [value]);

  const trimmed = (local ?? "").replace(/\r?\n/g, "").trim();

  // カード表示用：収穫年度（バックエンド値があればそれを優先し、なければフロントで自動計算）
  const year = harvestYear ?? calcHarvestYear();
  const displayVariety = trimmed || "—";
  const displayText = `${year}年産 ${displayVariety}`;


  return (
    <section className={`w-full ${className}`} style={{ marginTop: 24 }}>
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
        aria-label="お米の品種（銘柄）を編集"
      >
        <div
          className="text-gray-800"
          style={{ fontSize: 16, fontWeight: 700, letterSpacing: ".01em" }}
        >
          お米の品種（銘柄）
        </div>

        <div
          className="text-black"
          style={{
            fontWeight: 800,
            fontSize: 20,
            lineHeight: 1.3,
            letterSpacing: "-.01em",
            marginTop: 6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            textAlign: "center",
          }}
        >
          {/* カード上には常に「20xx年産 ＋ 銘柄名」を表示 */}
          {displayText}
        </div>
      </button>

      <RiceVarietyModal
        open={open}
        initialValue={local}
        maxLength={maxLength}
        onClose={() => !saving && setOpen(false)}
        busy={!!saving}
        onConfirm={async (next) => {
          const t = next.replace(/\r?\n/g, "").trim();
          if (!t) return;
          await onSave(t);
          onChange(t);
          setLocal(t);
          setOpen(false);
        }}
      />
    </section>
  );
}
