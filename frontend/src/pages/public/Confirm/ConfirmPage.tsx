// src/pages/ConfirmPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "@/config/api";

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

  // V2 用: 農家側が決めた受け渡しスロット（あれば渡す）
  pickupSlotCode?: string | null; // 例: "WED_19_20"
  nextPickupDisplay?: string | null; // 例: "11/27（水）19:00–20:00"

  // Detail 画面で見ていた next_pickup_deadline（ISO文字列）
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
  // サーバ側に渡すオリジナル締切
  client_next_pickup_deadline_iso?: string;
};

const CONFIRM_CTX_KEY = "CONFIRM_CTX";
const AUTO_PAY_KEY = "AUTO_PAY_AFTER_LINE";
const TERM_SERVICE = "運営サポート費";

// ---- API (V2) ----
async function createReservationV2(
  payload: ReservationFormInput
): Promise<ReservationResultDTO> {
  const res = await fetch(`${API_BASE}/api/reservations`, {

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
          if (json && typeof json.detail === "string" && json.detail.trim()) {
            message = json.detail.trim();
          } else {
            message = text;
          }
        } catch {
          message = text;
        }
      }
    } catch {
      // ignore
    }

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
    throw new Error(
      `startCheckout failed: ${res.status} ${await res.text()}`
    );
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
  const [serverLinked, setServerLinked] = useState<boolean>(false);
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
      } catch {
        // ignore
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  const lineReady = serverLinked;

  // LINE ログイン後の自動遷移
  useEffect(() => {
    const saved = sessionStorage.getItem(CONFIRM_CTX_KEY);
    const auto = sessionStorage.getItem(AUTO_PAY_KEY);

    if (!ctx && saved) {
      try {
        setCtx(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
    if (lineReady && auto && ctx) {
      sessionStorage.removeItem(AUTO_PAY_KEY);
      handlePay(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, lineReady, location.search, serverLinked]);

  const money = (n: number) => n.toLocaleString("ja-JP");

  const riceLines = useMemo(() => {
    if (!ctx) return [];
    const lines: { label: string; amount: number }[] = [];
    ctx.items.forEach((it) => {
      if (!it.qty) return;
      const label = `白米${it.kg}kg × ${it.qty}（@${money(it.unitPrice)}円）`;
      lines.push({ label, amount: it.unitPrice * it.qty });
    });
    return lines;
  }, [ctx]);

  const handlePay = async (silent = false) => {
    try {
      if (!ctx) {
        throw new Error(
          "表示データがありません。先に農家詳細からやり直してください。"
        );
      }

      // 同意チェック（silent=true のときはスキップ）
      if (!agreed && !silent) {
        setErr("予約に際する同意事項にチェックしてください。");
        return;
      }

      // LINE 未連携なら LINE ログインに飛ばす
      if (!lineReady) {
        sessionStorage.setItem(CONFIRM_CTX_KEY, JSON.stringify(ctx));
        sessionStorage.setItem(AUTO_PAY_KEY, "1");
        const returnToAbs = `${FRONT_BASE}/farms/${ctx.farmId}/confirm?autopay=1`;
        const apiLoginUrl = `${API_BASE}/api/line/login?return_to=${encodeURIComponent(
          returnToAbs
        )}`;
        window.location.href = apiLoginUrl;
        return;
      }

      setLoading(true);
      setErr("");

      // V2: size_kg / quantity だけ送る（単価はサーバーで再計算）
      const items: ReservationItemInput[] = ctx.items
        .filter(
          (it) => it.qty > 0 && (it.kg === 5 || it.kg === 10 || it.kg === 25)
        )
        .map((it) => ({
          size_kg: it.kg,
          quantity: it.qty,
        }));

      if (items.length === 0) {
        throw new Error("数量が 0 のため予約できません。");
      }

      // 受け渡しスロットコード（データ取得の必須項目）
      const pickupSlotCode = ctx.pickupSlotCode?.trim();
      if (!pickupSlotCode) {
        throw new Error(
          "受け渡し情報の取得に失敗しました。農家詳細ページに戻ってください。"
        );
      }

      const clientNextPickupDeadlineIso =
        ctx.clientNextPickupDeadlineIso?.trim() || undefined;

      const result = await createReservationV2({
        farm_id: Number(ctx.farmId),
        pickup_slot_code: pickupSlotCode,
        items,
        client_next_pickup_deadline_iso: clientNextPickupDeadlineIso,
      });

      // 念のためサーバー計算値で ctx を更新しておく
      setCtx((prev) => {
        if (!prev) return prev;
        const newItems = prev.items.map((it) => {
          const serverItem = result.items.find((si) => si.size_kg === it.kg);
          if (!serverItem) return it;
          return {
            ...it,
            unitPrice: serverItem.unit_price,
          };
        });
        const riceSubtotal = result.rice_subtotal;
        const serviceFee = result.service_fee;
        return {
          ...prev,
          items: newItems,
          riceSubtotal,
          serviceFee,
          total: riceSubtotal + serviceFee,
        };
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

  const card: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  };

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
      {/* ヘッダー（中央揃えタイトル＋左右均衡） */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 16,
          position: "relative",
        }}
      >
        {/* 左の戻るボタン */}
        <Link
          to={`/farms/${farmId}`}
          style={{
            width: 80,
            display: "inline-block",
            textDecoration: "none",
          }}
        >
          ← 戻る
        </Link>

        {/* タイトル：左右均等になるので本当の中央になる */}
        <div style={{ flex: 1, textAlign: "center" }}>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 800,
              margin: 0,
            }}
          >
            予約内容の確認
          </h1>
        </div>

        {/* 右側の透明ダミー（戻るボタンと同じ幅） */}
        <div style={{ width: 80 }} />
      </div>

      {/* お米代内訳 */}
      <section style={{ ...card, marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
            fontWeight: 700,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>お米代</span>
            <span
              style={{
                background: "#f3f4f6",
                color: "#374151",
                borderRadius: 9999,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              当日現地払い
            </span>
          </div>
          <span>{money(ctx.riceSubtotal)}円</span>
        </div>
        <div>
          {riceLines.map((l, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 2,
              }}
            >
              <span>{l.label}</span>
              <span>{money(l.amount)}円</span>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 8,
            color: "#6b7280",
            fontSize: 12,
          }}
        >
          ※ 受け渡し当日に、農家さんへ現金でお支払いください。
        </div>
      </section>

      {/* 運営サポート費（緑枠で強調） */}
      <section
        style={{
          ...card,
          marginBottom: 12,
          border: "2px solid rgba(31,122,54,0.55)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: 700,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>{TERM_SERVICE}</span>
            <span
              style={{
                background: "rgba(31,122,54,0.1)",
                color: "#1f7a36",
                borderRadius: 9999,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              今オンラインで支払い
            </span>
          </div>
          <span>{money(ctx.serviceFee)}円</span>
        </div>
        <div
          style={{
            marginTop: 6,
            color: "#6b7280",
            fontSize: 12,
          }}
        >
          Stripe を通じてオンラインでお支払いいただきます。
        </div>
      </section>

      {/* 予約に際する同意事項：タイトル＋内容カード分離 */}
      <div
        style={{
          marginTop: 16,
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        予約に際する同意事項
      </div>
      <section
        style={{
          ...card,
          border: "1.5px solid #333333",
          paddingTop: 14,
          paddingBottom: 14,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          <p style={{ margin: 0, marginBottom: 4 }}>
            ・連絡のため、LINE連携（友だち追加＋ログイン）が必要です。
          </p>
          <p style={{ margin: 0, marginBottom: 4 }}>
            ・受け渡し時間内にお越しください。遅れる場合はLINEでご連絡ください。
          </p>
          <p style={{ margin: 0, marginBottom: 4 }}>
            ・お米代は当日現金払い、運営サポート費（300円）はオンライン決済です。
          </p>
          <p style={{ margin: 0, marginBottom: 8 }}>
            ・無断キャンセルをした場合、次回以降の購入が制限されることがあります。
          </p>

          <div style={{ fontWeight: 600, marginTop: 8, marginBottom: 4 }}>
            【キャンセルについて】
          </div>
          <p style={{ margin: 0, marginBottom: 4 }}>
            ・受け渡し開始の3時間前までキャンセルできます。
          </p>
          <p style={{ margin: 0, marginBottom: 4 }}>
            ・農家へのお支払い分にはキャンセル料はかかりません。
          </p>
          <p style={{ margin: 0, marginBottom: 0 }}>
            ※ システム利用料（300円）は返金されません。
          </p>
        </div>
      </section>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 500,   // これを追加
          }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{
              width: 18,
              height: 18,
              accentColor: "#1f7a36",
            }}
          />
          上記に同意します
        </label>
      </div>

      {/* エラー表示 */}
      {err && (
        <div
          style={{
            color: "#b91c1c",
            marginBottom: 8,
            whiteSpace: "pre-wrap",
          }}
        >
          {err}
        </div>
      )}

      {/* 決済ボタン（DetailPage のCTAに合わせて黒枠・影なし） */}
      <div
        style={{
          marginTop: 26,
        }}
      >
        <button
          onClick={() => handlePay(false)}
          disabled={loading}
          style={{
            width: "100%",
            minWidth: 184,
            padding: "11px 16px",
            background: loading ? "#ddd" : "#1f7a36",
            color: loading ? "#666" : "#fff",
            borderRadius: 9999,
            border: "none",
            outline: "none",
            boxShadow: "none",
            fontWeight: 600,
            fontSize: 15,
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading
            ? "Stripeへ接続中..."
            : `${TERM_SERVICE}${money(
                ctx.serviceFee
              )}円を支払って予約を確定する`}
        </button>
      </div>
    </div>
  );
}
