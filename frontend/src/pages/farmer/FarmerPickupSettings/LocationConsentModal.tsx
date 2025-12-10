// frontend/src/features/farmer-pickup/LocationConsentModal.tsx
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";

type LocationConsentModalProps = {
  open: boolean;
  onClose: () => void;
  onAgreed: () => void;
  mode?: "registration" | "update"; 
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

const LocationConsentModal: React.FC<LocationConsentModalProps> = ({
  open,
  onClose,
  onAgreed,
  mode = "update", // ← デフォルトは update（既存の動作維持）
}) => {
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [c3, setC3] = useState(false);

  useDisableScroll(open);

  useEffect(() => {
    if (open) {
      setC1(false);
      setC2(false);
      setC3(false);
    }
  }, [open]);

  if (!open) return null;

  const allChecked = c1 && c2 && c3;

  // ★ 文言を mode により切り替え
  const buttonLabel =
    mode === "registration"
      ? "同意して場所を登録する"
      : "同意して場所を変更する";

  return ReactDOM.createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.55)",
          zIndex: 2147483646,
        }}
      />
      <div
        className="fixed left-1/2 top-1/2 z-[2147483647] -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "min(500px, 92vw)",
          borderRadius: 26,
          backgroundColor: "#FFFFFF",
          padding: "20px 22px 26px",
          boxShadow: "0 24px 50px rgba(0,0,0,0.28)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* タイトル */}
        <div className="flex items-start justify-between mb-3">
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            受け渡し場所に関する同意事項
          </h2>
          <button
            onClick={onClose}
            aria-label="閉じる"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* 同意項目 */}
        <div style={{ marginTop: 10 }}>
          <label className="flex items-start gap-3 mb-5">
            <input
              type="checkbox"
              checked={c1}
              onChange={(e) => setC1(e.target.checked)}
              className="mt-1"
            />
            <span style={{ fontSize: 14, lineHeight: 1.8 }}>
              自分で栽培した農作物のみを直接お客さまにお渡しします。転売や代理販売では利用しません。
            </span>
          </label>

          <label className="flex items-start gap-3 mb-5">
            <input
              type="checkbox"
              checked={c2}
              onChange={(e) => setC2(e.target.checked)}
              className="mt-1"
            />
            <span style={{ fontSize: 14, lineHeight: 1.8 }}>
              公共施設・公園・店舗敷地や迷惑駐車が必要な場所には登録しません。
              自宅・納屋・家族の所有地など、車をすぐ近くに停められる場所のみ登録します。
            </span>
          </label>

          <label className="flex items-start gap-3 mb-5">
            <input
              type="checkbox"
              checked={c3}
              onChange={(e) => setC3(e.target.checked)}
              className="mt-1"
            />
            <span style={{ fontSize: 14, lineHeight: 1.8 }}>
              屋根があり、雨天でも受け渡し可能な場所のみ登録します。
            </span>
          </label>
        </div>

        {/* ボタン */}
        <button
          disabled={!allChecked}
          onClick={onAgreed}
          style={{
            width: "100%",
            height: 56,
            marginTop: 12,
            background: allChecked ? "#111827" : "#D1D5DB",
            color: "#FFFFFF",
            borderRadius: 16,
            fontSize: 17,
            fontWeight: 700,
            cursor: allChecked ? "pointer" : "not-allowed",
            border: "none",
          }}
        >
          {buttonLabel}
        </button>
      </div>
    </>,
    document.body
  );
};

export default LocationConsentModal;
