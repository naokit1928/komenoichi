// frontend/src/pages/public/FarmerLanding/FarmerLandingPage.tsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "@/components/Footer";

// ── Brand tokens (お米の暖かみと洗練) ──
const C = {
  ink:       "#1a1108",
  ink2:      "#4b3e2a",
  ink3:      "#5c4d3c", 
  border:    "#e8e2d8",
  bgBase:    "#fdfcfa",
  bgPale:    "#f4f1ed",
  red:       "#C62828",
  gold:      "#C49A1A",
  goldLight: "rgba(196,154,26,0.08)",
} as const;

export default function FarmerLandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bgBase, display: "flex", flexDirection: "column", fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif" }}>
      
      {/* ── ヘッダー ── */}
      <header style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}`, backgroundColor: "#fff", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.ink, letterSpacing: "0.05em" }}>
          Komenoichi
        </div>
        <button
          onClick={() => navigate("/apply")} // ★ 変更: 事前エントリーページへ誘導
          style={{ background: C.ink, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          農家登録（無料）
        </button>
      </header>

      {/* ── ヒーローセクション ── */}
      <section style={{ padding: "80px 24px 56px", maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{
          fontSize: 26,
          fontWeight: 800,
          color: C.ink,
          lineHeight: 1.5,
          marginBottom: 20,
          textAlign: "center",
          wordBreak: "keep-all", 
        }}>
          <span style={{ display: "inline-block" }}>農家さんの</span><span style={{ display: "inline-block" }}>出品・維持手数料は、</span><br />
          <span style={{ color: C.red, textDecoration: "underline", textUnderlineOffset: 4, textDecorationColor: C.goldLight, display: "inline-block", marginTop: 8 }}>一切無料。</span>
        </h1>
        <p style={{
          fontSize: 16,
          color: C.ink3,
          lineHeight: 1.8,
        }}>
          購入者が支払うシステム利用料も、1回たったの300円と非常に安価で負担が軽い仕組み。<br />
          これにより、農家さんは完全にノーリスクで「自分だけの直売所」を始められます。
        </p>
      </section>

      {/* ── 利益シミュレーション ── */}
      <section style={{ padding: "40px 24px", backgroundColor: "#fff", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <span style={{ display: "inline-block", background: C.goldLight, color: C.gold, padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
              直売所との利益比較
            </span>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>
              売れば売るほど、<br />農家さんの利益が残る。
            </h2>
          </div>

          <div style={{ background: C.bgPale, borderRadius: 20, padding: "28px", marginBottom: 28, boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: 14, color: C.ink2, fontWeight: 600, marginBottom: 14, textAlign: "center" }}>
              例えば「白米25kg（15,900円）」が売れた場合
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, background: "#fff", padding: "18px 12px", borderRadius: 14, opacity: 0.8, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: C.ink3, marginBottom: 5 }}>一般的な直売所<br />(手数料15%想定)</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>- 2,385円</div>
              </div>
              <div style={{ fontSize: 24, color: C.border, transform: "scaleY(1.2)" }}>▶︎</div>
              <div style={{ flex: 1, background: "#fff", padding: "18px 12px", borderRadius: 14, border: `2px solid ${C.red}`, position: "relative", textAlign: "center" }}>
                <div style={{ position: "absolute", top: -10, right: -10, background: C.red, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>完全無料</div>
                <div style={{ fontSize: 11, color: C.ink3, marginBottom: 5 }}>Komenoichi<br />(農家負担)</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.red }}>0円</div>
              </div>
            </div>
            <div style={{ marginTop: 20, fontSize: 16, fontWeight: 700, color: C.ink, textAlign: "center" }}>
              手取りが <span style={{ color: C.red, fontSize: 22 }}>2,385円</span> もアップします！
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "center", border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}`, color: C.ink2, backgroundColor: "#fff" }}>
                <th style={{ padding: "14px 4px", fontWeight: 600 }}>販売量</th>
                <th style={{ padding: "14px 4px", fontWeight: 600 }}>直売所(15%)</th>
                <th style={{ padding: "14px 4px", fontWeight: 800, color: C.ink, backgroundColor: "#fff" }}>Komenoichi<br /><span style={{fontSize: 10, color: C.red, fontWeight: 600}}>（農家負担）</span></th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: "#fdfcfa" }}>
                <td style={{ padding: "18px 4px" }}>5kg<br /><span style={{ fontSize: 11, color: C.ink3 }}>3,500円</span></td>
                <td style={{ padding: "18px 4px", color: C.ink3 }}>- 525円</td>
                <td style={{ padding: "18px 4px", fontWeight: 700, color: C.red }}>0円</td>
              </tr>
              <tr style={{ backgroundColor: "#fff" }}>
                <td style={{ padding: "18px 4px" }}>10kg<br /><span style={{ fontSize: 11, color: C.ink3 }}>6,600円</span></td>
                <td style={{ padding: "18px 4px", color: C.ink3 }}>- 990円</td>
                <td style={{ padding: "18px 4px", fontWeight: 700, color: C.red }}>0円</td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: C.ink3, marginTop: 16, textAlign: "center", lineHeight: 1.5 }}>※価格・手数料はすべて一例です。Komenoichiは購入者がシステム利用料（300円）を支払うため、農家側の手数料は常に0円となります。</p>
        </div>
      </section>

      {/* ── 3つのメリット ── */}
      <section style={{ padding: "64px 24px 80px", maxWidth: 640, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.ink, textAlign: "center", marginBottom: 40, position: "relative" }}>
          <span style={{ position: "relative", zIndex: 1 }}>Komenoichiが選ばれる理由</span>
          <span style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", width: 60, height: 4, background: C.goldLight, borderRadius: 2 }}></span>
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: C.ink, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, flexShrink: 0, boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>1</div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: C.ink, marginBottom: 10, lineHeight: 1.3 }}>「まとめて」渡すだけ。効率販売。</h3>
              <p style={{ fontSize: 14, color: C.ink3, lineHeight: 1.7 }}>予約状況は管理画面で完璧にまとまっています（週ごとの予約表、売上統計）。「土曜の午前中」など、農家さんが決めた時間に複数の予約者をまとめて対応できるため、販売にかかる手間と時間を劇的に短縮できます。重いお米をトラックに積んで、どこかへ持ち運ぶ必要もありません。</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: C.bgPale, color: C.ink2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, flexShrink: 0 }}>2</div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: C.ink, marginBottom: 10, lineHeight: 1.3 }}>電話対応ゼロ。スマホで在庫管理。</h3>
              <p style={{ fontSize: 14, color: C.ink3, lineHeight: 1.7 }}>作業中に鳴る予約電話、手帳での管理、Komenoichiがすべて引き受けます。お客様はスマホで24時間予約でき、農家さんは管理画面で在庫（kg）を設定するだけ。農家さんの生活ペースを最優先できます。</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: C.bgPale, color: C.ink2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, flexShrink: 0 }}>3</div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: C.ink, marginBottom: 10, lineHeight: 1.3 }}>農家さんは「ノーリスク」。事前決済でドタキャン防止。</h3>
              <p style={{ fontSize: 14, color: C.ink3, lineHeight: 1.7 }}>初期費用、月額費用、販売手数料は一切かかりません（農家負担ゼロ）。お客様からの予約時に、システム利用料（300円）を事前にクレジットカード決済していただく仕組みのため、いたずら予約や無断キャンセル（ノーショー）を強力に防止します。</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "0 24px 88px", textAlign: "center", backgroundColor: "#fff", borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 400, margin: "0 auto", marginTop: 56 }}>
          <button
            onClick={() => navigate("/apply")} // ★ 変更: 事前エントリーページへ誘導
            style={{ width: "100%", background: C.ink, color: "#fff", border: "none", padding: "18px 24px", borderRadius: 999, fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", transition: "all 0.2s", outline: "none" }}
          >
            無料で農家登録してみる
          </button>
          
          {/* ★ 修正：自然なテキストの折り返しに戻し、コンテナを中央に配置しました */}
          <div style={{ marginTop: 20, maxWidth: 350, margin: "20px auto 0" }}>
            <p style={{ fontSize: 13, color: C.ink3, lineHeight: 1.6, margin: 0, textAlign: "left" }}>
              初期費用・月額費用・販売手数料は一切かかりません（農家負担ゼロ）。<br />
              まずは登録して、管理画面の使いやすさを体験してください。
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}