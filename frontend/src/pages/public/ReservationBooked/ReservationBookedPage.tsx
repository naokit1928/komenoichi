import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom"; // ★ useSearchParams を追加
import {
  fetchReservationBooked, // ★ 名前を fetchReservationBooked に変更
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // ★ URLからパラメータを取得するためのフック

  const [data, setData] = useState<ReservationBookedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [consumerId, setConsumerId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // ① まず、ログイン状態（consumer_id）を確実に取得する
        const apiBase = import.meta.env.VITE_API_BASE || "";
        const whoamiRes = await fetch(`${apiBase}/api/consumers/me`, { credentials: "include" });
        
        if (!whoamiRes.ok) {
          // 未ログイン（401等）の場合はログイン画面へ
          navigate("/login-only?redirect=" + encodeURIComponent("/reservation/booked"), { replace: true });
          return;
        }

        const whoami = await whoamiRes.json();
        if (typeof whoami.consumer_id === "number") {
          setConsumerId(whoami.consumer_id);
        }

        // ② ログイン済みであることが確定したので、予約情報を取得する
        try {
          // ★ URLパラメータに reservation_id があれば取得し、API関数に渡す
          const resId = searchParams.get("reservation_id");
          const res = await fetchReservationBooked(resId);
          setData(res);
        } catch (fetchErr) {
          // APIが 404 等を返した場合、エラーではなく「予約なし」状態とする
          setData(null);
        }

      } catch (e) {
        // それ以外の深刻なネットワークエラー等
        setError("通信エラーが発生しました。");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, searchParams]);

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
    return renderShell(<div style={{ textAlign: "center", padding: "40px 0" }}>読み込み中です…</div>);
  }

  if (error) {
    return renderShell(<div style={{ textAlign: "center", padding: "32px 4px", color: "#b91c1c" }}>{error}</div>);
  }

  // ★ 予約データがない場合
  if (!data) {
    return renderShell(
      <div style={{ textAlign: "center", padding: "40px 4px" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#111827", marginBottom: 12 }}>
          指定された予約が見つかりません。
        </div>
        <button
          onClick={() => navigate("/reservations")} // ★ 予約一覧へ戻すように変更
          style={{
            padding: "10px 24px",
            borderRadius: 9999,
            background: "#4b3e2a",
            color: "#fff",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          予約一覧に戻る
        </button>
      </div>
    );
  }

  const reservationStatus =
    typeof data === "object" && data !== null
      ? (data as { reservation_status?: string }).reservation_status
      : undefined;

  const isExpiredForDisplay =
    typeof data === "object" && data !== null
      ? (data as { is_expired_for_display?: boolean })
          .is_expired_for_display
      : undefined;

  // ★ 予約が confirmed でない場合（キャンセル済みなど）
  if (reservationStatus && reservationStatus !== "confirmed") {
    return renderShell(
      <div style={{ textAlign: "center", padding: "40px 4px" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#111827", marginBottom: 12 }}>
          この予約はすでにキャンセルされています。
        </div>
        <button
          onClick={() => navigate("/reservations")} // ★ 予約一覧へ戻すように変更
          style={{
            padding: "10px 24px",
            borderRadius: 9999,
            background: "#4b3e2a",
            color: "#fff",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          予約一覧に戻る
        </button>
      </div>
    );
  }

  if (isExpiredForDisplay) {
    return renderShell(
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#1a1108" }}>
          受け渡しは完了しました
        </h2>
        <p style={{ fontSize: 14, color: "#7a6c58", marginBottom: 28 }}>
          また次回のご利用をお待ちしています。
        </p>
        <a
          href="/farms"
          style={{
            display: "inline-block",
            padding: "12px 32px",
            background: "#4b3e2a",
            color: "#ffffff",
            textDecoration: "none",
            borderRadius: 9999,
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          次の予約を探す
        </a>
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
      <p style={{ fontSize: 10, color: "#9ca3af" }}>
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