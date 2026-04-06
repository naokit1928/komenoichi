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
            第1条（本サービスの目的と役割）
          </h2>
          <ul style={{ paddingLeft: 24, margin: 0, fontSize: 15, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>本サービスは、農家と消費者をマッチングし、農作物の予約受付および直接の受け渡しを支援するプラットフォームです。</li>
            <li>実際の商品の売買契約および代金の受け渡しは、農家とユーザーの間で直接行われるものであり、運営は取引の当事者にはなりません。</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", borderBottom: "1px solid #E5E7EB", paddingBottom: 8, marginBottom: 16 }}>
            第2条（受け渡しと代金の受領）
          </h2>
          <ul style={{ paddingLeft: 24, margin: 0, fontSize: 15, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>農家は、自らが設定した受け渡し日時に指定場所へ赴き、予約者へ商品を直接引き渡す義務を負います。</li>
            <li>商品の代金は、現地にて農家がユーザーから現金にて直接受け取るものとします。</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", borderBottom: "1px solid #E5E7EB", paddingBottom: 8, marginBottom: 16 }}>
            第3条（キャンセルとトラブル対応）
          </h2>
          <ul style={{ paddingLeft: 24, margin: 0, fontSize: 15, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>ユーザーからのキャンセルは、システム上にて「受け渡し開始時刻」まで可能です。それ以降のキャンセルや無断キャンセルが発生した場合の代金補償は、運営では一切行いません。なお、受け渡し時刻の3時間前を過ぎての直前キャンセルや無断キャンセルを繰り返したユーザーに対しては、プラットフォームの健全性を保つため、事前の予告なく自動的に本サービスの利用制限を行う等の対策を講じています。</li>
            <li>農家は、災害や悪天候、またはやむを得ない事情により、システム上からすでに受け付けた予約の受け渡しを緊急で停止（キャンセル）することができます。ただし、「自己都合」によるキャンセルを複数回繰り返す等、予約者からの信頼を著しく損なう行為が確認された場合、事前の予告なくアカウントの利用制限（利用停止等）の措置を講じる場合があります。</li>
            <li>本サービスで出品・販売できるお米は、<b>収穫から335日以内</b>かつ<b>精米から8日以内</b>のものに限ります。どちらか一方でも超えた場合は出品できません。無断キャンセル等により精米済みのお米がやむを得ず余った場合、冷蔵庫または冷暗所で保管のうえ翌週の販売に回すことができますが、再来週以降への繰り越しは品質上の理由から固く禁止します。</li>
            <li>品質（味、異物の混入など）に関するトラブルや返品・交換の申し出については、受け渡し時に当事者間で解決するものとし、運営は一切の責任を負いません。</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", borderBottom: "1px solid #E5E7EB", paddingBottom: 8, marginBottom: 16 }}>
            第4条（禁止事項）
          </h2>
          <ul style={{ paddingLeft: 24, margin: 0, fontSize: 15, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>食品表示法、食品衛生法、計量法その他の関係法令に違反する商品の出品。</li>
            <li>他人の権利（著作権、商標権、肖像権等）を侵害する画像やテキストの掲載。</li>
            <li>予約者との間での、本サービスを介さない直接取引へ誘導する行為。</li>
            <li>公序良俗に反する行為、または運営が不適切と判断する行為。</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", borderBottom: "1px solid #E5E7EB", paddingBottom: 8, marginBottom: 16 }}>
            第5条（サービスの停止・免責）
          </h2>
          <ul style={{ paddingLeft: 24, margin: 0, fontSize: 15, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>運営は、システム障害の発生、メンテナンスの実施、またはその他やむを得ない理由により、予告なく本サービスの提供を一時停止することがあります。これによって生じたいかなる損害についても、運営は責任を負いません。</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", borderBottom: "1px solid #E5E7EB", paddingBottom: 8, marginBottom: 16 }}>
            第6条（規約の変更）
          </h2>
          <ul style={{ paddingLeft: 24, margin: 0, fontSize: 15, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>運営は、必要と判断した場合には、利用者に事前通知することなく本規約を変更することができるものとします。変更後の規約は、本サービス上に掲示された時点から効力を生じるものとします。</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#111827", borderBottom: "1px solid #E5E7EB", paddingBottom: 8, marginBottom: 16 }}>
            第7条（準拠法・裁判管轄）
          </h2>
          <ul style={{ paddingLeft: 24, margin: 0, fontSize: 15, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生じた場合には、運営者の所在地を管轄する地方裁判所を第一審の専属的合意管轄裁判所とします。</li>
          </ul>
        </section>

      </div>

      <div style={{ marginTop: 40, textAlign: "right", fontSize: 14, color: "#6B7280" }}>
        制定日：2026年4月3日<br />
      </div>
    </div>
  );

  if (isModal) return content;

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column",
      minHeight: "100vh",
      background: "#fff"
    }}>
      <div style={{ flex: 1, paddingBottom: 80 }}>
        {content}
      </div>
      <Footer />
      {isFarmerMode ? <FarmerBottomBar /> : <PublicBottomBar />}
    </div>
  );
}