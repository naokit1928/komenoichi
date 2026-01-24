import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "@/config/api";

/* ヘッダー */
import { FarmsListHeader as PublicPageHeader } from "@/components/PublicPageHeader";
import SimplePageHeader from "@/components/SimplePageHeader";

/* Confirm 専用カード */
import { RiceBreakdown } from "./components/RiceBreakdown";
import { ServiceFeeCard } from "./components/ServiceFeeCard";
import { AgreementBlock } from "./components/AgreementBlock";

import { calcTotalKg, isOverMaxKg } from "../FarmDetail/rules/orderRules";

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

/* ===== identity ===== */
async function fetchIdentity(): Promise<{
  is_logged_in: boolean;
  email: string | null;
} | null> {
  const res = await fetch(`${API_BASE}/api/consumers/identity`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  return res.json();
}

/* ===== PENDING 取得（唯一のデータソース） ===== */
async function fetchPendingReservation(): Promise<ConfirmCtx | null> {
  const res = await fetch(`${API_BASE}/api/reservations/pending/me`, {
    credentials: "include",
  });
  if (!res.ok) return null;

  const data = await res.json();

  return {
    farmId: String(data.farm_id),
    riceSubtotal: data.rice_subtotal,
    serviceFee: data.service_fee,
    total: data.total,
    items: data.items.map((it: any) => ({
      kg: it.size_kg,
      qty: it.quantity,
      unitPrice: it.unit_price,
    })),
    pickupSlotCode: data.pickup_slot_code,
    nextPickupDisplay: data.pickup_display,
    clientNextPickupDeadlineIso: null,
  };
}

/* ===== stripe ===== */
async function checkoutFromConfirm(payload: {
  agreed: boolean;
  confirm_context: any;
}) {
  const res = await fetch(`${API_BASE}/stripe/checkout/from-confirm`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail || "Stripe 決済の開始に失敗しました。");
  }

  return res.json();
}

export default function ConfirmPage() {
  const { farmId = "" } = useParams();
  const navigate = useNavigate();

  const [ctx, setCtx] = useState<ConfirmCtx | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [consumerEmail, setConsumerEmail] =
    useState<string | undefined>(undefined);

  /* ===== identity ===== */
  useEffect(() => {
    async function run() {
      const data = await fetchIdentity();
      if (data?.is_logged_in) {
        setIsLoggedIn(true);
        if (data.email) setConsumerEmail(data.email);
      } else {
        setIsLoggedIn(false);
      }
    }
    run();
  }, []);

  /* ===== PENDING 取得（唯一の真実） ===== */
  useEffect(() => {
    async function run() {
      const pending = await fetchPendingReservation();
      if (pending && pending.farmId === farmId) {
        setCtx(pending);
      } else {
        setCtx(null);
      }
    }
    run();
  }, [farmId]);

  const riceLines = useMemo(() => {
    if (!ctx) return [];
    return ctx.items
      .filter((it) => it.qty > 0)
      .map((it) => ({
        label: `白米${it.kg}kg × ${it.qty}`,
        amount: it.unitPrice * it.qty,
      }));
  }, [ctx]);

  async function handleMainAction() {
    try {
      if (!ctx) return;
      setErr("");

      if (!agreed) {
        setErr("同意事項にチェックしてください。");
        return;
      }

      const qtyByKg = {
        5: ctx.items.find((i) => i.kg === 5)?.qty ?? 0,
        10: ctx.items.find((i) => i.kg === 10)?.qty ?? 0,
        25: ctx.items.find((i) => i.kg === 25)?.qty ?? 0,
      };

      if (calcTotalKg(qtyByKg) === 0) throw new Error("数量が 0 です。");
      if (isOverMaxKg(qtyByKg)) throw new Error("50kg を超えています。");

      setLoading(true);

      const data = await checkoutFromConfirm({
        agreed: true,
        confirm_context: {
          farm_id: Number(ctx.farmId),
          pickup_slot_code: ctx.pickupSlotCode,
          pickup_display: ctx.nextPickupDisplay,
          items: ctx.items
            .filter((i) => i.qty > 0)
            .map((i) => ({
              size_kg: i.kg,
              quantity: i.qty,
            })),
          rice_subtotal: ctx.riceSubtotal,
          service_fee: ctx.serviceFee,
          total: ctx.total,
          client_next_pickup_deadline_iso:
            ctx.clientNextPickupDeadlineIso,
        },
      });

      window.location.href = data.checkout_url;
    } catch (e: any) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  /* ctx が無い = サーバーに PENDING が無い。ここで隠さない */
  if (!ctx) return null;

  return (
    <>
      {isLoggedIn ? (
        <PublicPageHeader
          title="予約内容の確認"
          consumerEmail={consumerEmail}
          hideMenu
          showBack
          onBack={() => navigate(`/farms/${farmId}`)}  
        />
      ) : (
        <SimplePageHeader title="予約内容の確認" />
      )}

      <div
        style={{
          padding: 16,
          paddingBottom: 32,
          maxWidth: 520,
          margin: "0 auto",
        }}
      >
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
          <div style={{ color: "#b91c1c", marginTop: 12 }}>
            {err}
          </div>
        )}

        <button
          onClick={handleMainAction}
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
            marginTop: 24,
          }}
        >
          {loading ? "処理中…" : "予約確定に進む"}
        </button>
      </div>
    </>
  );
}
