import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "@/config/api";

import { ConfirmHeader } from "./components/ConfirmHeader";
import { RiceBreakdown } from "./components/RiceBreakdown";
import { ServiceFeeCard } from "./components/ServiceFeeCard";
import { AgreementBlock } from "./components/AgreementBlock";

// ★ 注文ルール再利用
import {
  calcTotalKg,
  isOverMaxKg,
} from "../FarmDetail/rules/orderRules";

const FRONT_BASE = window.location.origin;

// ==============================
// 型定義
// ==============================
type ConfirmCtx = {
  farmId: string;
  riceSubtotal: number;
  serviceFee: number;
  total: number;
  items: { kg: 5 | 10 | 25; qty: number; unitPrice: number }[];
  pickupSlotCode?: string | null;
  nextPickupDisplay?: string | null;
  clientNextPickupDeadlineIso?: string | null;
};

type ReservationItemInput = {
  size_kg: 5 | 10 | 25;
  quantity: number;
};

type ReservationResultDTO = {
  reservation_id: number;
};

type ReservationFormInput = {
  farm_id: number;
  pickup_slot_code: string;
  items: ReservationItemInput[];
  client_next_pickup_deadline_iso?: string;
};

const CONFIRM_CTX_KEY = "CONFIRM_CTX";
const AUTO_PAY_KEY = "AUTO_PAY_AFTER_LINE";

// ==============================
// API
// ==============================
async function createReservationV2(
  payload: ReservationFormInput
): Promise<ReservationResultDTO> {
  const res = await fetch(`${API_BASE}/api/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("予約の作成に失敗しました。");
  }

  return res.json();
}

async function startCheckout(reservationId: number) {
  const res = await fetch(`${API_BASE}/stripe/checkout/${reservationId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      frontend_origin: window.location.origin,
    }),
  });
  if (!res.ok) throw new Error("Stripe 接続に失敗しました。");

  const data = await res.json();
  return data.checkout_url as string;
}

// ==============================
// Component
// ==============================
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
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/line/linked`, {
          credentials: "include",
        });
        if (r.ok) {
          const j = await r.json();
          setServerLinked(Boolean(j?.linked));
        }
      } catch {}
    })();
  }, []);

  // ctx 復元
  useEffect(() => {
    if (!ctx) {
      const saved = sessionStorage.getItem(CONFIRM_CTX_KEY);
      if (saved) {
        try {
          setCtx(JSON.parse(saved));
        } catch {}
      }
    }
  }, [ctx]);

  // 自動 Stripe 遷移
  useEffect(() => {
    const auto = sessionStorage.getItem(AUTO_PAY_KEY);
    if (ctx && serverLinked && auto) {
      sessionStorage.removeItem(AUTO_PAY_KEY);
      handlePay(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, serverLinked]);

  const riceLines = useMemo(() => {
    if (!ctx) return [];
    return ctx.items
      .filter((it) => it.qty > 0)
      .map((it) => ({
        label: `白米${it.kg}kg × ${it.qty}`,
        amount: it.unitPrice * it.qty,
      }));
  }, [ctx]);

  async function handlePay(silent = false) {
    try {
      if (!ctx) return;

      if (!agreed && !silent) {
        setErr("同意事項にチェックしてください。");
        return;
      }

      const qtyByKg = {
        5: ctx.items.find((i) => i.kg === 5)?.qty ?? 0,
        10: ctx.items.find((i) => i.kg === 10)?.qty ?? 0,
        25: ctx.items.find((i) => i.kg === 25)?.qty ?? 0,
      };

      if (calcTotalKg(qtyByKg) === 0)
        throw new Error("数量が 0 です。");
      if (isOverMaxKg(qtyByKg))
        throw new Error("50kg を超えています。");

      if (!serverLinked) {
        sessionStorage.setItem(CONFIRM_CTX_KEY, JSON.stringify(ctx));
        sessionStorage.setItem(AUTO_PAY_KEY, "1");
        const returnTo = `${FRONT_BASE}/farms/${ctx.farmId}/confirm?autopay=1`;
        window.location.href = `${API_BASE}/api/line/login?return_to=${encodeURIComponent(
          returnTo
        )}`;
        return;
      }

      setLoading(true);
      setErr("");

      const items: ReservationItemInput[] = ctx.items
        .filter((i) => i.qty > 0)
        .map((i) => ({ size_kg: i.kg, quantity: i.qty }));

      const result = await createReservationV2({
        farm_id: Number(ctx.farmId),
        pickup_slot_code: ctx.pickupSlotCode!,
        items,
        client_next_pickup_deadline_iso:
          ctx.clientNextPickupDeadlineIso || undefined,
      });

      const url = await startCheckout(result.reservation_id);
      window.location.href = url;
    } catch (e: any) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  if (!ctx) {
    return (
      <div style={{ padding: 16 }}>
        <p>データがありません。</p>
        <button onClick={() => navigate(`/farms/${farmId}`)}>
          戻る
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 16,
        paddingBottom: 32,
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <ConfirmHeader farmId={farmId} />

      <RiceBreakdown
        riceSubtotal={ctx.riceSubtotal}
        lines={riceLines}
        pickupDisplay={ctx.nextPickupDisplay}
      />

      <ServiceFeeCard
        serviceFee={ctx.serviceFee}
        termLabel="運営サポート費"
      />

      <AgreementBlock agreed={agreed} onChange={setAgreed} />

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
          padding: "12px 16px",
          background: loading ? "#ddd" : "#1f7a36",
          color: loading ? "#666" : "#fff",
          borderRadius: 9999,
          border: "none",
          fontWeight: 600,
          fontSize: 15,
          cursor: loading ? "default" : "pointer",
          marginTop: 24,
        }}
      >
        {loading ? "処理中…" : "300円を支払って予約確定"}
      </button>
    </div>
  );
}
