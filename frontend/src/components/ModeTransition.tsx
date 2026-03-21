import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";

type Props = {
  active: boolean;
  label?: string;
};

export function ModeTransition({ active, label }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) { setVisible(false); return; }
    setVisible(true);
  }, [active]);

  if (!visible) return null;

  return ReactDOM.createPortal(
    <>
      <style>{`
        @keyframes overlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes logoEntry {
          0%   { opacity: 0; transform: translateY(24px) scale(0.72); }
          40%  { opacity: 1; transform: translateY(-4px) scale(1.05); }
          55%  { transform: translateY(1px) scale(0.98); }
          65%  { transform: scale(1); }
          75%  { transform: scale(1.08); }
          85%  { transform: scale(0.97); }
          100% { transform: scale(1); }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          backgroundColor: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 36,
          animation: "overlayIn 0.2s ease forwards",
        }}
      >
        <img
          src="/logo-red.png"
          alt="こめのいち"
          style={{
            width: 100,
            height: 100,
            animation: "logoEntry 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.05s forwards",
          }}
        />
        {/* アニメーションなし・最初から表示 */}
        <p style={{
          fontSize: 15,
          fontWeight: 500,
          color: "#111827",
          margin: 0,
          letterSpacing: "0.02em",
        }}>
          {label}
        </p>
      </div>
    </>,
    document.body
  );
}

export function triggerModeTransition(
  setTransition: (v: boolean) => void,
  navigate: (path: string, opts?: { replace?: boolean }) => void,
  path: string,
  delay = 1700
) {
  setTransition(true);
  setTimeout(() => {
    navigate(path, { replace: true });
  }, delay);
}
