import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

/* ========================
   価格計算ロジック（バックエンドと同じ）
   ======================== */

/** 100円単位で四捨五入（FarmerSettingsService._round_to_100 と同じ） */
function roundTo100(value: number | null | undefined): number | null {
  if (value == null) return null;

  let v = Math.trunc(value);
  let sign = 1;
  if (v < 0) {
    sign = -1;
    v = -v;
  }

  const q = Math.floor(v / 100);
  const r = v % 100;
  let qq = q;
  if (r >= 50) {
    qq += 1;
  }
  return sign * qq * 100;
}

/**
 * 10kg をベースに 5kg / 25kg を自動算出
 * （FarmerSettingsService._auto_calc_prices と同じ）
 */
function derivePricesFrom10(
  price10: number | null | undefined
): { price5: number | null; price25: number | null } {
  if (price10 == null) return { price5: null, price25: null };

  const base10 = roundTo100(price10);
  if (base10 == null) return { price5: null, price25: null };

  // 5kg = 10kg の 52% を 1円単位で四捨五入 → 100円単位で四捨五入
  const raw5 = Math.floor((base10 * 52 + 50) / 100);
  const price5 = roundTo100(raw5);

  // 25kg = 10kg の 240% を 1円単位で四捨五入 → 100円単位で四捨五入
  const raw25 = Math.floor((base10 * 240 + 50) / 100);
  const price25 = roundTo100(raw25);

  return { price5, price25 };
}

// 表示用
const yen = (n: number | "") =>
  typeof n === "number" ? `￥${n.toLocaleString("ja-JP")}` : "￥0";

const withComma = (digitsOnly: string) => {
  if (!digitsOnly) return "";
  const n = Number(digitsOnly);
  return isNaN(n) ? "" : n.toLocaleString("ja-JP");
};

type Props = {
  initialPrice10?: number;
  onSaved?: () => void;
  disabled?: boolean;
  minPrice?: number;
  maxPrice?: number;
};


const MAX_DIGITS = 4;

/* ---------- disable scroll when modal open ---------- */
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

/* ---------- toast ---------- */
function Toast({ kind, text }: { kind: "ok" | "ng"; text: string }) {
  return ReactDOM.createPortal(
    <div
      role="status"
      className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[2147483647]"
    >
      <div
        className="flex items-center gap-2 rounded-2xl px-4 py-2 shadow-xl"
        style={{
          background:
            kind === "ok"
              ? "rgba(16,185,129,.95)"
              : "rgba(239,68,68,.95)",
          color: "white",
          fontSize: 14,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          {kind === "ok" ? (
            <path
              d="M20 6L9 17l-5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M18 6L6 18M6 6l12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </svg>
        <span>{text}</span>
      </div>
    </div>,
    document.body
  );
}

/* ---------- modal ---------- */
function PriceEditModal({
  open,
  onClose,
  value: _value,
  setValue,
  onSave,
  busy,
  minPrice,
  maxPrice,
}: {
  open: boolean;
  onClose: () => void;
  value: number | "";
  setValue: (v: number | "") => void;
  /** 保存時は最新数値を onSave に引数で直接渡す */
  onSave: (newPrice10: number) => void;
  busy: boolean;
  minPrice: number;
  maxPrice: number;
}) {
  useDisableScroll(open);
  const editableRef = useRef<HTMLSpanElement | null>(null);
  const [rawDigits, setRawDigits] = useState<string>("");

  // プレビュー用（5kg / 25kg）
  const [preview5, setPreview5] = useState<number>(0);
  const [preview25, setPreview25] = useState<number>(0);

  // モーダルを開くたびにリセット＋自動フォーカス
  useEffect(() => {
    if (!open) return;
    setRawDigits("");

    requestAnimationFrame(() => {
      if (editableRef.current) {
        editableRef.current.textContent = "";
        editableRef.current.focus();
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editableRef.current);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    });
  }, [open]);

  // 入力のたびにバックエンドと同じロジックで 5kg/25kg を再計算
  useEffect(() => {
    if (!open) return;
    const n = Number(rawDigits || "0");
    if (!Number.isFinite(n) || n <= 0) {
      setPreview5(0);
      setPreview25(0);
      return;
    }
    const { price5, price25 } = derivePricesFrom10(n);
    setPreview5(price5 ?? 0);
    setPreview25(price25 ?? 0);
  }, [open, rawDigits]);

  if (!open) return null;

  const onEdit = () => {
    const el = editableRef.current;
    if (!el) return;
    // 数字のみ + 桁数制限（4桁まで）
    let only = (el.textContent || "").replace(/[^\d]/g, "");
    if (only.length > MAX_DIGITS) only = only.slice(0, MAX_DIGITS);
    setRawDigits(only);

    const formatted = withComma(only);
    if (el.textContent !== formatted) {
      el.textContent = formatted;
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  };

  const normalized = Number(rawDigits || "0");
  const withinRange = normalized >= minPrice && normalized <= maxPrice;
  const canSave = !busy && rawDigits.length > 0 && withinRange;

  return ReactDOM.createPortal(
    <>
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
        {/* ヘッダ */}
        <div className="flex items-start justify-between">
          <div
            className="text-gray-800"
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: ".01em",
            }}
          >
            10kgの価格
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

        {/* 巨大価格（入力欄） */}
        <div className="mt-5 w-full flex justify-center">
          <div
            style={{ display: "inline-flex", alignItems: "baseline", gap: 0 }}
          >
            <span
              className="text-black select-none"
              style={{
                fontWeight: 900,
                fontSize: 56,
                lineHeight: 1.15,
                letterSpacing: "-.01em",
              }}
            >
              ￥
            </span>
            <span
              ref={editableRef}
              contentEditable
              role="textbox"
              aria-label="10kgの価格（数字を直接編集）"
              onInput={onEdit}
              inputMode="numeric"
              style={{
                minWidth: "0.3em",
                fontWeight: 900,
                fontSize: 56,
                lineHeight: 1.15,
                letterSpacing: "-.01em",
                outline: "none",
                border: "none",
                whiteSpace: "pre",
              }}
              className="text-black"
            />
          </div>
        </div>

        {/* プレビュー（ローカル計算だがロジックはサーバと同じ） */}
        <div className="mt-4 text-center space-y-1">
          <div className="text-gray-800">
            <span className="font-semibold text-base">5kg：</span>
            <span className="font-extrabold text-[20px]">
              ￥ {preview5.toLocaleString("ja-JP")}
            </span>
          </div>
          <div className="text-gray-800">
            <span className="font-semibold text-base">25kg：</span>
            <span className="font-extrabold text-[20px]">
              ￥ {preview25.toLocaleString("ja-JP")}
            </span>
          </div>
        </div>

        {/* 注意書き */}
        <p
          className="text-center text-gray-500"
          style={{
            marginTop: 16,
            marginBottom: 28,
            fontSize: 12.5,
            lineHeight: 1.7,
          }}
        >
          5kg/25kgは10kgの値段をもとに自動設定されます
          <br />
          10kgの価格の入力範囲は5,000〜9,900円です
          <br />
          100円未満は<strong>四捨五入</strong>されます
        </p>

        {/* 保存ボタン */}
        <div>
          <button
            onClick={() => {
              const n = Number(rawDigits || "0");
              setValue(n); // UI表示用 state 更新
              onSave(n); // 最新値で保存
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

/* ---------- main ---------- */
export default function PriceEditor({
  initialPrice10,
  onSaved,
  disabled,
  minPrice = 5000,
  maxPrice = 9900,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [price10Input, setPrice10Input] = useState<number | "">("");
  const [toast, setToast] =
    useState<{ kind: "ok" | "ng"; text: string } | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const lastSavedRef = useRef<number | null>(null);

  // カード表示用 5kg/25kg
  const [d5, setD5] = useState<number | "-">("-");
  const [d25, setD25] = useState<number | "-">("-");

  useEffect(() => {
    if (typeof initialPrice10 === "number" && initialPrice10 > 0) {
      setPrice10Input(initialPrice10);
      lastSavedRef.current = initialPrice10;
    }
  }, [initialPrice10]);

  // 10kg 価格が決まるたびにローカルで 5kg/25kg を更新
  useEffect(() => {
    if (typeof price10Input !== "number" || price10Input <= 0) {
      setD5("-");
      setD25("-");
      return;
    }
    const { price5, price25 } = derivePricesFrom10(price10Input);
    if (price5 == null) {
      setD5("-");
    } else {
      setD5(price5);
    }
    if (price25 == null) {
      setD25("-");
    } else {
      setD25(price25);
    }
  }, [price10Input]);

  function showToast(kind: "ok" | "ng", text: string) {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 1200);
  }

  /** 保存は state ではなく、引数の最新値を使う */
  async function savePrice10(explicitValue?: number) {
    const n =
      typeof explicitValue === "number"
        ? explicitValue
        : price10Input === ""
        ? NaN
        : Number(price10Input);

    if (!Number.isFinite(n)) {
      showToast("ng", "10kgの価格を数値で入力してください。");
      return;
    }
    if (n < minPrice || n > maxPrice) {
      showToast(
        "ng",
        `価格は ${minPrice.toLocaleString(
          "ja-JP"
        )}〜${maxPrice.toLocaleString("ja-JP")} 円の範囲で入力してください。`
      );
      return;
    }
    if (lastSavedRef.current === n) {
      setOpenModal(false);
      return;
    }

    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/api/farmer/settings-v2/me`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ price_10kg: n }),
      });
      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) as {
        price_10kg?: number | null;
        price_5kg?: number | null;
        price_25kg?: number | null;
      };

      const normalized10 =
        typeof data.price_10kg === "number" ? data.price_10kg : n;

      // 10kg 表示をサーバ側の最終値で上書き
      setPrice10Input(normalized10);
      lastSavedRef.current = normalized10;

      // 5kg / 25kg もレスポンスにあれば即反映
      if (typeof data.price_5kg === "number") {
        setD5(data.price_5kg);
      }
      if (typeof data.price_25kg === "number") {
        setD25(data.price_25kg);
      }

      onSaved && onSaved();
      showToast("ok", "価格を保存しました。");
      setOpenModal(false);
    } catch (e) {
      console.error(e);
      showToast("ng", "価格の保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-8" style={{ marginTop: 24 }}>
      <button
        type="button"
        onClick={() => !disabled && setOpenModal(true)}
        className="w-full bg-white"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 24,
          padding: "40px 42px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "center",
        }}
        aria-label="10kgの価格を編集"
      >
        <div
          className="text-gray-700"
          style={{
            fontSize: 16,
            letterSpacing: ".01em",
            lineHeight: 1.6,
            fontWeight: 700,
          }}
        >
          10kgの価格
        </div>

        {/* ￥9,000 の行 */}
        <div
          className="text-black"
          style={{
            fontWeight: 800,
            fontSize: 44,
            lineHeight: 1.2,
            letterSpacing: "-.01em",
            marginTop: -4,
          }}
        >
          {yen(price10Input === "" ? 0 : Number(price10Input))}
        </div>

        {/* 5kg/25kg の行 */}
        <div className="text-gray-800" style={{ marginTop: 12 }}>
          <span className="inline-flex items-baseline gap-1 font-semibold">
            5kg{" "}
            <b className="font-extrabold text-[18px]">
              {typeof d5 === "number" ? d5.toLocaleString("ja-JP") : "-"}
            </b>{" "}
            円
          </span>
          <span className="mx-2 text-gray-400">／</span>
          <span className="inline-flex items-baseline gap-1 font-semibold">
            25kg{" "}
            <b className="font-extrabold text-[18px]">
              {typeof d25 === "number" ? d25.toLocaleString("ja-JP") : "-"}
            </b>{" "}
            円
          </span>
        </div>
      </button>

      <PriceEditModal
        open={openModal}
        onClose={() => !busy && setOpenModal(false)}
        value={price10Input}
        setValue={setPrice10Input}
        onSave={savePrice10}
        busy={busy}
        minPrice={minPrice}
        maxPrice={maxPrice}
      />

      {toast && <Toast kind={toast.kind} text={toast.text} />}
    </section>
  );
}
