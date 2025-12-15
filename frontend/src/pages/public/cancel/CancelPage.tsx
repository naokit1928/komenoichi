// src/pages/public/cancel/CancelPage.tsx

import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE } from "@/config/api";


type CancelGetResponse = {
  reservation_id: number;
  pickup_display: string;
  qty_5: number;
  qty_10: number;
  qty_25: number;
  rice_subtotal: number;
  is_cancellable: boolean;
};

type CancelPostResponse = {
  reservation_id: number;
  status: string; // "cancelled"
};

type ViewState = "loading" | "ready" | "posted" | "error";

const CancelPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("token") || "").trim();

  const [viewState, setViewState] = useState<ViewState>("loading");
  const [data, setData] = useState<CancelGetResponse | null>(null);
  const [postResult, setPostResult] = useState<CancelPostResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // -----------------------------
  // 初回ロード時：GET /api/reservation/cancel
  // -----------------------------
  useEffect(() => {
    if (!token) {
      setErrorMessage(
        "キャンセル用のURLが不正です。もう一度 LINE のメッセージからアクセスしてください。"
      );
      setViewState("error");
      return;
    }

    const fetchData = async () => {
      try {
        setViewState("loading");
        setErrorMessage(null);

        const res = await fetch(
          `${API_BASE}/api/reservation/cancel?token=${encodeURIComponent(token)}`
        );

        if (!res.ok) {
          let detail = "不明なエラーが発生しました。";
          try {
            const body = await res.json();
            if (body && typeof body.detail === "string") {
              detail = body.detail;
            }
          } catch {
            // JSON でない場合はそのまま
          }

          setErrorMessage(mapBackendDetailToMessage(detail));
          setViewState("error");
          return;
        }

        const body: CancelGetResponse = await res.json();
        setData(body);
        setViewState("ready");
      } catch (e) {
        console.error(e);
        setErrorMessage(
          "サーバーへの接続に失敗しました。通信環境をご確認のうえ、再度お試しください。"
        );
        setViewState("error");
      }
    };

    fetchData();
  }, [token]);

  // -----------------------------
  // キャンセル実行：POST /api/reservation/cancel
  // -----------------------------
  const handleCancel = async () => {
    if (!token || !data || !data.is_cancellable || posting) return;

    try {
      setPosting(true);
      setErrorMessage(null);

      const res = await fetch(`${API_BASE}/api/reservation/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: token.trim() }),
      });

      if (!res.ok) {
        let detail = "不明なエラーが発生しました。";
        try {
          const body = await res.json();
          if (body && typeof body.detail === "string") {
            detail = body.detail;
          }
        } catch {
          // noop
        }

        setErrorMessage(mapBackendDetailToMessage(detail));
        setViewState("error");
        return;
      }

      const body: CancelPostResponse = await res.json();
      setPostResult(body);
      setViewState("posted");
    } catch (e) {
      console.error(e);
      setErrorMessage(
        "サーバーへの接続に失敗しました。通信環境をご確認のうえ、再度お試しください。"
      );
      setViewState("error");
    } finally {
      setPosting(false);
    }
  };

  // -----------------------------
  // レンダリング
  // -----------------------------
  const renderContent = () => {
    if (viewState === "loading") {
      return <p>読み込み中です…</p>;
    }

    if (viewState === "error") {
      return (
        <div>
          <h2
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            エラーが発生しました
          </h2>
          <p style={{ color: "red", whiteSpace: "pre-line" }}>
            {errorMessage || "エラーが発生しました。"}
          </p>
          <p style={{ marginTop: 8 }}>
            お手数ですが、必要に応じてもう一度 LINE のメッセージからアクセスし直してください。
          </p>
        </div>
      );
    }

    if (!data) {
      return <p>予約情報を取得できませんでした。</p>;
    }

    if (viewState === "posted" && postResult) {
      return (
        <div>
          <h2
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            キャンセルが完了しました
          </h2>
          <p>予約ID：{postResult.reservation_id}</p>
          <p style={{ marginTop: 8 }}>
            キャンセルが正常に処理されました。ご利用ありがとうございました。
          </p>
        </div>
      );
    }

    // viewState === "ready" のケース
    return (
      <div>
        <h2
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          予約のキャンセル確認
        </h2>
        <p
          style={{
            fontSize: "0.9rem",
            color: "#555",
            marginBottom: 16,
          }}
        >
          以下の予約をキャンセルします。内容をご確認のうえ、よろしければ下のボタンからキャンセルしてください。
        </p>

        <section
          style={{
            paddingTop: 8,
            paddingBottom: 8,
            borderTop: "1px solid #eee",
          }}
        >
          <h3
            style={{
              fontSize: "0.95rem",
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            受け渡し日時
          </h3>
          <p>{data.pickup_display}</p>
        </section>

        <section
          style={{
            paddingTop: 8,
            paddingBottom: 8,
            borderTop: "1px solid #eee",
          }}
        >
          <h3
            style={{
              fontSize: "0.95rem",
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            予約内容
          </h3>
          <ul style={{ paddingLeft: 20, marginTop: 4, marginBottom: 0 }}>
            {data.qty_5 > 0 && <li>5kg袋：{data.qty_5}袋</li>}
            {data.qty_10 > 0 && <li>10kg袋：{data.qty_10}袋</li>}
            {data.qty_25 > 0 && <li>25kg袋：{data.qty_25}袋</li>}
          </ul>
          {/* 金額は混乱を避けるため表示しない */}
        </section>

        <section
          style={{
            paddingTop: 8,
            paddingBottom: 8,
            borderTop: "1px solid #eee",
            marginBottom: 16,
          }}
        >
          {data.is_cancellable ? (
            <>
              <p style={{ marginBottom: 4 }}>
                キャンセルしても、お米代のお支払いは不要です。
              </p>
              <p style={{ marginTop: 4, fontSize: "0.9rem", color: "#555" }}>
                ※ すでにお支払いいただいたシステム利用料（300円）は返金されません。
              </p>
            </>
          ) : (
            <p style={{ color: "red" }}>
              キャンセル可能な期限を過ぎているため、
              この画面からはキャンセルできません。
            </p>
          )}
        </section>

        {data.is_cancellable && (
          <div style={{ textAlign: "center" }}>
            <button
              type="button"
              onClick={handleCancel}
              disabled={posting}
              style={{
                padding: "10px 24px",
                borderRadius: 9999,
                border: "none",
                fontWeight: 600,
                cursor: posting ? "default" : "pointer",
                backgroundColor: "#000000",
                color: "#ffffff",
                minWidth: 220,
              }}
            >
              {posting ? "キャンセル処理中…" : "この予約をキャンセルする"}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        padding: "24px 12px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 8,
            padding: 20,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            fontSize: "14px",
            lineHeight: 1.6,
          }}
        >
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

function mapBackendDetailToMessage(detail: string): string {
  switch (detail) {
    case "TOKEN_INVALID":
    case "Invalid cancel token encoding":
      return "キャンセル用URLが不正です。もう一度 LINE のメッセージからアクセスしてください。";
    case "TOKEN_EXPIRED":
    case "Cancellation deadline passed":
      return "キャンセル用URLの有効期限が切れています。";
    case "NOT_FOUND":
      return "該当する予約が見つかりませんでした。";
    case "ALREADY_CANCELLED":
      return "この予約はすでにキャンセルされています。";
    case "CANCEL_LIMIT_PASSED":
      return "キャンセル可能な期限を過ぎているため、この予約はキャンセルできません。";
    case "LINE_USER_ID_MISSING":
    case "LINE_USER_ID_MISMATCH":
      return "この予約のキャンセル権限がありません。LINEアカウントをご確認ください。";
    default:
      return `エラーが発生しました。（detail: ${detail}）`;
  }
}

export default CancelPage;
