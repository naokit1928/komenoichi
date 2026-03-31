// frontend/src/pages/auth/LoginOrRegisterPage.tsx
import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE } from "@/config/api";

// ── Brand tokens ──────────────────────────────────
const C = {
  ink:       "#1a1108",
  ink2:      "#4b3e2a",
  ink3:      "#7a6c58",
  border:    "#e8e2d8",
  bgPale:    "#f4f1ed",
  bgBase:    "#fdfcfa",
  red:       "#C62828",
} as const;

type MagicLinkResponse = {
  ok: boolean;
  debug_magic_link_url?: string | null;
};

/**
 * mode=confirm   → FarmDetail から来た「予約用ログイン」
 * mode=loginonly → Bookedを見るための「ログインのみ」
 *
 * B方式：どちらも send-login を使う
 */
function getModeFromQuery(searchParams: URLSearchParams): "confirm" | "loginonly" {
  const m = searchParams.get("mode");
  return m === "confirm" ? "confirm" : "loginonly";
}

async function sendMagicLinkLoginOnly(
  email: string,
  redirect: string | null
): Promise<MagicLinkResponse> {
  const res = await fetch(`${API_BASE}/api/auth/consumer/magic/send-login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      redirect,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail || "認証メールの送信に失敗しました。");
  }

  return res.json();
}

export default function LoginOrRegisterPage() {
  const [searchParams] = useSearchParams();
  const mode = useMemo(() => getModeFromQuery(searchParams), [searchParams]);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkUrl, setMagicLinkUrl] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function handleContinue() {
    try {
      setErr("");

      if (!email) {
        setErr("メールアドレスを入力してください。");
        return;
      }

      setLoading(true);

      let redirectPath: string | null = null;

      // ★ confirm のときだけ、FarmDetail が保存した CONFIRM_CTX から ConfirmSession を作る
      if (mode === "confirm") {
        const raw = sessionStorage.getItem("CONFIRM_CTX");
        if (!raw) {
          throw new Error(
            "予約情報が見つかりません。最初からやり直してください。"
          );
        }
        const confirmCtx = JSON.parse(raw);

        // ★ Phase2: ConfirmSession を作る（draft保存）
        const res = await fetch(`${API_BASE}/api/confirm/sessions`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(confirmCtx),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data?.detail || "予約セッションの作成に失敗しました。"
          );
        }

        const data = await res.json();
        const cs = data.confirm_session_id;
        if (!cs) {
          throw new Error("confirm_session_id が取得できません。");
        }

        // ★ MagicLink の戻り先は cs を持つ ConfirmPage へ
        redirectPath = `/farms/${confirmCtx.farm_id}/confirm?cs=${cs}`;
      }

      const res = await sendMagicLinkLoginOnly(email, redirectPath);

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

  const title =
    mode === "confirm"
      ? "予約へ進む"
      : "ログイン・新規登録";

  const sub =
    mode === "confirm"
      ? "予約を完了するため、メールアドレスを入力してください。登録済みの方はログイン、はじめての方は新規登録となります。"
      : "機能を利用するため、メールアドレスを入力してください。はじめての方も自動でアカウントが作成されます。";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bgBase }}>
      <section
        style={{
          maxWidth: 420,
          margin: "0 auto",
          padding: "48px 16px 32px",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: C.ink,
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          {title}
        </h1>

        {!magicLinkUrl ? (
          <div style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            
            <div style={{ color: C.ink, fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
              {sub}
            </div>

            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                fontSize: 15,
                color: C.ink,
                marginBottom: 4, // 隙間を詰める
                boxSizing: "border-box",
                outline: "none",
              }}
            />

            {/* ★ 控えめな1行ヘルプテキスト */}
            <div style={{ fontSize: 11, color: C.ink3, marginBottom: 16, paddingLeft: 4 }}>
              ※ 携帯メールは届かない場合があります。Gmail等を推奨します。
            </div>

            {err && (
              <div style={{ color: C.red, fontSize: 13, marginBottom: 16, fontWeight: 600, textAlign: "center" }}>
                {err}
              </div>
            )}

            <button
              onClick={handleContinue}
              disabled={loading}
              style={{
                width: "100%",
                display: "block",
                padding: "14px",
                background: loading ? "#d1d5db" : C.ink, // ★ ボタンを茶色(ink2)から黒(ink)に変更
                color: "#ffffff",
                borderRadius: 9999, // 丸ボタン
                border: "none",
                fontWeight: 600,
                fontSize: 15,
                cursor: loading ? "default" : "pointer",
                transition: "all 0.2s",
                marginTop: 8,
              }}
            >
              {loading ? "処理中…" : "続行"}
            </button>

            {/* 規約への同意文言 */}
            <div style={{ marginTop: 24, fontSize: 12, color: C.ink3, textAlign: "center", lineHeight: 1.6 }}>
              続行することで、<a href="/terms" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: C.ink }}>利用規約</a> および <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: C.ink }}>プライバシーポリシー</a> に同意したものとみなされます。
            </div>
          </div>
        ) : (
          <div style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: "32px 24px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            
            {/* チェックアイコン */}
            <div style={{ 
              display: "inline-flex", alignItems: "center", justifyContent: "center", 
              width: 48, height: 48, borderRadius: "50%", backgroundColor: C.bgPale, color: C.ink, marginBottom: 16
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            
            <p style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 12 }}>
              メールを送信しました
            </p>
            <p style={{ fontSize: 14, color: C.ink3, lineHeight: 1.6, marginBottom: 24 }}>
              メール内のリンクを開いてください。<br />
              {mode === "confirm"
                ? "認証後、自動的に予約確認画面へ進みます。"
                : "認証後、自動的に元のページに戻ります。"}
            </p>

            {/* 開発中のデバッグリンク表示（本番では消すか隠れる部分） */}
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px dashed ${C.border}`, textAlign: "left", wordBreak: "break-all" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
                【開発用】以下のリンクをクリックしてテストログイン
              </div>
              <a
                href={magicLinkUrl}
                style={{
                  color: "#2563eb",
                  textDecoration: "underline",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {magicLinkUrl}
              </a>
            </div>

          </div>
        )}
      </section>
    </div>
  );
}