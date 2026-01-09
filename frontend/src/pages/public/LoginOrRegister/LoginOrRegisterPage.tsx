import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "@/config/api";

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

type MagicLinkResponse = {
  ok: boolean;
  debug_magic_link_url?: string | null;
};

async function sendMagicLink(payload: {
  email: string;
  confirm_context: any;
  agreed: boolean;
}): Promise<MagicLinkResponse> {
  const res = await fetch(`${API_BASE}/api/auth/consumer/magic/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail || "認証処理に失敗しました。");
  }

  return res.json();
}

export default function LoginOrRegisterPage() {
  const navigate = useNavigate();

  const [ctx, setCtx] = useState<ConfirmCtx | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkUrl, setMagicLinkUrl] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem(CONFIRM_CTX_KEY);
    if (!saved) return;
    try {
      setCtx(JSON.parse(saved));
    } catch {}
  }, []);

  async function handleContinue() {
    try {
      setErr("");

      if (!ctx) {
        setErr("購入情報が見つかりません。Confirm からやり直してください。");
        return;
      }

      if (!email) {
        setErr("メールアドレスを入力してください。");
        return;
      }

      setLoading(true);

      const res = await sendMagicLink({
        email,
        agreed: true,
        confirm_context: {
          farm_id: Number(ctx.farmId),
          items: ctx.items
            .filter((i) => i.qty > 0)
            .map((i) => ({
              size_kg: i.kg,
              quantity: i.qty,
            })),
          pickup_slot_code: ctx.pickupSlotCode,
          rice_subtotal: ctx.riceSubtotal,
          service_fee: ctx.serviceFee,
          total: ctx.total,
          client_next_pickup_deadline_iso: ctx.clientNextPickupDeadlineIso,
        },
      });

      if (!res.debug_magic_link_url) {
        throw new Error("magic link が取得できません。");
      }

      setMagicLinkUrl(res.debug_magic_link_url);
    } catch (e: any) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        padding: 16,
        paddingBottom: 32,
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
        サインインまたはアカウント作成
      </div>

      <div style={{ color: "#555", fontSize: 13, marginBottom: 14 }}>
        メールアドレスを入力して続行してください。
      </div>

      {!magicLinkUrl ? (
        <>
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
          />

          {err && (
            <div style={{ color: "#b91c1c", marginTop: 10 }}>{err}</div>
          )}

          <button
            onClick={handleContinue}
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: loading ? "#ddd" : "#111",
              color: loading ? "#666" : "#fff",
              borderRadius: 10,
              border: "none",
              fontWeight: 700,
              fontSize: 15,
              cursor: loading ? "default" : "pointer",
              marginTop: 14,
            }}
          >
            {loading ? "処理中…" : "続行"}
          </button>

          <button
            onClick={() => navigate(-1)}
            style={{
              width: "100%",
              padding: "10px 16px",
              background: "transparent",
              color: "#111",
              borderRadius: 10,
              border: "1px solid #ddd",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              marginTop: 10,
            }}
          >
            戻る
          </button>
        </>
      ) : (
        <div
          style={{
            marginTop: 12,
            padding: 14,
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "#fafafa",
            wordBreak: "break-all",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            開発中のため、以下のリンクをクリックしてください
          </div>

          <a
            href={magicLinkUrl}
            style={{
              color: "#2563eb",
              textDecoration: "underline",
              fontSize: 14,
            }}
          >
            {magicLinkUrl}
          </a>

          <div style={{ fontSize: 12, color: "#555", marginTop: 10 }}>
            このリンクを開くとログインが完了し、そのまま決済画面に進みます。
          </div>
        </div>
      )}
    </div>
  );
}
