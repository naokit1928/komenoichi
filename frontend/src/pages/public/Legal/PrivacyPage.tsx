import React from "react";
import { useSearchParams } from "react-router-dom";
import Footer from "@/components/Footer";
import { PublicBottomBar } from "@/components/PublicBottomBar";
import { FarmerBottomBar } from "@/components/FarmerBottomBar";

export default function PrivacyPage({ isModal = false }: { isModal?: boolean }) {
  const [searchParams] = useSearchParams();
  const isFarmerMode = searchParams.get("from") === "farmer";

  const content = (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px", fontSize: 15, color: "#374151", lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 32, color: "#111827" }}>プライバシーポリシー</h1>
      
      <p style={{ marginBottom: 24 }}>
        「こめのいち」（以下、「本サービス」といいます。）は、ユーザーの個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下、「本ポリシー」といいます。）を定めます。
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16, color: "#111827" }}>1. 収集する個人情報</h2>
      <p style={{ marginBottom: 16 }}>
        本サービスでは、ログイン認証およびサービス提供のため、以下の情報を取得します。<br />
        ・メールアドレス<br />
        ・Cookieおよびセッション情報<br />
        ・受け渡しに必要な情報（農家の場合は位置情報など）<br />
        ※クレジットカード情報等は決済代行会社（Stripe社）が直接管理し、本サービスでは一切保持しません。
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16, color: "#111827" }}>2. 利用目的</h2>
      <p style={{ marginBottom: 16 }}>
        取得した個人情報は、以下の目的で利用いたします。<br />
        ・マジックリンクによるパスワードレス認証のため<br />
        ・予約完了通知など、本サービスの提供に関する連絡のため<br />
        ・お問い合わせへの対応、および不正利用の防止のため
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16, color: "#111827" }}>3. 個人情報の第三者提供</h2>
      <p style={{ marginBottom: 16 }}>
        本サービスは、ユーザーの同意を得ることなく、第三者に個人情報を提供することはありません。ただし、法令に基づく場合を除きます。なお、予約が確定した場合、取引に必要な最小限の情報（予約ID等）が対象の農家に共有されます。
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16, color: "#111827" }}>4. 退会時のデータの取り扱い（匿名化）</h2>
      <p style={{ marginBottom: 16 }}>
        ユーザーが退会手続きを行った場合、本サービスは直ちにユーザーのメールアドレス等の個人を特定できる情報を匿名化（不可逆的な書き換え）し、物理的に個人情報を消去します。ただし、売上集計のための個人を特定できない購買履歴は保持されます。
      </p>

      <p style={{ marginTop: 40, fontSize: 14, color: "#6B7280" }}>
        制定日：2026年3月10日
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