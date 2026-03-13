import React, { useState, useEffect } from "react";
import LawPage from "../../Legal/LawPage";
import TermsPage from "../../Legal/TermsPage";

// ── Brand tokens (COLOR_STRATEGY.md準拠) ──
const C = {
  ink:       "#1a1108",
  ink2:      "#4b3e2a",
  ink3:      "#7a6c58",
  border:    "#e8e2d8",
  bgPale:    "#f4f1ed",
  bgBase:    "#fdfcfa",
} as const;

type Props = {
  agreed: boolean;
  onChange: (val: boolean) => void;
};

export function AgreementBlock({ agreed, onChange }: Props) {
  const [openModal, setOpenModal] = useState<"law" | "terms" | null>(null);

  useEffect(() => {
    if (openModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [openModal]);

  const isMobile = window.innerWidth < 480;

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginTop: 8 }}>

      {/* ★ 変更点: marginBottom を 20 から 32 に広げ、下のチェックボックスとの間隔を空けました */}
      <div style={{ marginBottom: 32, padding: "0 4px" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: "0 0 8px" }}>
          ご予約前のご確認
        </p>
        <ul style={{
          margin: 0,
          paddingLeft: 20,
          fontSize: 12,
          color: C.ink3,
          lineHeight: 1.6,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}>
          <li>システム利用料（300円）はキャンセル時も返金不可となります。</li>
          <li>品質不良や返品のご相談は、受け渡し当日その場で農家さんへ直接お伝えください。</li>
        </ul>
      </div>

      {/* チェックボックス：カード型 */}
      <div
        onClick={() => onChange(!agreed)}
        style={{
          background: "#ffffff",
          border: `1.5px solid ${agreed ? C.ink2 : C.border}`,
          borderRadius: 12,
          padding: "14px 16px",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          cursor: "pointer",
          transition: "border-color 0.15s",
        }}
      >
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

        <div>
          <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: C.ink, userSelect: "none" }}>
            規約に同意する
          </p>
          <p style={{ fontSize: 11, color: C.ink2, margin: 0, lineHeight: 1.6, userSelect: "none" }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpenModal("law"); }}
              style={{
                background: "none", border: "none", padding: 0,
                color: C.ink2, textDecoration: "underline",
                cursor: "pointer", fontSize: 11, fontFamily: "inherit",
              }}
            >
              特定商取引法に基づく表記
            </button>
            {" および "}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpenModal("terms"); }}
              style={{
                background: "none", border: "none", padding: 0,
                color: C.ink2, textDecoration: "underline",
                cursor: "pointer", fontSize: 11, fontFamily: "inherit",
              }}
            >
              利用規約
            </button>
            に同意したとみなされます。
          </p>
        </div>
      </div>

      {/* モーダルオーバーレイ */}
      {openModal && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)", zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "40px 0",
          }}
          onClick={() => setOpenModal(null)}
        >
          <div
            style={{
              background: "#ffffff",
              width: "100%",
              maxWidth: isMobile ? "100%" : "640px",
              height: isMobile ? "80vh" : "85vh",
              borderRadius: isMobile ? 0 : 12,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダー */}
            <div style={{
              display: "flex",
              justifyContent: "flex-end",
              padding: "8px 12px",
              borderBottom: `1px solid ${C.border}`,
              position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 10,
            }}>
              <button
                onClick={() => setOpenModal(null)}
                style={{
                  background: C.bgPale, border: "none", width: 36, height: 36,
                  borderRadius: "50%", fontSize: 24, cursor: "pointer", color: C.ink2,
                }}
              >×</button>
            </div>
            {/* コンテンツ */}
            <div style={{ overflowY: "auto", flex: 1, padding: 0, WebkitOverflowScrolling: "touch" }}>
              {/* ★ isModal={true} を渡してボトムバーを非表示にする */}
              {openModal === "law" && <LawPage isModal={true} />}
              {openModal === "terms" && <TermsPage isModal={true} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}