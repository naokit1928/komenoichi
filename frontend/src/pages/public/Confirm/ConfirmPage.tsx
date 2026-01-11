import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "@/config/api";

/* 共通ヘッダー */
import { FarmsListHeader as PublicPageHeader } from "@/components/PublicPageHeader";

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

const CONFIRM_CTX_KEY = "CONFIRM_CTX";

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
  const location = useLocation();

  const initial = (location.state as ConfirmCtx | null) ?? null;
  const [ctx, setCtx] = useState<ConfirmCtx | null>(initial);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [consumerEmail, setConsumerEmail] =
    useState<string | undefined>(undefined);

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

  useEffect(() => {
    if (ctx) {
      sessionStorage.setItem(CONFIRM_CTX_KEY, JSON.stringify(ctx));
    }
  }, [ctx]);

  useEffect(() => {
    async function run() {
      const data = await fetchIdentity();
      if (data?.is_logged_in && data.email) {
        setConsumerEmail(data.email);
      }
    }
    run();
  }, []);

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

      if (!ctx.pickupSlotCode || !ctx.nextPickupDisplay) {
        throw new Error("受け取り日時が確定していません。");
      }

      if (!agreed) {
        setErr("同意事項にチェックしてください。");
        return;
      }

      /* ======================================================
       * ★ ここが今回の本題
       *
       * DETAIL 通過時は 3時間より前
       * しかし CONFIRM で 3時間以内に入ってから
       * 「予約確定に進む」を押したケースだけを弾く
       * ====================================================== */
      if (ctx.clientNextPickupDeadlineIso) {
        const detailPassedAt =
          sessionStorage.getItem("detail_passed_at");

        if (detailPassedAt) {
          const detailTime = new Date(detailPassedAt);
          const deadline = new Date(
            ctx.clientNextPickupDeadlineIso
          );
          const now = new Date();

          if (detailTime < deadline && now >= deadline) {
            setErr(
              "予約の受付時間を過ぎたため、表示されていた受け渡し日時では予約できなくなりました。恐れ入りますが、次回の受け渡し日時であらためてご予約ください。"
            );
            return;
          }
        }
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

      setLoading(true);

      const identity = await fetchIdentity();
      if (!identity?.is_logged_in) {
        navigate("/login");
        return;
      }

      const data = await checkoutFromConfirm({
        agreed: true,
        confirm_context: {
          farm_id: Number(ctx.farmId),
          pickup_slot_code: ctx.pickupSlotCode,

          // 表示に使っている日時（JST文字列）
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

  if (!ctx) return null;

  return (
    <>
      <PublicPageHeader
        title="予約内容の確認"
        consumerEmail={consumerEmail}
      />

      <div
        style={{
          padding: 16,
          paddingBottom: 32,
          maxWidth: 720,
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

        <AgreementBlock
          agreed={agreed}
          onChange={setAgreed}
        />

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
