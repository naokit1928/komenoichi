import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "@/config/api";

import { ConfirmHeader } from "./components/ConfirmHeader";
import { RiceBreakdown } from "./components/RiceBreakdown";
import { ServiceFeeCard } from "./components/ServiceFeeCard";
import { AgreementBlock } from "./components/AgreementBlock";

// ★ 追加：注文ルール再利用
import {
  calcTotalKg,
  isOverMaxKg,
} from "../FarmDetail/rules/orderRules";

const FRONT_BASE = window.location.origin;

// ConfirmPage が使うコンテキスト
type ConfirmCtx = {
  farmId: string;
  riceSubtotal: number;
  serviceFee: number;
  total: number;
  items: { kg: 5 | 10 | 25; qty: number; unitPrice: number }[];
  farmName?: string | null;
  price10kg?: number | null;

  pickupSlotCode?: string | null;
  nextPickupDisplay?: string | null;
  clientNextPickupDeadlineIso?: string | null;
};

// ---- バックエンド DTO と揃えた型 ----
type ReservationItemInput = {
  size_kg: 5 | 10 | 25;
  quantity: number;
};

type ReservationResultItemDTO = {
  size_kg: 5 | 10 | 25;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

type ReservationResultDTO = {
  reservation_id: number;
  farm_id: number;
  items: ReservationResultItemDTO[];
  rice_subtotal: number;
  service_fee: number;
  currency: string;
};

type ReservationFormInput = {
  farm_id: number;
  pickup_slot_code: string;
  items: ReservationItemInput[];
  client_next_pickup_deadline_iso?: string;
};

const CONFIRM_CTX_KEY = "CONFIRM_CTX";
const AUTO_PAY_KEY = "AUTO_PAY_AFTER_LINE";
const TERM_SERVICE = "運営サポート費";

// ---- API (V2) ----
async function createReservationV2(
  payload: ReservationFormInput
): Promise<ReservationResultDTO> {
  const res = await fetch(`${API_BASE}/api/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = "予約の作成に失敗しました。時間をおいて再度お試しください。";
    try {
      const text = await res.text();
      if (text) {
        try {
          const json = JSON.parse(text);
          if (json?.detail) message = json.detail;
          else message = text;
        } catch {
          message = text;
        }
      }
    } catch {}
    throw new Error(message);
  }

  const data = (await res.json()) as ReservationResultDTO;
  if (!data?.reservation_id) {
    throw new Error("reservation_id が取得できませんでした。");
  }
  return data;
}

async function startCheckout(reservationId: number) {
  const res = await fetch(`${API_BASE}/stripe/checkout/${reservationId}`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`startCheckout failed: ${res.status}`);
  }
  const data = await res.json();
  const url = data?.checkout_url ?? data?.url;
  if (!url) throw new Error("checkout_url が取得できませんでした。");
  return String(url);
}

export default function ConfirmPage() {
  const { farmId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const initial = (location.state as ConfirmCtx | null) ?? null;
  const [ctx, setCtx] = useState<ConfirmCtx | null>(initial);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [agreed, setAgreed] = useState(false);

  // LINE 連携状態
  const [serverLinked, setServerLinked] = useState(false);
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/line/linked`, {
          credentials: "include",
        });
        if (!aborted && r.ok) {
          const j = await r.json();
          setServerLinked(Boolean(j?.linked));
        }
      } catch {}
    })();
    return () => {
      aborted = true;
    };
  }, []);

  const lineReady = serverLinked;

  /**
   * ===============================
   * useEffect ① ctx 復元専用
   * ===============================
   */
  useEffect(() => {
    if (!ctx) {
      const saved = sessionStorage.getItem(CONFIRM_CTX_KEY);
      if (saved) {
        try {
          setCtx(JSON.parse(saved));
        } catch {
          // ignore
        }
      }
    }
  }, [ctx]);

  /**
   * ===============================
   * useEffect ② Stripe 自動遷移専用
   * ===============================
   */
  useEffect(() => {
    const auto = sessionStorage.getItem(AUTO_PAY_KEY);
    if (ctx && lineReady && auto) {
      sessionStorage.removeItem(AUTO_PAY_KEY);
      handlePay(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, lineReady]);

  const money = (n: number) => n.toLocaleString("ja-JP");

  const riceLines = useMemo(() => {
    if (!ctx) return [];
    return ctx.items
      .filter((it) => it.qty)
      .map((it) => ({
        label: `白米${it.kg}kg × ${it.qty}（@${money(it.unitPrice)}円）`,
        amount: it.unitPrice * it.qty,
      }));
  }, [ctx]);

  const handlePay = async (silent = false) => {
    try {
      if (!ctx) throw new Error("表示データがありません。");

      if (!agreed && !silent) {
        setErr("予約に際する同意事項にチェックしてください。");
        return;
      }

      // ===== ★ 追加：注文内容バリデーション（最終防衛線） =====

      const qtyByKg = {
        5: ctx.items.find((i) => i.kg === 5)?.qty ?? 0,
        10: ctx.items.find((i) => i.kg === 10)?.qty ?? 0,
        25: ctx.items.find((i) => i.kg === 25)?.qty ?? 0,
      };

      const totalKg = calcTotalKg(qtyByKg);

      if (totalKg === 0) {
        throw new Error("数量が 0 のため予約できません。");
      }

      if (isOverMaxKg(qtyByKg)) {
        throw new Error("注文は合計50kgまでです。");
      }

      // ===== 既存ロジック =====

      if (!lineReady) {
        sessionStorage.setItem(CONFIRM_CTX_KEY, JSON.stringify(ctx));
        sessionStorage.setItem(AUTO_PAY_KEY, "1");
        const returnToAbs = `${FRONT_BASE}/farms/${ctx.farmId}/confirm?autopay=1`;
        window.location.href = `${API_BASE}/api/line/login?return_to=${encodeURIComponent(
          returnToAbs
        )}`;
        return;
      }

      setLoading(true);
      setErr("");

      const items: ReservationItemInput[] = ctx.items
        .filter((it) => it.qty > 0)
        .map((it) => ({ size_kg: it.kg, quantity: it.qty }));

      const pickupSlotCode = ctx.pickupSlotCode?.trim();
      if (!pickupSlotCode)
        throw new Error("受け渡し情報の取得に失敗しました。");

      const result = await createReservationV2({
        farm_id: Number(ctx.farmId),
        pickup_slot_code: pickupSlotCode,
        items,
        client_next_pickup_deadline_iso:
          ctx.clientNextPickupDeadlineIso || undefined,
      });

      const checkoutUrl = await startCheckout(result.reservation_id);
      window.location.href = checkoutUrl;
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  if (!ctx) {
    return (
      <div style={{ padding: 16 }}>
        <p>データがありません。農家詳細ページからやり直してください。</p>
        <button
          onClick={() => navigate(`/farms/${farmId}`)}
          style={{
            padding: 12,
            background: "#1f7a36",
            color: "#fff",
            borderRadius: 6,
            fontWeight: 700,
          }}
        >
          戻る
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
      <ConfirmHeader farmId={farmId} />

      <RiceBreakdown
        riceSubtotal={ctx.riceSubtotal}
        lines={riceLines}
      />

      <ServiceFeeCard
        serviceFee={ctx.serviceFee}
        termLabel={TERM_SERVICE}
      />

      <AgreementBlock
        agreed={agreed}
        onChange={setAgreed}
      />

      {err && (
        <div style={{ color: "#b91c1c", marginBottom: 8 }}>
          {err}
        </div>
      )}

      <button
        onClick={() => handlePay(false)}
        disabled={loading}
        style={{
          width: "100%",
          padding: "11px 16px",
          background: loading ? "#ddd" : "#1f7a36",
          color: loading ? "#666" : "#fff",
          borderRadius: 9999,
          border: "none",
          fontWeight: 600,
          fontSize: 15,
          cursor: loading ? "default" : "pointer",
          marginTop: 26,
        }}
      >
        {loading
          ? "Stripeへ接続中..."
          : `${TERM_SERVICE}${money(
              ctx.serviceFee
            )}円を支払って予約を確定する`}
      </button>
    </div>
  );
}
