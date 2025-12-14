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

  const renderShell = (child: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <section
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "24px 16px 40px 16px",
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
      <div style={{ textAlign: "center", padding: "40px 0", fontSize: 14 }}>
        読み込み中です…
      </div>
    );
  }

  if (error) {
    return renderShell(
      <div style={{ textAlign: "center", padding: "32px 4px", color: "#b91c1c" }}>
        {error}
      </div>
    );
  }

  if (!data) {
    return renderShell(
      <div style={{ textAlign: "center", padding: "32px 4px" }}>
        予約情報が見つかりませんでした。
      </div>
    );
  }

  const reservationStatus = (data as any).reservation_status as string | undefined;
  const isExpiredForDisplay = (data as any).is_expired_for_display as
    | boolean
    | undefined;

  if (reservationStatus && reservationStatus !== "confirmed") {
    return renderShell(<div>現在、ご予約中の受け渡しはありません。</div>);
  }

  if (isExpiredForDisplay) {
    return renderShell(<div>現在、予定している受け渡しはありません。</div>);
  }

  const { reservation_id, context } = data;

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
    cancel_token,
  } = context;

  const items: string[] = [];
  if (qty_5 > 0) items.push(`${label_5kg}：${qty_5}袋`);
  if (qty_10 > 0) items.push(`${label_10kg}：${qty_10}袋`);
  if (qty_25 > 0) items.push(`${label_25kg}：${qty_25}袋`);

  const riceSubtotalText = `${rice_subtotal.toLocaleString()}円（現金）`;

  // ★ ここが最重要：Web 導線でキャンセル URL を生成
  const cancelActionUri = cancel_token
    ? `/reservation/cancel?token=${encodeURIComponent(cancel_token)}`
    : null;

  return renderShell(
    <div>
      <p style={{ fontSize: 11 }}>予約ID：{reservation_id}</p>

      <PickupSummaryCard
        pickupDisplay={pickup_display}
        pickupPlaceName={pickup_place_name}
        pickupMapUrl={pickup_map_url}
      />

      <BookingItemsCard items={items} />
      <PaymentSummaryCard riceSubtotalText={riceSubtotalText} />
      <ReservationCodeCard pickupCode={pickup_code} />
      <MemoCard memo={pickup_detail_memo} />
      <NoticeCard />

      <CancelActionCard cancelActionUri={cancelActionUri} />
    </div>
  );
};

export default ReservationBookedPage;
