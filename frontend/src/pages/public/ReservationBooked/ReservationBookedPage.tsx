import React, { useEffect, useState } from "react";
import {
  fetchReservationBookedMe,
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
  const [data, setData] = useState<ReservationBookedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ★ whoami（表示専用）
  const [consumerId, setConsumerId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // ① 予約情報（consumer セッション前提）
        const res = await fetchReservationBookedMe();
        setData(res);

        // ② consumer_id（表示用）
        const apiBase = import.meta.env.VITE_API_BASE;
        if (apiBase) {
          const whoamiRes = await fetch(
            `${apiBase}/api/consumers/me`,
            { credentials: "include" }
          );
          if (whoamiRes.ok) {
            const whoami = await whoamiRes.json();
            if (typeof whoami.consumer_id === "number") {
              setConsumerId(whoami.consumer_id);
            }
          }
        }
      } catch (e) {
        setError("予約情報の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /**
   * ページ全体のシェル
   */
  const renderShell = (child: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <section
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "16px 16px 40px",
        }}
      >
        {child}
      </section>
    </div>
  );

  if (loading) {
    return renderShell(
      <div style={{ textAlign: "center", padding: "40px 0" }}>
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
          color: "#b91c1c",
        }}
      >
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

  // ---- 状態判定 ----
  const reservationStatus =
    typeof data === "object" && data !== null
      ? (data as { reservation_status?: string }).reservation_status
      : undefined;

  const isExpiredForDisplay =
    typeof data === "object" && data !== null
      ? (data as { is_expired_for_display?: boolean })
          .is_expired_for_display
      : undefined;

  // 予約が confirmed でない場合
  if (reservationStatus && reservationStatus !== "confirmed") {
    return renderShell(
      <div style={{ textAlign: "center", padding: "32px 4px" }}>
        現在、ご予約中の受け渡しはありません。
      </div>
    );
  }

  // ★ 受け渡し完了後の専用 UI
  if (isExpiredForDisplay) {
    return renderShell(
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          受け渡しは完了しました
        </h2>

        <p
          style={{
            fontSize: 14,
            color: "#4b5563",
            marginBottom: 28,
          }}
        >
          また次回のご利用をお待ちしています。
        </p>

        <a
          href="/farms"
          style={{
            display: "inline-block",
            padding: "12px 20px",
            background: "#10B981",
            color: "#ffffff",
            textDecoration: "none",
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          次の予約を探す
        </a>
      </div>
    );
  }

  // ---- 通常（受け渡し前）表示 ----
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
    ? `/reservation/cancel?token=${encodeURIComponent(cancel_token)}`
    : null;

  return renderShell(
    <div>
      {/* ★ consumer_id（問い合わせ・デバッグ用） */}
      <p style={{ fontSize: 10, color: "#9ca3af" }}>
        consumer_id: {consumerId ?? "-"}
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
