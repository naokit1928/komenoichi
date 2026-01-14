import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE } from "@/config/api";

export default function AuthLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from || "/farmer/settings";

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requestOtp = async () => {
    try {
      setError("");
      setLoading(true);

      const res = await fetch(`${API_BASE}/api/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("OTP送信に失敗しました");

      setStep("otp");
    } catch (e: any) {
      setError(e.message ?? "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    try {
      setError("");
      setLoading(true);

      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("認証に失敗しました");

      navigate(from, { replace: true });
    } catch (e: any) {
      setError(e.message ?? "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      <section
        style={{
          maxWidth: 420,
          margin: "0 auto",
          paddingTop: 32,
          paddingBottom: 32,
          paddingLeft: 16,
          paddingRight: 16,
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          農家ログイン
        </h1>

        <p
          style={{
            fontSize: 14,
            color: "#374151",
            marginBottom: 20,
            lineHeight: 1.6,
            textAlign: "center",
          }}
        >
          登録済みのメールアドレスでログインしてください。
        </p>

        {step === "email" && (
          <>
            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                fontSize: 14,
                marginBottom: 12,
                boxSizing: "border-box",
              }}
            />

            {error && (
              <div
                style={{
                  color: "#b91c1c",
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={requestOtp}
              disabled={loading || !email}
              style={{
                width: "100%",
                maxWidth: 260,
                margin: "0 auto",
                display: "block",
                padding: "12px",
                borderRadius: 10,
                background: loading ? "#9ca3af" : "#111",
                color: "#fff",
                border: "none",
                fontWeight: 700,
                fontSize: 15,
                cursor: loading ? "default" : "pointer",
              }}
            >
              {loading ? "送信中…" : "OTPを送信"}
            </button>
          </>
        )}

        {step === "otp" && (
          <>
            <input
              type="text"
              placeholder="6桁のコード"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                fontSize: 14,
                marginBottom: 12,
                boxSizing: "border-box",
              }}
            />

            {error && (
              <div
                style={{
                  color: "#b91c1c",
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={verifyOtp}
              disabled={loading || code.length !== 6}
              style={{
                width: "100%",
                maxWidth: 260,
                margin: "0 auto",
                display: "block",
                padding: "12px",
                borderRadius: 10,
                background: loading ? "#9ca3af" : "#111",
                color: "#fff",
                border: "none",
                fontWeight: 700,
                fontSize: 15,
                cursor: loading ? "default" : "pointer",
              }}
            >
              {loading ? "認証中…" : "ログイン"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
