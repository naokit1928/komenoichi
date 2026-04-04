import React from "react";
import { useSearchParams } from "react-router-dom";
import Footer from "@/components/Footer";
import { PublicBottomBar } from "@/components/PublicBottomBar";
import { FarmerBottomBar } from "@/components/FarmerBottomBar";

export default function TermsPage({ isModal = false }: { isModal?: boolean }) {
  const [searchParams] = useSearchParams();
  const isFarmerMode = searchParams.get("from") === "farmer";

  const content = (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px", fontSize: 15, color: "#374151", lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 32, color: "#111827" }}>利用規約</h1>
      
      <p style={{ marginBottom: 24 }}>
        この利用規約（以下、「本規約」といいます。）は、「こめのいち」（以下、「本サービス」といいます。）の利用条件を定めるものです。
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16, color: "#111827" }}>第1条（本サービスの特徴と役割）</h2>
      <p style={{ marginBottom: 16 }}>
        本サービスは、農家と消費者をマッチングし、農作物の予約手配および直接の受け渡しを支援するプラットフォームです。実際の商品の売買および代金の受け渡しは、ユーザーと農家の間で直接行われるものであり、運営は取引の当事者にはなりません。
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16, color: "#111827" }}>第2条（予約と代金のお支払い）</h2>
      <p style={{ marginBottom: 16 }}>
        1. ユーザーは、本サービス上で予約手続きを完了した時点で、指定した農家との間に農作物の売買契約が成立するものとします。<br />
        2. 農作物の代金は、指定された日時・場所に赴き、商品の受け渡し時にユーザーから農家へ直接現金でお支払いいただきます。
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16, color: "#111827" }}>第3条（キャンセルと受け取り義務）</h2>
      <p style={{ marginBottom: 16 }}>
        1. ユーザーは、設定された「受け渡し開始時刻」までであれば、システム上から予約をキャンセルすることができます。<br />
        2. ユーザーは、指定された日時・場所に赴き、商品を受け取り代金を支払う義務を負います。現地でお支払いいただく農作物の代金についてはキャンセル料は発生いたしませんが、受け渡し時刻の3時間前を過ぎての直前キャンセルや、無断キャンセル（連絡なしの不参加）を繰り返された場合、プラットフォームの健全性を保つため、事前の予告なく自動的に本サービスの利用制限を行う等の対策を講じています。
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16, color: "#111827" }}>第4条（免責事項）</h2>
      <p style={{ marginBottom: 16 }}>
        1. 運営は、本サービスを通じて提供される情報や、農家が提供する農作物の品質、安全性、適法性等について、いかなる保証も行いません。<br />
        2. ユーザーと農家との間で生じたトラブル（商品の不良、受け渡しの遅延、事故等）については、当事者間で直接解決するものとし、運営は一切の責任を負いません。
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16, color: "#111827" }}>第5条（禁止事項）</h2>
      <p style={{ marginBottom: 16 }}>
        本サービスの利用にあたり、以下の行為を禁止します。<br />
        ・いたずら目的の予約、または購入の意思がないにもかかわらず予約を行う行為<br />
        ・他のユーザー、農家、運営に対する嫌がらせ、誹謗中傷、脅迫行為<br />
        ・法令に違反する行為、または公序良俗に反する行為<br />
        ・その他、運営が不適切と判断する行為
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16, color: "#111827" }}>第6条（サービスの変更・停止）</h2>
      <p style={{ marginBottom: 16 }}>
        運営は、システムの保守、障害の発生、またはその他の理由により、予告なく本サービスの提供を一時停止、または内容を変更・終了する場合があります。これによって生じたいかなる損害についても、運営は責任を負いません。
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16, color: "#111827" }}>第7条（規約の変更）</h2>
      <p style={{ marginBottom: 16 }}>
        運営は、必要と判断した場合には、ユーザーに事前通知することなく本規約を変更することができるものとします。変更後の規約は、本サービス上に掲示された時点から効力を生じるものとします。
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16, color: "#111827" }}>第8条（準拠法・裁判管轄）</h2>
      <p style={{ marginBottom: 16 }}>
        本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生じた場合には、運営者の所在地を管轄する地方裁判所を第一審の専属的合意管轄裁判所とします。
      </p>

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