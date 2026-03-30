import React, { useState, useRef } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import PromotionCardDesign from "./PromotionCardDesign";
import PromotionPosterDesign from "./PromotionPosterDesign";

const C = {
  ink:    "#111827",
  ink2:   "#374151",
  ink3:   "#6B7280",
  border: "#E5E7EB",
  bg:     "#F9FAFB",
  bgCard: "#ffffff",
  red:    "#EF4444",
} as const;

type FarmerMeResponse = {
  farm_id: number;
  is_registered: boolean;
  email: string | null;
};

export default function FarmerPromotionPage() {
  const navigate = useNavigate();
  const farmerData = useOutletContext<FarmerMeResponse | null>();
  const farmId = farmerData?.farm_id;

  const [printType, setPrintType] = useState<"label" | "poster">("label");
  const [showCardModal, setShowCardModal] = useState(false);
  const [generating, setGenerating] = useState(false);

  const captureRef = useRef<HTMLDivElement>(null);

  if (!farmId) return <div style={{ padding: 24 }}>読み込み中...</div>;

  const baseUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
  const farmUrl = `${baseUrl}/farms/${farmId}`;
  const cards = Array.from({ length: 10 });

  const handleDownloadPDF = async () => {
    if (!captureRef.current || generating) return;
    setGenerating(true);

    try {
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 300));

      const el = captureRef.current;
      const canvas = await html2canvas(el, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      
      const doc = new jsPDF({ 
        orientation: "portrait", 
        unit: "mm", 
        format: "a4",
        compress: true 
      });
      
      doc.addImage(imgData, "JPEG", 0, 0, 210, 297);

      const filename = printType === "poster"
        ? "komenoichi-poster.pdf"
        : "komenoichi-labels.pdf";
      doc.save(filename);

    } catch (e) {
      console.error("PDF生成エラー:", e);
      alert("PDFの生成に失敗しました。再度お試しください。");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg, paddingBottom: 80 }}>
      <style>{`
        .preview-wrapper {
          background: #E5E7EB; padding: 32px 16px 20px; display: flex;
          flex-direction: column; align-items: center; border-radius: 12px;
          overflow: hidden; margin-bottom: 24px;
        }
        .sheet-scale-wrapper {
          transform-origin: top center; transform: scale(0.6);
          margin-bottom: calc(297mm * 0.6 - 297mm);
        }
        @media (max-width: 768px) {
          .sheet-scale-wrapper { transform: scale(0.42); margin-bottom: calc(297mm * 0.42 - 297mm); }
        }
        @media (max-width: 480px) {
          .sheet-scale-wrapper { transform: scale(0.33); margin-bottom: calc(297mm * 0.33 - 297mm); }
        }
        .sheet-preview {
          background: #fff; width: 210mm; height: 297mm;
          box-shadow: 0 12px 32px rgba(0,0,0,0.15);
          -webkit-text-size-adjust: none; text-size-adjust: none;
        }
        .print-grid {
          display: grid; grid-template-columns: 91mm 91mm; grid-template-rows: repeat(5, 55mm);
          padding: 11mm 14mm; box-sizing: border-box; width: 210mm; height: 297mm;
        }
        .click-wrapper { cursor: pointer; }
        .sheet-preview .label-card { border: 1px dashed #cbd5e1; }
        .modal-overlay {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background-color: rgba(0,0,0,0.75); display: flex; justify-content: center;
          align-items: center; z-index: 1000; cursor: pointer; backdrop-filter: blur(4px);
        }
        /* ★ ボタンのスタイル修正（1行に収める、文字を少し小さく、折り返し禁止） */
        .pdf-btn {
          width: 100%; padding: 16px; background: #111827; color: #fff;
          border: none; border-radius: 16px; font-size: 16px; font-weight: 700;
          cursor: pointer; box-shadow: 0 8px 16px rgba(0,0,0,0.1);
          transition: transform 0.1s ease-out, box-shadow 0.1s ease-out, opacity 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          white-space: nowrap; /* 2行になるのを防止 */
          overflow: hidden; text-overflow: ellipsis; /* 万が一はみ出たら「...」にする */
        }
        .pdf-btn:active { transform: scale(0.98); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .pdf-btn:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>

      {/* ヘッダー */}
      <header style={{
        display: "flex", alignItems: "center", padding: "16px",
        backgroundColor: "#fff", borderBottom: `1px solid ${C.border}`,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ width: 40 }}>
          <button onClick={() => navigate("/farmer/menu")} style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "0 8px 0 0", color: C.ink, display: "flex", alignItems: "center",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: C.ink, flex: 1, textAlign: "center" }}>
          販促ツール
        </h1>
        <div style={{ width: 40 }} />
      </header>

      <div style={{ padding: "24px 16px", maxWidth: 800, margin: "0 auto" }}>

        {/* タブ */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, background: C.border, padding: 4, borderRadius: 12 }}>
          {(["label", "poster"] as const).map((type) => (
            <button key={type} onClick={() => setPrintType(type)} style={{
              flex: 1, padding: 12, border: "none", borderRadius: 8,
              fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "0.2s",
              background: printType === type ? "#fff" : "transparent",
              color: printType === type ? C.ink : C.ink3,
              boxShadow: printType === type ? "0 2px 8px rgba(0,0,0,0.05)" : "none",
            }}>
              {type === "label" ? "10面ラベルシール" : "A4/A3 ポスター"}
            </button>
          ))}
        </div>

        {/* 説明 */}
        <div style={{ marginBottom: 24, padding: "0 4px" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
            {printType === "label" ? "出品物に貼るQRシール" : "掲示用ポスター"}
          </h2>
          <p style={{ fontSize: 14, color: C.ink2, lineHeight: 1.6, margin: 0 }}>
            {printType === "label"
              ? "ご自身のお米予約ページへ案内するためのQRシールです。直売所に出す野菜の袋に貼ったり、チラシや名刺に添えたりと、使い方は自由です。"
              : "貼っておくだけで、通りがかった人からスマホでお米の予約を受け付けられるポスターです。ご自宅・畑・イベント会場などでご活用ください。"}
          </p>
        </div>

        {/* プレビュー */}
        {printType === "label" ? (
          <div className="preview-wrapper">
            <div className="click-wrapper" onClick={() => setShowCardModal(true)}>
              <div className="sheet-scale-wrapper">
                <div className="sheet-preview">
                  <div className="print-grid">
                    {cards.map((_, i) => (
                      <div key={i}>
                        <PromotionCardDesign farmUrl={farmUrl} farmId={farmId} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: "center", color: C.ink3, fontSize: 12, marginTop: 12 }}>
              タップするとデザインを拡大して確認できます
            </div>
          </div>
        ) : (
          <div className="preview-wrapper">
            <div className="sheet-scale-wrapper">
              <div className="sheet-preview">
                <PromotionPosterDesign farmUrl={farmUrl} farmId={farmId} />
              </div>
            </div>
          </div>
        )}

        {/* アクション */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ★ ボタン文言も少しスッキリとさせ、確実に1行に収まるように調整 */}
          <button type="button" onClick={handleDownloadPDF} disabled={generating} className="pdf-btn">
            {generating ? (
              <>⏳ 高画質PDFを作成中…</>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                PDFを保存（ダウンロード）
              </>
            )}
          </button>

          <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>

            {printType === "label" && (
              <div style={{ marginBottom: 16, padding: 16, background: C.bg, borderRadius: 12, fontSize: 13, color: C.ink2, lineHeight: 1.7, border: `1px solid ${C.border}` }}>
                <strong style={{ color: C.ink, display: "block", marginBottom: 8 }}>【印刷のながれ】</strong>
                <div style={{ marginBottom: 6 }}>
                  <b style={{ color: C.ink }}>① 上のボタンでPDFを保存する</b><br />
                  スマホやパソコン内にPDFファイルが保存されます。
                </div>
                <div style={{ marginBottom: 6 }}>
                  <b style={{ color: C.ink }}>② 自宅のプリンターで印刷</b><br />
                  市販のA4・10面ラベルシール「<b style={{ color: C.ink }}>エーワン 72110</b>」をご自宅のプリンターにセットし印刷してください。（印刷設定は「実際のサイズ」にしてください）
                </div>
                <div style={{ color: C.ink, fontWeight: 700 }}>
                  ※コンビニのコピー機はシール紙の持ち込みが禁止されています。必ずご自宅のプリンターをお使いください。
                </div>
              </div>
            )}

            {printType === "poster" && (
              <div style={{ marginBottom: 16, padding: 16, background: C.bg, borderRadius: 12, fontSize: 13, color: C.ink2, lineHeight: 1.7, border: `1px solid ${C.border}` }}>
                <strong style={{ color: C.ink, display: "block", marginBottom: 8 }}>【印刷のながれ】</strong>
                <div style={{ marginBottom: 6 }}>
                  <b style={{ color: C.ink }}>① 上のボタンでPDFを保存する</b><br />
                  スマホやパソコン内にPDFファイルが保存されます。
                </div>
                <div style={{ marginBottom: 6 }}>
                  <b style={{ color: C.ink }}>② コンビニアプリ等で印刷</b><br />
                  保存したPDFをコンビニ印刷アプリ（A3対応・水濡れに強くておすすめ）に送るか、ご自宅のプリンターで印刷してください。
                </div>
                <div>
                  <b style={{ color: C.ink }}>屋外に貼る場合：</b><br />
                  ラミネート加工か、100円ショップの「硬質クリアケース」に入れると雨を防げます。
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* キャプチャ用実寸要素を「画面外の安全な領域」に完全に隠蔽 */}
      <div style={{ position: "absolute", top: "-9999px", left: "-9999px", zIndex: -9999 }}>
        <div ref={captureRef} style={{ width: "210mm", height: "297mm", backgroundColor: "#fff" }}>
          {printType === "label" ? (
            <div className="print-grid">
              {cards.map((_, i) => (
                <PromotionCardDesign key={i} farmUrl={farmUrl} farmId={farmId} />
              ))}
            </div>
          ) : (
            <PromotionPosterDesign farmUrl={farmUrl} farmId={farmId} />
          )}
        </div>
      </div>

      {/* 拡大モーダル */}
      {showCardModal && (
        <div className="modal-overlay" onClick={() => setShowCardModal(false)}>
          <PromotionCardDesign farmUrl={farmUrl} farmId={farmId} />
        </div>
      )}
    </div>
  );
}