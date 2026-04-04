import React from "react";
import { useSearchParams } from "react-router-dom";
import Footer from "@/components/Footer";
import { PublicBottomBar } from "@/components/PublicBottomBar";
import { FarmerBottomBar } from "@/components/FarmerBottomBar";

const rows = [
  { label: "販売事業者（プラットフォーム運営）", value: "高見　直希" },
  { label: "運営責任者", value: "高見　直希" },
  { label: "所在地", value: "〒770-0935\n徳島県徳島市伊月町1丁目14-1" },
  { label: "電話番号", value: "070-8580-1536\n（※お問い合わせは原則メールにてお願いいたします）" },
  { label: "メールアドレス", value: "support@komenoichi.jp" },
  { label: "販売価格（サービス利用料）", value: "無料\n※農作物の代金（各農家の詳細ページに記載）は、現地で農家へ直接現金でお支払いいただきます。" },
  { label: "商品代金以外に必要な料金", value: "当サイトの閲覧等に必要となるインターネット接続料金、通信料金等はお客様のご負担となります。" },
  { label: "支払方法", value: "農作物の代金：受け渡し時に現金払い" },
  { label: "支払時期", value: "農作物の代金は受け渡し時にお支払いください。" },
  { label: "商品の引渡時期・方法", value: "各農家が設定した「受け渡し日時」に、指定された「受け渡し場所」にて、農家から直接手渡しにてお受け取りいただきます。" },
  { label: "キャンセル・返品・返金について", value: "【農作物（お米）について】\n万が一農作物に欠陥等があった場合の返品・代替品などのご相談は、必ず「受け渡し時にその場で」直接農家へお申し出ください。\n商品の性質上、受け渡しが完了しお持ち帰りいただいた後の返品・返金・交換には原則として応じかねますので、お受け取り時に必ず商品の状態をご確認ください。" },
];

export default function LawPage({ isModal = false }: { isModal?: boolean }) {
  const [searchParams] = useSearchParams();
  const isFarmerMode = searchParams.get("from") === "farmer";

  const content = (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px", color: "#374151", lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 32, color: "#111827" }}>
        特定商取引法に基づく表記
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {rows.map((row, i) => (
          <div
            key={i}
            style={{
              borderBottom: "1px solid #e8e2d8",
              padding: "16px 4px",
            }}
          >
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#6b7280",
              marginBottom: 6,
              letterSpacing: "0.04em",
            }}>
              {row.label}
            </div>
            <div style={{
              fontSize: 15,
              color: "#111827",
              whiteSpace: "pre-wrap",
              lineHeight: 1.8,
            }}>
              {row.value}
            </div>
          </div>
        ))}
      </div>
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