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
        ・Cookie（ログイン状態の維持等に使用します）<br />
        ・その他、サービス提供に不可欠な情報（農家の場合は位置情報など）
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
        本サービスは、ユーザーの同意を得ることなく、第三者に個人情報を提供することはありません。ただし、法令に基づく場合を除きます。なお、予約が確定した場合、取引に必要な最小限の情報（受渡番号やシステム照会ID等の識別情報）が対象の農家に共有されます。
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16, color: "#111827" }}>4. 退会時のデータの取り扱い（匿名化）</h2>
      <p style={{ marginBottom: 16 }}>
        ユーザーが退会手続きを行った場合、本サービスは直ちにユーザーのメールアドレス等の個人を特定できる情報を削除または匿名化し、復元不可能な状態にします。ただし、無断キャンセルや不正利用に伴うペナルティ履歴に関するデータについては、悪質な再登録や利用を防ぐ目的で、退会後も一定期間安全に保持される場合があります。
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16, color: "#111827" }}>5. セキュリティ</h2>
      <p style={{ marginBottom: 16 }}>
        本サービスは、個人情報の漏洩、滅失、または毀損の防止のため、適切なセキュリティ対策を講じます。
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 32, marginBottom: 16, color: "#111827" }}>6. お問い合わせ窓口</h2>
      <p style={{ marginBottom: 16 }}>
        本ポリシーに関するお問い合わせは、特定商取引法に基づく表記に記載の連絡先までお願いいたします。
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