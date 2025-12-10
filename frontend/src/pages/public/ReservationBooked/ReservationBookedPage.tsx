// frontend/src/pages/public/ReservationBooked/ReservationBookedPage.tsx

import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchReservationBooked,
  type ReservationBookedResponse,
} from "../../../lib/reservationBooked";

import PickupSummaryCard from "./PickupSummaryCard";
import BookingItemsCard from "./BookingItemsCard";
import PaymentSummaryCard from "./PaymentSummaryCard";
import ReservationCodeCard from "./ReservationCodeCard";
import MemoCard from "./MemoCard";
import NoticeCard from "./NoticeCard";
import CancelActionCard from "./CancelActionCard";

const ReservationBookedPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const [data, setData] = useState<ReservationBookedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reservationIdParam = searchParams.get("reservation_id");

  useEffect(() => {
    if (!reservationIdParam) {
      setError("予約IDが指定されていません。");
      setLoading(false);
      return;
    }

    const id = Number(reservationIdParam);
    if (!Number.isFinite(id) || id <= 0) {
      setError("予約IDが不正です。");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchReservationBooked(id);
        setData(res);
      } catch (e) {
        console.error(e);
        setError("予約情報の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    })();
  }, [reservationIdParam]);

  // 共通レイアウト
  const renderShell = (child: React.ReactNode) => (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
      }}
    >
      <section
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "24px 16px 40px 16px",
          background: "#f8fafc",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: 18,
            padding: "24px 18px 20px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
          }}
        >
          {child}
        </div>
      </section>
    </div>
  );

  if (loading) {
    return renderShell(
      <div
        style={{
          textAlign: "center",
          padding: "40px 0",
          fontSize: 14,
          color: "#6b7280",
        }}
      >
        読み込み中です…
      </div>
    );
  }

  if (error) {
    return renderShell(
      <div
        style={{
          textAlign: "center",
          padding: "32px 4px",
        }}
      >
        <div
          style={{
            fontSize: 14,
            color: "#b91c1c",
            marginBottom: 8,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          LINE のメッセージに記載のリンクが有効期限切れになっている可能性があります。
        </div>
      </div>
    );
  }

  if (!data) {
    return renderShell(
      <div
        style={{
          textAlign: "center",
          padding: "32px 4px",
          fontSize: 14,
          color: "#6b7280",
        }}
      >
        予約情報が見つかりませんでした。
      </div>
    );
  }

  // 予約ステータス（型はいじらず any 経由で読む）
  const reservationStatus = (data as any).reservation_status as
    | string
    | undefined;

  // 表示用 is_expired（受け渡し終了 +15分 を過ぎたかどうか）
  const isExpiredForDisplay = (data as any)
    .is_expired_for_display as boolean | undefined;

  // confirmed 以外（例: "cancelled"）の場合は「キャンセル済み」表示
  if (reservationStatus && reservationStatus !== "confirmed") {
    return renderShell(
      <div
        style={{
          padding: "16px 4px 8px",
        }}
      >
        <header style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 9999,
              background: "#f3f4f6",
              border: "1px solid #e5e7eb",
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              color: "#4b5563",
            }}
          >
            ご予約状況
          </div>
        </header>

        <h1
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#111827",
          }}
        >
          現在、ご予約中の受け渡しはありません。
        </h1>
        <p
          style={{
            marginTop: 10,
            fontSize: 13,
            lineHeight: 1.7,
            color: "#374151",
          }}
        >
          前回の予約はすでにキャンセルされています。
          <br />
        </p>
      </div>
    );
  }

  // 受け渡し終了 +15分 を過ぎている場合は「予定している予約なし」に切り替え
  if (isExpiredForDisplay) {
    return renderShell(
      <div
        style={{
          padding: "16px 4px 8px",
        }}
      >
        <header style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 9999,
              background: "#f3f4f6",
              border: "1px solid #e5e7eb",
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              color: "#4b5563",
            }}
          >
            ご予約状況
          </div>
        </header>

        <h1
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#111827",
          }}
        >
          現在、予定している受け渡しの予約はありません。
        </h1>
        <p
          style={{
            marginTop: 10,
            fontSize: 13,
            lineHeight: 1.7,
            color: "#374151",
          }}
        >
          お受け渡し時間を過ぎたため、前回の予約はこの確認ページでは非表示となりました。
          <br />
          新しいご予約をご希望の場合は、再度農家さんのページからお手続きください。
        </p>
      </div>
    );
  }

  const { reservation_id, context, cancel_template_json } = data;

  const {
    pickup_display,
    pickup_place_name,
    pickup_map_url,
    pickup_detail_memo,
    qty_5,
    qty_10,
    qty_25,
    label_5kg,
    label_10kg,
    label_25kg,
    rice_subtotal,
    pickup_code,
  } = context;

  // 予約内容リスト表示用
  const items: string[] = [];
  if (qty_5 > 0) items.push(`${label_5kg}：${qty_5}袋`);
  if (qty_10 > 0) items.push(`${label_10kg}：${qty_10}袋`);
  if (qty_25 > 0) items.push(`${label_25kg}：${qty_25}袋`);

  const riceSubtotalText = `${rice_subtotal.toLocaleString()}円（現金）`;

  const cancelActionUri =
    cancel_template_json?.template?.actions?.[0]?.uri ?? "#";

  return renderShell(
    <div>
      {/* ヘッダー（静的な予約確認） */}
      <header style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 9999,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 600,
            color: "#1d4ed8",
          }}
        >
          予約確認
        </div>

        <h1
          style={{
            marginTop: 10,
            fontSize: 18,
            fontWeight: 700,
            color: "#111827",
          }}
        >
          予約内容の確認
        </h1>

        <p
          style={{
            marginTop: 6,
            fontSize: 13,
            lineHeight: 1.7,
            color: "#374151",
          }}
        >
          下記の内容でご予約をお預かりしています。
        </p>

        <p
          style={{
            marginTop: 8,
            fontSize: 11,
            color: "#6b7280",
          }}
        >
          予約ID：{reservation_id}
        </p>
      </header>

      {/* 受け渡し情報 */}
      <PickupSummaryCard
        pickupDisplay={pickup_display}
        pickupPlaceName={pickup_place_name}
        pickupMapUrl={pickup_map_url}
      />

      {/* 予約内容＋金額 */}
      <BookingItemsCard items={items} />
      <PaymentSummaryCard riceSubtotalText={riceSubtotalText} />

      {/* 予約コード */}
      <ReservationCodeCard pickupCode={pickup_code} />

      {/* 農家からの注意事項 */}
      <MemoCard memo={pickup_detail_memo} />

      {/* ご利用上の注意 */}
      <NoticeCard />

      {/* キャンセル手続き */}
      <CancelActionCard cancelActionUri={cancelActionUri} />
    </div>
  );
};

export default ReservationBookedPage;
