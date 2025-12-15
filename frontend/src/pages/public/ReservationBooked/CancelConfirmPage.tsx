// frontend/src/pages/public/ReservationCancel/CancelConfirmPage.tsx
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE } from "@/config/api";


/**
 * キャンセル確認ページ
 *
 * 役割：
 * - token クエリパラメータを受け取り、キャンセル用リンクの有効性をチェック
 * - ユーザーに「本当にキャンセルするか？」だけをシンプルに確認
 * - 確定ボタン押下でキャンセル API を叩く
 *
 * ★ 注意：
 *   - API のパスは仮で `/api/reservation/cancel` を使っています。
 *   - 実際のバックエンド実装に合わせて URL / メソッドだけ必要に応じて調整してください。
 */

const CANCEL_API_URL = `${API_BASE}/api/reservation/cancel`;


const CancelConfirmPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true); // token 検証中
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false); // キャンセル実行中
  const [done, setDone] = useState(false); // キャンセル完了フラグ

  // 共通レイアウト（ReservationBookedPage と同じ構造）
  const renderShell = (child: React.ReactNode) => (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
      }}
    >
      <section
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "24px 16px 40px 16px",
          background: "#f8fafc",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: 18,
            padding: "24px 18px 20px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
          }}
        >
          {child}
        </div>
      </section>
    </div>
  );

  // 初回：token の存在チェック＋有効性チェック
  useEffect(() => {
    if (!token) {
      setError("キャンセル用のリンクが不正か、有効期限が切れている可能性があります。");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // ★ 仮実装：
        //   - GET /api/reservation/cancel?token=... でトークン有効性だけチェックする想定
        //   - レスポンス内容は画面には出さず、「エラーかどうか」だけ判定に使う
        const res = await fetch(
          `${CANCEL_API_URL}?token=${encodeURIComponent(token)}`,
          {
            method: "GET",
          }
        );

        if (!res.ok) {
          throw new Error("invalid token");
        }

        // 必要ならここで JSON を読んで状態表示に使うことも可能
        // const data = await res.json();
        // console.log("cancel preview:", data);

        setLoading(false);
      } catch (e) {
        console.error(e);
        setError(
          "キャンセル用のリンクが無効か、有効期限が切れている可能性があります。"
        );
        setLoading(false);
      }
    })();
  }, [token]);

  // キャンセル実行
  const handleConfirm = async () => {
    if (!token) return;

    try {
      setConfirming(true);
      setError(null);

      // ★ 仮実装：
      //   - POST /api/reservation/cancel に { token } を送って実際のキャンセルを実行する想定
      const res = await fetch(CANCEL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        throw new Error("cancel failed");
      }

      // 正常終了：同じ画面内で「完了表示」に切り替える
      setDone(true);
    } catch (e) {
      console.error(e);
      setError(
        "キャンセル手続きに失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setConfirming(false);
    }
  };

  // ローディング表示
  if (loading) {
    return renderShell(
      <div
        style={{
          textAlign: "center",
          padding: "40px 0",
          fontSize: 14,
          color: "#6b7280",
        }}
      >
        読み込み中です…
      </div>
    );
  }

  // エラー表示
  if (error && !done) {
    return renderShell(
      <div
        style={{
          padding: "12px 4px 4px",
        }}
      >
        <header style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 9999,
              background: "#fef2f2",
              border: "1px solid #fee2e2",
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              color: "#b91c1c",
            }}
          >
            キャンセル手続きエラー
          </div>
        </header>

        <div
          style={{
            fontSize: 14,
            color: "#b91c1c",
            marginBottom: 8,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            lineHeight: 1.7,
          }}
        >
          お手元の LINE メッセージから、もう一度キャンセル用リンクを開き直してください。
        </div>
      </div>
    );
  }

  // キャンセル完了表示
  if (done) {
    return renderShell(
      <div
        style={{
          padding: "12px 4px 4px",
        }}
      >
        <header style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 9999,
              background: "#ecfdf3",
              border: "1px solid #bbf7d0",
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              color: "#166534",
            }}
          >
            キャンセルが完了しました
          </div>
        </header>

        <h1
          style={{
            marginTop: 4,
            fontSize: 18,
            fontWeight: 700,
            color: "#111827",
          }}
        >
          予約のキャンセルが完了しました。
        </h1>
        <p
          style={{
            marginTop: 10,
            fontSize: 13,
            lineHeight: 1.7,
            color: "#374151",
          }}
        >
         キャンセルを受け付けました。ご都合のよい別の日時で、またのご予約をお待ちしています。 
        </p>
      </div>
    );
  }

  // 通常：キャンセル確認画面（ここが今回決めた「あっさり版」文面）
  return renderShell(
    <div
      style={{
        padding: "12px 4px 4px",
      }}
    >
      {/* バッジ */}
      <header style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 9999,
            background: "#fef2f2",
            border: "1px solid #fee2e2",
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 600,
            color: "#b91c1c",
          }}
        >
          キャンセル確認
        </div>
      </header>

      {/* タイトル */}
      <h1
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#111827",
        }}
      >
        キャンセルを確定しますか？
      </h1>

      {/* 説明（シンプル） */}
      <p
        style={{
          marginTop: 10,
          fontSize: 13,
          lineHeight: 1.7,
          color: "#374151",
        }}
      >
        キャンセルを実行すると、この予約は取り消されます。
        <br />
        お米代のお支払いは発生しません。
      </p>

      {/* 注意書き（小さめ） */}
      <p
        style={{
          marginTop: 6,
          fontSize: 11,
          lineHeight: 1.7,
          color: "#6b7280",
        }}
      >
        ※ すでにお支払いいただいたシステム利用料（300円）は返金されません。
      </p>

      {/* ボタン群 */}
      <div
        style={{
          marginTop: 20,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* キャンセル実行ボタン */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={confirming}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 9999,
            border: "none",
            outline: "none",
            background: confirming ? "#9ca3af" : "#b91c1c",
            color: "#ffffff",
            fontSize: 14,
            fontWeight: 700,
            cursor: confirming ? "default" : "pointer",
          }}
        >
          {confirming ? "キャンセル処理中…" : "キャンセルを確定する"}
        </button>

        {/* 戻るリンク（ブラウザバック推奨） */}
        <button
          type="button"
          onClick={() => window.history.back()}
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: 9999,
            border: "1px solid #d1d5db",
            background: "#ffffff",
            color: "#374151",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          キャンセルせずに戻る
        </button>
      </div>
    </div>
  );
};

export default CancelConfirmPage;
