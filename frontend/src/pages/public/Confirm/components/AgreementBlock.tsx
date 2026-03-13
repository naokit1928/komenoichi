import React, { useState, useEffect } from "react";
import LawPage from "../../Legal/LawPage";
import TermsPage from "../../Legal/TermsPage";

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
    <div style={{ borderTop: "1px solid #e8e2d8", paddingTop: 20, marginTop: 8 }}>

      {/* 注意事項：左アクセントバー付き */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div style={{
          flexShrink: 0,
          width: 3,
          background: "#C62828",
          borderRadius: 2,
          margin: "2px 0",
        }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1108", margin: "0 0 8px" }}>
            ご予約前のご確認
          </p>
          <ul style={{
            margin: 0,
            paddingLeft: 16,
            fontSize: 13,
            color: "#4b3e2a",
            lineHeight: 1.7,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}>
            <li>お米代は受け渡し時に<strong style={{ color: "#1a1108", fontWeight: 600 }}>農家へ直接「現金」</strong>でお支払いください。</li>
            <li>システム利用料（300円）は<strong style={{ color: "#1a1108", fontWeight: 600 }}>キャンセル時も返金不可</strong>です。</li>
            <li>品質不良や返品のご相談は、<strong style={{ color: "#1a1108", fontWeight: 600 }}>受け渡し当日その場で</strong>農家さんへ直接お伝えください。</li>
          </ul>
        </div>
      </div>

      {/* チェックボックス：カード型 */}
      <div
        onClick={() => onChange(!agreed)}
        style={{
          background: "#f9f8f6",
          border: `1.5px solid ${agreed ? "#4b3e2a" : "#e8e2d8"}`,
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
          border: `1.5px solid #4b3e2a`,
          background: agreed ? "#4b3e2a" : "#fff",
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
          <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: "#1a1108", userSelect: "none" }}>
            上記の内容に同意する
          </p>
          <p style={{ fontSize: 11, color: "#4b3e2a", margin: 0, lineHeight: 1.6, userSelect: "none" }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpenModal("law"); }}
              style={{
                background: "none", border: "none", padding: 0,
                color: "#1a73e8", textDecoration: "underline",
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
                color: "#1a73e8", textDecoration: "underline",
                cursor: "pointer", fontSize: 11, fontFamily: "inherit",
              }}
            >
              利用規約
            </button>
            に同意したとみなされます。
          </p>
        </div>
      </div>

      {/* モーダル */}
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
            <div style={{
              display: "flex",
              justifyContent: "flex-end",
              padding: "8px 12px",
              borderBottom: "1px solid #e8e2d8",
              position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 10,
            }}>
              <button
                onClick={() => setOpenModal(null)}
                style={{
                  background: "#f3f4f6", border: "none", width: 36, height: 36,
                  borderRadius: "50%", fontSize: 24, cursor: "pointer", color: "#4b3e2a",
                }}
              >×</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: 0, WebkitOverflowScrolling: "touch" }}>
              {openModal === "law" && <LawPage />}
              {openModal === "terms" && <TermsPage />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
