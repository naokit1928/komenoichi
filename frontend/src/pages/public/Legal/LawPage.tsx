import React from "react";

export default function LawPage() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px", color: "#374151", lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 32, color: "#111827" }}>特定商取引法に基づく表記</h1>
      
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
        <tbody>
          {[
            { label: "販売事業者\n(プラットフォーム運営)", value: "高見　直希" },
            { label: "運営責任者", value: "高見　直希" },
            { label: "所在地", value: "〒770-0935\n徳島県徳島市伊月町1丁目14-1" },
            { label: "電話番号", value: "070-8580-1536\n（※お問い合わせは原則メールにてお願いいたします）" },
            { label: "メールアドレス", value: "support@komenoichi.jp" },
            { label: "販売価格\n(システム利用料)", value: "予約1件につき 300円（税込）\n※農作物の代金（各農家の詳細ページに記載）は、現地で農家へ直接現金でお支払いいただきます。" },
            { label: "商品代金以外に必要な料金", value: "当サイトの閲覧等に必要となるインターネット接続料金、通信料金等はお客様のご負担となります。" },
            { label: "支払方法", value: "システム利用料：クレジットカード決済\n農作物の代金：受け渡し時に現金払い" },
            { label: "支払時期", value: "システム利用料は予約完了時に決済されます。\n農作物の代金は受け渡し時にお支払いください。" },
            { label: "商品の引渡時期・方法", value: "各農家が設定した「受け渡し日時」に、指定された「受け渡し場所」にて、農家から直接手渡しにてお受け取りいただきます。" },
            /* ★修正ポイント: 受け渡し後の返品不可を明記 */
            { label: "キャンセル・返品・返金について", value: "【システム利用料について】\n予約完了後（事前決済後）は、いかなる理由であってもシステム利用料の返金はお受けできません（キャンセル手続きを行った場合でも返金対象外となります）。\n\n【農作物（お米）について】\n万が一農作物に欠陥等があった場合の返品・代替品などのご相談は、必ず「受け渡し時にその場で」直接農家へお申し出ください。\n商品の性質上、受け渡しが完了しお持ち帰りいただいた後の返品・返金・交換には原則として応じかねますので、お受け取り時に必ず商品の状態をご確認ください。" }
          ].map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #E5E7EB" }}>
              <th style={{ width: "30%", padding: "16px 8px", textAlign: "left", fontWeight: 600, verticalAlign: "top", whiteSpace: "pre-wrap" }}>
                {row.label}
              </th>
              <td style={{ padding: "16px 8px", whiteSpace: "pre-wrap" }}>
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}