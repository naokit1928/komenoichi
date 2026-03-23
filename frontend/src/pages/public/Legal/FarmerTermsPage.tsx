// frontend/src/pages/legal/FarmerTermsPage.tsx
import React from "react";
import { useSearchParams } from "react-router-dom";
import Footer from "@/components/Footer";
import { PublicBottomBar } from "@/components/PublicBottomBar";
import { FarmerBottomBar } from "@/components/FarmerBottomBar";

export default function FarmerTermsPage({ isModal = false }: { isModal?: boolean }) {
  const [searchParams] = useSearchParams();
  const isFarmerMode = searchParams.get("from") === "farmer";

  const content = (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px", color: "#374151", lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 32, color: "#111827" }}>
        農家向け利用規約
      </h1>
      
      <p style={{ marginBottom: 32, fontSize: 15 }}>
        「こめのいち」（以下「本サービス」といいます）を農家としてご利用いただくにあたり、以下の規約（以下「本規約」といいます）への同意が必要です。アカウントを登録された時点で、本規約に同意したものとみなされます。
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", borderBottom: "1px solid #E5E7EB", paddingBottom: 8, marginBottom: 16 }}>
            第1条（予約の受付とキャンセル）
          </h2>
          <ul style={{ paddingLeft: 24, margin: 0, fontSize: 15, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>本サービスにおける新規予約の受付は、設定された受け渡し開始時刻の3時間前に締め切られます。それ以降の新規予約は翌週以降の扱いとなります。</li>
            <li>予約者によるキャンセル手続きは、受け渡し直前まで可能な仕様となっております。農家（以下「利用者」といいます）は、受け渡し場所へ向かう前に必ず本サービス上で最新の予約状況をご確認ください。</li>
          </ul>
        </section>

        {/* ★ 追加：取扱商品と場所の制限 */}
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", borderBottom: "1px solid #E5E7EB", paddingBottom: 8, marginBottom: 16 }}>
            第2条（取扱商品および受け渡し場所の制限）
          </h2>
          <ul style={{ paddingLeft: 24, margin: 0, fontSize: 15, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>利用者は、本サービスにおいて、自身が直接栽培・生産した農作物のみを取り扱うものとします。第三者からの仕入れによる転売や代理販売での利用は固く禁じます。</li>
            <li>受け渡し場所として、公共施設、公園、他店舗の敷地、または路上駐車などの迷惑行為が必要となる場所を登録することはできません。</li>
            <li>登録可能な受け渡し場所は、利用者の自宅、納屋、または自身や家族が所有する土地など、予約者が車両を安全に停車できる場所に限ります。</li>
            <li>受け渡し場所は、屋根があり雨天時でも商品の受け渡しが可能な場所であることを必須とします。</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", borderBottom: "1px solid #E5E7EB", paddingBottom: 8, marginBottom: 16 }}>
            第3条（無断キャンセルと免責）
          </h2>
          <ul style={{ paddingLeft: 24, margin: 0, fontSize: 15, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>本サービスにおける農作物の代金は、受け渡し時の現地現金決済となります。</li>
            <li>予約者による無断キャンセル（ノーショー）が発生した場合であっても、運営は代金の補償を一切行いません。</li>
            <li>運営は、無断キャンセルを行った予約者に対する仲裁、ペナルティの付与、または利用制限の措置を行う義務を負わないものとします。</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", borderBottom: "1px solid #E5E7EB", paddingBottom: 8, marginBottom: 16 }}>
            第4条（商品の事前準備に関する推奨および非推奨）
          </h2>
          <ul style={{ paddingLeft: 24, margin: 0, fontSize: 15, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>予約者の受け渡し時の待ち時間を軽減するため、利用者は予約された農作物の一部を事前に精米・袋詰めしておくことが推奨されます。</li>
            <li>ただし、前条に定める無断キャンセルのリスクを考慮し、予約された全量を事前に精米・準備しておくことは推奨いたしません。事前準備の範囲および判断は、利用者の自己責任において行うものとします。</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", borderBottom: "1px solid #E5E7EB", paddingBottom: 8, marginBottom: 16 }}>
            第5条（品質トラブルおよび当事者間解決の原則）
          </h2>
          <ul style={{ paddingLeft: 24, margin: 0, fontSize: 15, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>農作物の品質、数量、状態等に関するトラブル、クレーム、または返品・交換の要求については、利用者と予約者の当事者間で直接解決するものとします。</li>
            <li>運営は、農作物の品質保証、瑕疵担保責任、およびトラブルへの介入を一切行いません。</li>
            <li>本サービスでは、予約者に対し「返品・交換の申し出は受け渡し時にその場で行うこと」を定めています。受け渡し完了後の返品対応については原則不要とし、実際の対応は利用者の任意の判断に委ねられるものとします。</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", borderBottom: "1px solid #E5E7EB", paddingBottom: 8, marginBottom: 16 }}>
            第6条（利用制限およびアカウントの停止）
          </h2>
          <ul style={{ paddingLeft: 24, margin: 0, fontSize: 15, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>運営は、利用者が以下の各号のいずれかに該当すると判断した場合、事前の通知をすることなく、当該利用者に対して本サービスの利用を制限し、またはアカウントを停止することができるものとします。
              <ul style={{ paddingLeft: 20, marginTop: 8, listStyleType: "circle" }}>
                <li>本規約（特に第2条の禁止事項等）のいずれかの条項に違反した場合</li>
                <li>予約者または第三者に対し、著しく不利益を与える行為や迷惑行為を行った場合</li>
                <li>公序良俗に反する行為、または運営が不適切と判断した行為を行った場合</li>
                <li>その他、本サービスの運営に支障をきたすと判断した場合</li>
              </ul>
            </li>
            <li>運営は、本条に基づき運営が行った措置により利用者に生じた損害について、一切の責任を負わないものとします。</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", borderBottom: "1px solid #E5E7EB", paddingBottom: 8, marginBottom: 16 }}>
            第7条（規約の変更）
          </h2>
          <ul style={{ paddingLeft: 24, margin: 0, fontSize: 15, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>運営は、必要と判断した場合には、利用者に事前通知することなく本規約を変更することができるものとします。変更後の規約は、本サービス上に掲示された時点から効力を生じるものとします。</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", borderBottom: "1px solid #E5E7EB", paddingBottom: 8, marginBottom: 16 }}>
            第8条（準拠法・裁判管轄）
          </h2>
          <ul style={{ paddingLeft: 24, margin: 0, fontSize: 15, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生じた場合には、運営者の所在地を管轄する地方裁判所を第一審の専属的合意管轄裁判所とします。</li>
          </ul>
        </section>

      </div>

      <p style={{ marginTop: 40, fontSize: 14, color: "#6B7280" }}>
        制定日：2026年3月24日<br />
      </p>
    </div>
  );

  if (isModal) return content;

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      minHeight: "100vh", 
      backgroundColor: isFarmerMode ? "#F7F7F7" : "#fdfcfa" 
    }}>
      <div style={{ flexGrow: 1, paddingBottom: 80 }}>{content}</div>
      <Footer />
      {isFarmerMode ? <FarmerBottomBar /> : <PublicBottomBar />}
    </div>
  );
}