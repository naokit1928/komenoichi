import React, { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import PromotionCardDesign from "./PromotionCardDesign";
import PromotionPosterDesign from "./PromotionPosterDesign";

const C = {
  ink: "#111827", ink2: "#374151", ink3: "#6B7280",
  border: "#E5E7EB", bg: "#F9FAFB", red: "#EF4444",
} as const;

type FarmerMeResponse = { farm_id: number; is_registered: boolean; email: string | null; };

export default function FarmerPromotionPage() {
  const navigate = useNavigate();
  const farmerData = useOutletContext<FarmerMeResponse | null>();
  const farmId = farmerData?.farm_id;

  const [printType, setPrintType] = useState<"label" | "poster">("label");
  const [showCardModal, setShowCardModal] = useState(false);

  if (!farmId) return <div style={{ padding: 24 }}>読み込み中...</div>;

  const baseUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
  const farmUrl = `${baseUrl}/farms/${farmId}`;
  
  const cards = Array.from({ length: 10 });

  // ★ iOS Safari で印刷ボタンが効かないバグの対策
  const handlePrint = () => {
    // 0.05秒だけ遅延させることで、iOSのイベントブロックを回避して確実にダイアログを出す
    setTimeout(() => {
      window.print();
    }, 50);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F9FAFB", paddingBottom: 80 }}>
      <style>{`
        /* ── 画面表示用の縮小マジック ── */
        .preview-wrapper { 
          background: #E5E7EB; 
          padding: 32px 16px 20px 16px;
          display: flex; 
          flex-direction: column;
          align-items: center; 
          justify-content: center; 
          border-radius: 12px;
          overflow: hidden; 
          margin-bottom: 24px;
          position: relative;
        }

        /* ★ iOS Safari 縮小ズレ＆重なりバグ対策 */
        .sheet-scale-wrapper {
          transform-origin: top center;
          /* translateZ(0) でハードウェアアクセラレーションを強制し、描画バグを防ぐ */
          transform: scale(0.6) translateZ(0); 
          -webkit-transform: scale(0.6) translateZ(0);
          /* calc(mm) の計算バグを防ぐため、ピクセルでネガティブマージンを直指定 */
          margin-bottom: -449px; 
        }

        @media (max-width: 768px) {
          .sheet-scale-wrapper { 
            transform: scale(0.42) translateZ(0); 
            -webkit-transform: scale(0.42) translateZ(0);
            margin-bottom: -651px; 
          }
        }
        @media (max-width: 480px) {
          .sheet-scale-wrapper { 
            transform: scale(0.33) translateZ(0); 
            -webkit-transform: scale(0.33) translateZ(0);
            margin-bottom: -752px; 
          }
        }

        .sheet-preview { 
          background: #fff; 
          width: 210mm; 
          height: 297mm; 
          box-shadow: 0 12px 32px rgba(0,0,0,0.15); 
          position: relative; 
          /* ★ 超重要：iOS Safariの「文字サイズ勝手に肥大化機能」を強制無効化 */
          -webkit-text-size-adjust: none;
          text-size-adjust: none;
        }
        
        .print-grid {
          display: grid; grid-template-columns: 91mm 91mm; grid-template-rows: repeat(5, 55mm);
          padding: 11mm 14mm; box-sizing: border-box; width: 210mm; height: 297mm;
        }
        
        .click-wrapper { cursor: pointer; }
        .sheet-preview .label-card { border: 1px dashed #cbd5e1; }

        /* ── モーダル（拡大表示）のスタイル ── */
        .modal-overlay {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background-color: rgba(0, 0, 0, 0.75);
          display: flex; justify-content: center; align-items: center;
          z-index: 1000; cursor: pointer; backdrop-filter: blur(4px);
        }

        .modal-scale-wrapper {
          box-shadow: 0 20px 60px rgba(0,0,0,0.4); border-radius: 2px;
          transform-origin: center center;
          transform: scale(1) translateZ(0);
          -webkit-transform: scale(1) translateZ(0);
          -webkit-text-size-adjust: none;
          text-size-adjust: none;
        }
        
        @media (max-width: 400px) { .modal-scale-wrapper { transform: scale(0.9) translateZ(0); } }
        @media (max-width: 360px) { .modal-scale-wrapper { transform: scale(0.8) translateZ(0); } }
        @media (max-width: 320px) { .modal-scale-wrapper { transform: scale(0.7) translateZ(0); } }

        /* ★ iOS Safari 画面上での裏写り（2重レンダリング）を完全に防ぐ */
        @media screen { 
          .print-only { 
            position: absolute !important;
            width: 1px !important;
            height: 1px !important;
            padding: 0 !important;
            margin: -1px !important;
            overflow: hidden !important;
            clip: rect(0, 0, 0, 0) !important;
            white-space: nowrap !important;
            border: 0 !important;
          } 
        }
        
        /* 🖨️ 印刷時のスタイル */
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page { size: A4; margin: 0 !important; }
          body, html, #root { 
            width: 210mm !important; height: 297mm !important; margin: 0 !important; 
            padding: 0 !important; background: #fff !important; overflow: hidden !important; 
          }
          .no-print { display: none !important; }
          /* 印刷時のみ実体化させる */
          .print-only { 
            position: relative !important; 
            width: 210mm !important; height: 297mm !important; margin: 0 !important; padding: 0 !important;
            overflow: visible !important; clip: auto !important; white-space: normal !important;
            display: block !important;
          }
          .label-card { border: none !important; }
        }

        /* 印刷ボタンのスタイル */
        .print-btn {
          width: 100%; padding: 18px 16px; background: ${C.ink}; color: #fff;
          border: none; border-radius: 16px; font-size: 18px; font-weight: 700;
          cursor: pointer; box-shadow: 0 8px 16px rgba(0,0,0,0.1);
          transition: transform 0.1s ease-out, box-shadow 0.1s ease-out;
        }
        .print-btn:active {
          transform: scale(0.98); box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
      `}</style>

      {/* ── ヘッダー ── */}
      <header className="no-print" style={{ display: "flex", alignItems: "center", padding: "16px", backgroundColor: "#FFFFFF", borderBottom: "1px solid #E5E7EB", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ width: 40, display: "flex", justifyContent: "flex-start", alignItems: "center" }}>
          <button onClick={() => navigate("/farmer/menu")} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: "0 8px 0 0", color: "#111827", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#111827", flex: 1, textAlign: "center" }}>
          販促ツール印刷
        </h1>
        <div style={{ width: 40 }} />
      </header>

      {/* ── コンテンツ領域 ── */}
      <div className="no-print" style={{ padding: "24px 16px", maxWidth: 800, margin: "0 auto" }}>
        
        {/* 0. タブ切り替え */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px", background: C.border, padding: "4px", borderRadius: "12px" }}>
          <button 
            onClick={() => setPrintType("label")}
            style={{ flex: 1, padding: "12px", border: "none", borderRadius: "8px", fontSize: "15px", fontWeight: 700, cursor: "pointer", transition: "0.2s", background: printType === "label" ? "#fff" : "transparent", color: printType === "label" ? C.ink : C.ink3, boxShadow: printType === "label" ? "0 2px 8px rgba(0,0,0,0.05)" : "none" }}
          >
            10面ラベルシール
          </button>
          <button 
            onClick={() => setPrintType("poster")}
            style={{ flex: 1, padding: "12px", border: "none", borderRadius: "8px", fontSize: "15px", fontWeight: 700, cursor: "pointer", transition: "0.2s", background: printType === "poster" ? "#fff" : "transparent", color: printType === "poster" ? C.ink : C.ink3, boxShadow: printType === "poster" ? "0 2px 8px rgba(0,0,0,0.05)" : "none" }}
          >
            A4/A3 ポスター
          </button>
        </div>

        {/* 1. 用途説明 */}
        <div style={{ marginBottom: 24, padding: "0 4px" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
            {printType === "label" ? "出品物に貼るQRシール" : "掲示用ポスター"}
          </h2>
          <div style={{ fontSize: 14, color: C.ink2, lineHeight: 1.6, margin: 0 }}>
            {printType === "label" ? (
              "ご自身のお米予約ページへ案内するためのQRシールです。直売所に出す野菜の袋に貼ったり、チラシや名刺に添えたりと、使い方は自由です。お好きなアイデアで直販をアピールしてください。"
            ) : (
              "貼っておくだけで、通りがかった人からスマホでお米の予約を受け付けられるポスターです。ご自宅や畑の周辺はもちろん、ご自身の直販イベントなど、さまざまな場所や場面で自由にご活用いただけます。"
            )}
          </div>
        </div>

        {/* 2. プレビュー領域 */}
        {printType === "label" ? (
          <div className="preview-wrapper">
            <div className="click-wrapper" onClick={() => setShowCardModal(true)}>
              <div className="sheet-scale-wrapper">
                <div className="sheet-preview">
                  <div className="print-grid">
                    {cards.map((_, i) => (
                      <div key={`preview-${i}`}>
                        <PromotionCardDesign farmUrl={farmUrl} farmId={farmId} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: "center", color: C.ink3, fontSize: "12px", marginTop: "12px", pointerEvents: "none" }}>
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

        {/* 3. アクション＆インフォメーションエリア */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* ★ 修正した関数を呼び出すように変更 */}
          <button type="button" onClick={handlePrint} className="print-btn">
            この{printType === "label" ? "シート" : "ポスター"}を印刷する
          </button>

          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
            
            {printType === "label" && (
              <div style={{ marginBottom: 16, padding: "16px", background: C.bgPale, borderRadius: 12, fontSize: 13, color: C.ink2, lineHeight: 1.6, border: `1px solid ${C.border}` }}>
                <strong style={{ color: C.ink, display: "block", marginBottom: 8 }}>【印刷のご注意】</strong>
                <div>
                  市販のA4・10面ラベルシール「エーワン 72110」をご用意いただき、<b style={{ color: C.ink }}>ご自宅のプリンター</b>で印刷してください。<br />
                  <div style={{ color: C.ink, fontWeight: 700, marginTop: 6 }}>
                    ※コンビニのコピー機はシール紙の持ち込みが禁止されています。機械の故障の原因となるため、絶対に行わないでください。
                  </div>
                </div>
              </div>
            )}

            {printType === "poster" && (
              <div style={{ marginBottom: 16, padding: "16px", background: C.bgPale, borderRadius: 12, fontSize: 13, color: C.ink2, lineHeight: 1.6, border: `1px solid ${C.border}` }}>
                <strong style={{ color: C.ink, display: "block", marginBottom: 8 }}>【きれいに掲示するコツ】</strong>
                <div style={{ marginBottom: 8 }}>
                  <b style={{ color: C.ink }}>コンビニ印刷（A3対応・水濡れに強い）がおすすめ：</b><br />
                  上の「印刷する」ボタンを押し、<b style={{ color: C.ink }}>送信先を「PDFとして保存」</b>にしてスマホ等に保存してから、各コンビニの印刷アプリをご利用ください。
                </div>
                <div>
                  <b style={{ color: C.ink }}>屋外に貼る場合：</b><br />
                  ラミネート加工するか、100円ショップの「硬質クリアケース（プラスチックの下敷きのようなケース）」に入れると雨を防げます。
                </div>
              </div>
            )}

            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", padding: "12px 16px", borderRadius: 12 }}>
              <span style={{ color: C.red, fontSize: 13, fontWeight: 700 }}>⚠️ 印刷時は必ず「余白：なし」に設定してください。</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── 印刷用データ（画面上では完全に非表示） ── */}
      <div className="print-only">
        {printType === "label" ? (
          <div className="print-grid">
            {cards.map((_, i) => (
              <PromotionCardDesign key={`print-${i}`} farmUrl={farmUrl} farmId={farmId} />
            ))}
          </div>
        ) : (
          <PromotionPosterDesign farmUrl={farmUrl} farmId={farmId} />
        )}
      </div>

      {/* ── ラベル用 拡大モーダル ── */}
      {showCardModal && (
        <div className="modal-overlay no-print" onClick={() => setShowCardModal(false)}>
          <div className="modal-scale-wrapper">
            <PromotionCardDesign farmUrl={farmUrl} farmId={farmId} />
          </div>
        </div>
      )}
    </div>
  );
}