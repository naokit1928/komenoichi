import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { API_BASE } from "@/config/api";

import { RiceBreakdown } from "./components/RiceBreakdown";
import { ServiceFeeCard } from "./components/ServiceFeeCard";
import { AgreementBlock } from "./components/AgreementBlock";

import { calcTotalKg, isOverMaxKg } from "../FarmDetail/rules/orderRules";

const C = {
  red:       "#C62828",
  ink:       "#1a1108",
  ink3:      "#7a6c58", 
  border:    "#e8e2d8",
} as const;

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

type ConsumerState = {
  penalty: {
    status: "none" | "banned";
    penalty_count: number;
  };
  active: {
    exists: boolean;
  };
};

async function fetchIdentity(): Promise<{
  is_logged_in: boolean;
  email: string | null;
  own_farm_id?: number | null;
} | null> {
  const res = await fetch(`${API_BASE}/api/consumers/identity`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchConsumerState(): Promise<ConsumerState | null> {
  const res = await fetch(`${API_BASE}/api/consumer/state`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchConfirmContext(cs: string): Promise<ConfirmCtx | null> {
  const res = await fetch(
    `${API_BASE}/api/confirm/sessions/${encodeURIComponent(cs)}/context`,
    { credentials: "include" }
  );
  if (!res.ok) return null;

  const data = await res.json();

  return {
    farmId: String(data.farm_id),
    riceSubtotal: data.rice_subtotal,
    serviceFee: data.service_fee,
    total: data.total,
    items: (data.items || []).map((it: any) => ({
      kg: it.size_kg,
      qty: it.quantity,
      unitPrice: it.unit_price,
    })),
    pickupSlotCode: data.pickup_slot_code,
    nextPickupDisplay: data.pickup_display,
    clientNextPickupDeadlineIso: data.client_next_pickup_deadline_iso || null,
  };
}

async function checkoutFromConfirm(payload: { agreed: boolean; cs: string }) {
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
  const [searchParams] = useSearchParams();
  const cs = searchParams.get("cs");
  const navigate = useNavigate();

  const [ctx, setCtx] = useState<ConfirmCtx | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [isInitializing, setIsInitializing] = useState(true);
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    async function run() {
      try {
        if (!cs) {
          throw new Error("セッションが見つかりません。");
        }

        const idData = await fetchIdentity();
        if (idData?.own_farm_id && String(idData.own_farm_id) === farmId) {
          throw new Error("ご自身の農場には予約できません。");
        }

        const state = await fetchConsumerState();
        if (state?.active?.exists) {
          navigate(`/farms/${farmId}/active`, { replace: true });
          return;
        }

        if (state?.penalty?.status === "banned") {
          setIsBanned(true);
          setIsInitializing(false);
          return;
        }

        const context = await fetchConfirmContext(cs);
        if (!context) {
          throw new Error("予約情報の読み込みに失敗しました。");
        }
        setCtx(context);
      } catch (e: any) {
        setErr(String(e.message || e));
      } finally {
        setIsInitializing(false);
      }
    }
    run();
  }, [cs, farmId, navigate]);

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
      if (!ctx || !cs) return;
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

      const data = await checkoutFromConfirm({ agreed: true, cs });
      window.location.href = data.checkout_url;
    } catch (e: any) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  if (isInitializing) {
    return (
      <div style={{ display: "flex", justifyContent: "center", marginTop: "50px", color: C.ink3 }}>
        読み込み中...
      </div>
    );
  }

  if (isBanned) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "64px 24px", textAlign: "center" }}>
        <div style={{ padding: "16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "12px" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#4b5563" }}>
            現在、このアカウントからはご予約手続きを行うことができません。
          </p>
        </div>
      </div>
    );
  }

  if (!ctx) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "64px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.ink }}>
          {err || "エラーが発生しました"}
        </div>
        {err !== "ご自身の農場には予約できません。" && (
          <div style={{ color: C.ink3, fontSize: 14, marginTop: 12 }}>
            農家詳細ページに戻って、もう一度予約を開始してください。
          </div>
        )}
        <button
          onClick={() => navigate(`/farms/${farmId}`)}
          style={{
            marginTop: 24, padding: "12px 24px", background: "#fff",
            color: C.ink, border: `1px solid ${C.border}`,
            borderRadius: 9999, cursor: "pointer", fontWeight: 600,
          }}
        >
          詳細に戻る
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 16px 64px", maxWidth: 520, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", position: "relative", marginBottom: 24 }}>
        <button
          onClick={() => navigate(`/farms/${farmId}`)}
          disabled={loading}
          style={{
            position: "absolute", left: 0, background: "none", border: "none",
            padding: "8px", margin: "-8px",
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: C.ink, opacity: loading ? 0.5 : 1,
          }}
          aria-label="農家詳細に戻る"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <h1 style={{
          flex: 1, fontSize: 18, fontWeight: 600, color: C.ink,
          textAlign: "center", margin: 0,
          fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif",
        }}>
          予約内容の確認
        </h1>
      </div>

      <RiceBreakdown
        riceSubtotal={ctx.riceSubtotal}
        lines={riceLines}
        pickupDisplay={ctx.nextPickupDisplay}
      />

      {/* 運営サポート費（300円）のブロックをコメントアウトしました */}
      {/* <ServiceFeeCard
        serviceFee={ctx.serviceFee}
        termLabel="運営サポート費"
      />
      */}

      <AgreementBlock agreed={agreed} onChange={setAgreed} />

      {err && (
        <div style={{ color: C.red, marginTop: 16, textAlign: "center", fontSize: 14, fontWeight: 600 }}>
          {err}
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <button
          onClick={handleMainAction}
          disabled={loading}
          style={{
            width: "100%",
            height: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: loading ? "#d1d5db" : C.red,
            color: "#fff",
            borderRadius: 9999,
            border: "none",
            fontWeight: 700,
            fontSize: 16,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            boxShadow: loading ? "none" : "0 4px 12px rgba(198, 40, 40, 0.3)",
          }}
        >
          {/* ★ 変更: 「予約確定に進む」→「予約を確定する」 */}
          {loading ? "処理中…" : "予約を確定する"}
        </button>
      </div>
    </div>
  );
}
