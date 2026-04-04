// frontend/src/pages/public/ConfirmPage/components/AgreementBlock.tsx
import React, { useState, useEffect } from "react";
import LawPage from "../../Legal/LawPage";
import TermsPage from "../../Legal/TermsPage";

const C = {
  ink:    "#1a1108",
  ink2:   "#4b3e2a",
  ink3:   "#7a6c58",
  border: "#e8e2d8",
} as const;

type Props = {
  agreed: boolean;
  onChange: (val: boolean) => void;
};

export function AgreementBlock({ agreed, onChange }: Props) {
  const [openModal, setOpenModal] = useState<"law" | "terms" | null>(null);

  useEffect(() => {
    document.body.style.overflow = openModal ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [openModal]);

  return (
    <div style={{ paddingTop: 4, marginTop: 4 }}>

      {/* ── 注意事項（2行のみ） ── */}
      <ul style={{
        margin: "0 0 20px",
        paddingLeft: 18,
        fontSize: 12,
        color: C.ink3,
        lineHeight: 1.7,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}>
        <li>受け取りに来られない場合は早めにキャンセルしてください。無断キャンセルが続くとご利用が制限されます。</li>
        <li>品質に関するご相談は、受け渡し当日その場で農家さんへ直接お伝えください。</li>
      </ul>

      {/* ── チェックボックス ── */}
      <div
        onClick={() => onChange(!agreed)}
        style={{
          background: agreed ? "#fafaf9" : "#ffffff",
          border: `1.5px solid ${agreed ? C.ink2 : "#d4c8b8"}`,
          borderRadius: 12,
          padding: "14px 16px",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          cursor: "pointer",
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        {/* チェックマーク */}
        <div style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          border: `1.5px solid ${C.ink2}`,
          background: agreed ? C.ink2 : "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 1,
          transition: "background 0.15s",
        }}>
          {agreed && (
            <div style={{
              width: 5,
              height: 9,
              borderRight: "2px solid #fff",
              borderBottom: "2px solid #fff",
              transform: "rotate(45deg)",
              marginBottom: 2,
            }} />
          )}
        </div>

        {/* テキスト */}
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: C.ink, userSelect: "none" }}>
            上記を確認し、規約に同意する
          </p>
          <p style={{ fontSize: 11, color: C.ink3, margin: 0, lineHeight: 1.6, userSelect: "none" }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpenModal("law"); }}
              style={{ background: "none", border: "none", padding: 0, color: C.ink3, textDecoration: "underline", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}
            >
              特定商取引法に基づく表記
            </button>
            {" および "}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpenModal("terms"); }}
              style={{ background: "none", border: "none", padding: 0, color: C.ink3, textDecoration: "underline", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}
            >
              利用規約
            </button>
          </p>
        </div>
      </div>

      {/* ── 法務モーダル ── */}
      {openModal && (() => {
        const isLaw = openModal === "law";
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} onClick={() => setOpenModal(null)} />
            <div style={{ position: "relative", width: "100%", maxWidth: 600, background: "#fff", height: "85vh", borderTopLeftRadius: 20, borderTopRightRadius: 20, display: "flex", flexDirection: "column", animation: "slideUp 0.3s ease-out" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.ink }}>
                  {isLaw ? "特定商取引法に基づく表記" : "利用規約"}
                </h2>
                <button onClick={() => setOpenModal(null)} style={{ background: "none", border: "none", fontSize: 24, color: C.ink3, cursor: "pointer", padding: 4 }}>×</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {isLaw ? <LawPage isModal /> : <TermsPage isModal />}
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
