import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { API_BASE } from "@/config/api";

/* Confirm 専用カード */
import { RiceBreakdown } from "./components/RiceBreakdown";
import { ServiceFeeCard } from "./components/ServiceFeeCard";
import { AgreementBlock } from "./components/AgreementBlock";

import { calcTotalKg, isOverMaxKg } from "../FarmDetail/rules/orderRules";

// ── Brand tokens ──────────────────────────────────
const C = {
  red:       "#C62828",
  ink:       "#1a1108",
  ink3:      "#7a6c58", // エラー画面などのサブテキスト用
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

/* ===== Active（confirmed）取得 ===== */
async function fetchActiveReservation(): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/reservations/booked/me`, {
    credentials: "include",
  });
  return res.ok;
}

/* ===== PENDING（ConfirmSession 単位） ===== */
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

/* ===== stripe ===== */
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

  // ★ 追加: 初期データの読み込み中かどうかを管理するステート
  const [isInitializing, setIsInitializing] = useState(true);

  /* ===== Confirm Context 取得 ===== */
  useEffect(() => {
    async function run() {
      try {
        if (!cs) {
          throw new Error("confirm_session_id がありません");
        }

        const hasActive = await fetchActiveReservation();
        if (hasActive) {
          navigate(`/farms/${farmId}/active`, { replace: true });
          return;
        }

        const context = await fetchConfirmContext(cs);
        setCtx(context);
      } catch (e: any) {
        setErr(String(e.message || e));
      } finally {
        // ★ 追加: 取得が完了したら（成功でもエラーでも）ローディング状態を解除する
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

  // ★ 追加: データを取得している間はエラー画面を出さずに待機させる
  if (isInitializing) {
    return (
      <div style={{ display: "flex", justifyContent: "center", marginTop: "50px", color: C.ink3 }}>
        読み込み中...
      </div>
    );
  }

  /* データがない場合（エラー時）の表示 */
  if (!ctx) {
    return (
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          padding: "64px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600, color: C.ink }}>
          予約情報が見つかりませんでした
        </div>
        <div style={{ color: C.ink3, fontSize: 14, marginTop: 12 }}>
          農家詳細ページに戻って、もう一度予約を開始してください。
        </div>
        <button
          onClick={() => navigate(`/farms/${farmId}`)}
          style={{
            marginTop: 24,
            padding: "12px 24px",
            background: "#fff",
            color: C.ink,
            border: `1px solid ${C.border}`,
            borderRadius: 9999,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          詳細に戻る
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "24px 16px 64px", // 上の余白を少し調整
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      {/* 改善1: ページタイトルを配置し、何をする画面か明確にする */}
      <h1
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: C.ink,
          textAlign: "center",
          margin: "0 0 24px 0",
          fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif",
        }}
      >
        予約内容の確認
      </h1>

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
        <div
          style={{
            color: C.red,
            marginTop: 16,
            textAlign: "center",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {err}
        </div>
      )}

      {/* (前略... 219行目付近のボタン部分を以下に差し替え) */}
      <button
        onClick={handleMainAction}
        disabled={loading}
        style={{
          width: "100%",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: loading ? "#d1d5db" : "#C62828", // ← 赤から濃い茶色へ
          color: "#fff",
          borderRadius: 9999,
          border: "none",
          fontWeight: 600,
          fontSize: 16,
          marginTop: 32,
          cursor: loading ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          boxShadow: loading ? "none" : "0 4px 12px rgba(198, 40, 40, 0.3)", // 影も茶色へ
        }}
      >
        {loading ? "処理中…" : "予約確定に進む"}
      </button>
    </div>
  );
}