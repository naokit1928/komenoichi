import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { PublicBottomBar } from "@/components/PublicBottomBar";

const ReservationBookedPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [data, setData] = useState<ReservationBookedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consumerId, setConsumerId] = useState<number | null>(null);
  const [consumerEmail, setConsumerEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const apiBase = import.meta.env.VITE_API_BASE || "";
        const whoamiRes = await fetch(`${apiBase}/api/consumers/me`, { credentials: "include" });
        
        if (!whoamiRes.ok) {
          navigate("/login-only?redirect=" + encodeURIComponent("/reservation/booked"), { replace: true });
          return;
        }

        const whoami = await whoamiRes.json();
        if (typeof whoami.consumer_id === "number") {
          setConsumerId(whoami.consumer_id);
        }
        if (whoami.email) {
          setConsumerEmail(whoami.email);
        }

        try {
          const resId = searchParams.get("reservation_id");
          const res = await fetchReservationBooked(resId);
          setData(res);
        } catch (fetchErr) {
          setData(null);
        }

      } catch (e) {
        setError("通信エラーが発生しました。");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, searchParams]);

  const renderShell = (child: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 96px" }}>
        {child}
      </section>
      <PublicBottomBar consumerEmail={consumerEmail} />
    </div>
  );

  if (loading) {
    return renderShell(<div style={{ textAlign: "center", padding: "40px 0" }}>読み込み中です…</div>);
  }

  if (error) {
    return renderShell(<div style={{ textAlign: "center", padding: "32px 4px", color: "#C62828" }}>{error}</div>);
  }

  const reservationStatus =
    typeof data === "object" && data !== null
      ? (data as { reservation_status?: string }).reservation_status
      : undefined;

  const isExpiredForDisplay =
    typeof data === "object" && data !== null
      ? (data as { is_expired_for_display?: boolean }).is_expired_for_display
      : undefined;

  if (!data || (reservationStatus && reservationStatus !== "confirmed")) {
    return renderShell(
      <div style={{ padding: "40px 20px", textAlign: "center", maxWidth: 600, margin: "0 auto" }}>
        <h2 style={{ fontSize: 20, color: "#1a1108", marginBottom: 12 }}>
          現在、有効な予約はありません
        </h2>
        <p style={{ fontSize: 15, color: "#7a6c58", lineHeight: 1.6, marginBottom: 32 }}>
          受け取り日時が過ぎているか、キャンセルされた可能性があります。<br />
          新しいお米を探してみませんか？
        </p>
        <button
          onClick={() => navigate("/farms")}
          style={{
            padding: "14px 32px",
            borderRadius: 9999,
            background: "#4b3e2a",
            color: "#fff",
            border: "none",
            fontWeight: 600,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          農家を探す
        </button>
      </div>
    );
  }

  if (isExpiredForDisplay) {
    return renderShell(
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "#1a1108" }}>
          受け渡しは完了しました
        </h2>
        <p style={{ fontSize: 14, color: "#7a6c58", marginBottom: 28 }}>
          また次回のご利用をお待ちしています。
        </p>
        <button
          onClick={() => navigate("/farms")}
          style={{
            padding: "12px 32px",
            background: "#4b3e2a",
            color: "#ffffff",
            border: "none",
            borderRadius: 9999,
            fontWeight: 600,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          次の予約を探す
        </button>
      </div>
    );
  }

  const { context } = data;
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

  const cancelActionUri = cancel_token
    ? `/api/reservation/cancel?token=${encodeURIComponent(cancel_token)}`
    : null;

  return renderShell(
    <div>
      <p style={{ fontSize: 10, color: "#9ca3af", textAlign: "right", margin: "0 0 8px 0" }}>
        consumer_id: {consumerId ?? "-"} / res_id: {data.reservation_id}
      </p>
      
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