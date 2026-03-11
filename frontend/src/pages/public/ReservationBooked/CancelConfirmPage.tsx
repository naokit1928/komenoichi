// frontend/src/pages/public/ReservationCancel/CancelConfirmPage.tsx
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE } from "@/config/api";


/**
 * キャンセル確認ページ
 */

const CANCEL_API_URL = `${API_BASE}/api/reservation/cancel`;


const CancelConfirmPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true); // token 検証中
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false); // キャンセル実行中
  const [done, setDone] = useState(false); // キャンセル完了フラグ

  // 共通レイアウト
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
      setError("キャンセル用のリンクが不正です。");
    }
    setLoading(false);
  }, [token]);
    

  // キャンセル実行
  const handleConfirm = async () => {
    if (!token) return;

    try {
      setConfirming(true);
      setError(null);

      const res = await fetch(CANCEL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        let backendMsg = "";
        try {
          const data = await res.json();
          backendMsg = data.detail || "";
        } catch (e) {
          // ignore
        }

        // バックエンドから期限切れのエラーが返ってきた場合、日本語に変換（3時間前という表記は削除）
        if (res.status === 400 && backendMsg.toLowerCase().includes("deadline")) {
          throw new Error("受け渡し時間を過ぎているため、キャンセルできません。");
        }

        throw new Error("cancel failed");
      }

      setDone(true);
    } catch (e: any) {
      console.error(e);
      setError(
        e.message !== "cancel failed" 
          ? e.message 
          : "キャンセル手続きに失敗しました。時間をおいて再度お試しください。"
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
    const isDeadlineError = error.includes("過ぎて");

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
              color: "#b91c1c", // エラーは本当にエラーだと伝えるため赤を残す
            }}
          >
            キャンセル手続きエラー
          </div>
        </header>

        <div
          style={{
            fontSize: 14,
            color: "#b91c1c", // エラーは本当にエラーだと伝えるため赤を残す
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
          {isDeadlineError 
            ? "お困りの場合は、直接農家へご相談ください。" 
            : "このページを再読み込みするか、予約一覧から再度お試しください。"}
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
              background: "#f4f1ed", // ★ 「当日現地払い」と同じ薄い茶系に変更
              border: "1px solid #e8e2d8",
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              color: "#4b3e2a", // ★ 濃い茶色に変更
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

        {/* ★ 追加：ホームに戻るボタン（ここに行き止まり防止の導線を設置） */}
        <div style={{ marginTop: 32 }}>
          <button
            type="button"
            onClick={() => window.location.href = "/farms"}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 9999,
              border: "none",
              background: "#4b3e2a", // ★ ブランドカラーの濃い茶色
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            農家一覧へ戻る
          </button>
        </div>
      </div>
    );
  }

  // 通常：キャンセル確認画面
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
            background: "#f4f1ed", // ★ 赤から薄い茶色に変更
            border: "1px solid #e8e2d8",
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 600,
            color: "#4b3e2a", // ★ 濃い茶色に変更
          }}
        >
          キャンセル確認
        </div>
      </header>

      <h1
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#111827",
        }}
      >
        キャンセルを確定しますか？
      </h1>

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

      <div
        style={{
          marginTop: 20,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
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
            background: confirming ? "#9ca3af" : "#4b3e2a", // ★ 実行ボタンを赤から濃い茶色に変更
            color: "#ffffff",
            fontSize: 14,
            fontWeight: 700,
            cursor: confirming ? "default" : "pointer",
          }}
        >
          {confirming ? "キャンセル処理中…" : "キャンセルを確定する"}
        </button>

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