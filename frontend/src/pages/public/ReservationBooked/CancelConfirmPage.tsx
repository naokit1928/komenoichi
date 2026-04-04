// frontend/src/pages/public/ReservationCancel/CancelConfirmPage.tsx
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE } from "@/config/api";

const CANCEL_API_URL = `${API_BASE}/api/reservation/cancel`;

const tagStyle = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 9999,
  background: "#f3f4f6",
  border: "1px solid #e5e7eb",
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 600,
  color: "#4b5563",
};

async function fetchConsumerState() {
  const res = await fetch(`${API_BASE}/api/consumer/state`, { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

// 受け渡し開始時刻まで3時間未満かどうかを判定
function isWithinThreeHours(eventStartAt: string | null): boolean {
  if (!eventStartAt) return false;
  const start = new Date(eventStartAt).getTime();
  const now = Date.now();
  return start - now < 3 * 60 * 60 * 1000;
}

const CancelConfirmPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const eventStartAt = searchParams.get("event_start_at");

  const isLateCancel = isWithinThreeHours(eventStartAt);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  const renderShell = (child: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 40px 16px", background: "#f8fafc" }}>
        <div style={{ background: "#ffffff", borderRadius: 18, padding: "24px 18px 20px", border: "1px solid #e5e7eb", boxShadow: "0 6px 18px rgba(0,0,0,0.06)" }}>
          {child}
        </div>
      </section>
    </div>
  );

  useEffect(() => {
    if (!token) {
      setError("キャンセル用のリンクが不正です。");
    }
    // penalty_countは不要になったが、ログイン確認のためstateは取得
    fetchConsumerState().then(() => {
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [token]);

  const executeCancel = async () => {
    if (!token) return;
    try {
      setConfirming(true);
      setError(null);

      const res = await fetch(CANCEL_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        let backendMsg = "";
        try {
          const data = await res.json();
          backendMsg = data.detail || "";
        } catch (e) {}

        if (res.status === 400 && backendMsg.toLowerCase().includes("deadline")) {
          throw new Error("受け渡し時間を過ぎているため、キャンセルできません。");
        }
        throw new Error("cancel failed");
      }
      setDone(true);
    } catch (e: any) {
      setError(e.message !== "cancel failed" ? e.message : "キャンセル手続きに失敗しました。時間をおいて再度お試しください。");
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return renderShell(
      <div style={{ textAlign: "center", padding: "40px 0", fontSize: 14, color: "#6b7280" }}>読み込み中です…</div>
    );
  }

  if (error && !done) {
    const isDeadlineError = error.includes("過ぎて");
    return renderShell(
      <div style={{ padding: "12px 4px 4px" }}>
        <header style={{ marginBottom: 16 }}>
          <div style={{ ...tagStyle, background: "#fef2f2", border: "1px solid #fee2e2", color: "#b91c1c" }}>
            キャンセル手続きエラー
          </div>
        </header>
        <div style={{ fontSize: 14, color: "#b91c1c", marginBottom: 8, fontWeight: 500 }}>{error}</div>
        <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.7 }}>
          {isDeadlineError ? "お困りの場合は、直接農家へご相談ください。" : "このページを再読み込みするか、予約一覧から再度お試しください。"}
        </div>
      </div>
    );
  }

  if (done) {
    return renderShell(
      <div style={{ padding: "12px 4px 4px" }}>
        <header style={{ marginBottom: 16 }}>
          <div style={tagStyle}>キャンセルが完了しました</div>
        </header>
        <h1 style={{ marginTop: 4, fontSize: 18, fontWeight: 700, color: "#111827" }}>
          予約のキャンセルが完了しました。
        </h1>
        <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7, color: "#374151" }}>
          キャンセルを受け付けました。ご都合のよい別の日時で、またのご予約をお待ちしています。
        </p>
        <div style={{ marginTop: 32 }}>
          <button
            type="button"
            onClick={() => window.location.href = "/farms"}
            style={{ width: "100%", padding: "14px 16px", borderRadius: 9999, border: "none", background: "#111827", color: "#ffffff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
          >
            農家一覧へ戻る
          </button>
        </div>
      </div>
    );
  }

  return renderShell(
    <div style={{ padding: "12px 4px 4px" }}>
      <header style={{ marginBottom: 16 }}>
        <div style={tagStyle}>キャンセル確認</div>
      </header>

      <h1 style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
        キャンセルを確定しますか？
      </h1>

      {/* ── 通常キャンセル（3時間以上前） ── */}
      {!isLateCancel && (
        <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7, color: "#374151" }}>
          キャンセルを実行すると、この予約は取り消されます。
          <br />
          お米代のお支払いは発生しません。
        </p>
      )}

      {/* ── 遅延キャンセル（3時間以内）: 毎回警告を常時表示 ── */}
      {isLateCancel && (
        <>
          <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.7, color: "#374151" }}>
            受け渡し時刻まで3時間を切っています。
          </p>
          <div style={{ marginTop: 16, padding: "16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px" }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#991b1b" }}>
              農家さんへのご配慮をお願いします
            </p>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#7f1d1d", lineHeight: 1.6 }}>
              農家さんはご予約日に合わせて精米を行っています。精米されたお米は他への販売が難しく、キャンセルされると農家さんが処理に困ってしまいます。やむを得ないご事情を除き、できるだけキャンセルはお控えください。
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "#b91c1c", lineHeight: 1.5 }}>
              ※受け渡し直前のキャンセルや無断キャンセルが重なった場合は、次回以降のご購入を制限させていただく場合があります。
            </p>
          </div>
        </>
      )}

      {/* ── 300円サービス料 注意書き ──────────────────────────────
          FREE_LAUNCH_MODE 期間中は非表示（コメントアウト）。
          300円徴収を再開するときは下の <div> ブロックのコメントを外す。
          合わせて AgreementBlock / ConfirmPage / LawPage / TermsPage
          の同様のコメントアウトも復活させること。
      ───────────────────────────────────────────────────────────── */}
      {/* <div style={{ marginTop: 12, marginBottom: 8 }}>
        <p style={{ fontSize: 12, lineHeight: 1.6, color: "#6b7280", marginBottom: 4 }}>
          ※ すでにお支払いいただいたシステム利用料（300円）は返金されません。
        </p>
      </div> */}

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          type="button"
          onClick={executeCancel}
          disabled={confirming}
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 9999,
            border: "none", outline: "none",
            background: confirming ? "#9ca3af" : (isLateCancel ? "#b91c1c" : "#111827"),
            color: "#ffffff", fontSize: 14, fontWeight: 700,
            cursor: confirming ? "default" : "pointer", transition: "all 0.2s",
          }}
        >
          {confirming
            ? "キャンセル処理中…"
            : isLateCancel
              ? "やむを得ない事情のためキャンセルする"
              : "キャンセルを確定する"
          }
        </button>

        <button
          type="button"
          onClick={() => window.history.back()}
          style={{
            width: "100%", padding: "10px 16px", borderRadius: 9999,
            border: "1px solid #d1d5db", background: "#ffffff",
            color: "#374151", fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}
        >
          キャンセルせずに戻る
        </button>
      </div>
    </div>
  );
};

export default CancelConfirmPage;
