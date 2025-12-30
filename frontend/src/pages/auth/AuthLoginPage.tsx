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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ---------------------------
  // OTP 発行（ログイン用）
  // ---------------------------
  const requestOtp = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/request-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "OTP送信に失敗しました");
      }

      setStep("otp");
    } catch (e: any) {
      setError(e.message || "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------
  // OTP 検証（ログイン用）
  // ---------------------------
  const verifyOtp = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, code }),
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "認証に失敗しました");
      }

      // セッション確立済み → 戻る
      navigate(from, { replace: true });
    } catch (e: any) {
      setError(e.message || "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 360 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>農家ログイン</h1>

      {step === "email" && (
        <>
          <p style={{ marginTop: 12 }}>
            登録済みメールアドレスを入力してください
          </p>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", marginTop: 12 }}
            placeholder="example@example.com"
          />

          <button
            onClick={requestOtp}
            disabled={loading || !email}
            style={{ marginTop: 16 }}
          >
            {loading ? "送信中…" : "OTPを送信"}
          </button>
        </>
      )}

      {step === "otp" && (
        <>
          <p style={{ marginTop: 12 }}>
            メールに届いた6桁コードを入力してください
          </p>

          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ width: "100%", marginTop: 12 }}
            placeholder="123456"
            maxLength={6}
          />

          <button
            onClick={verifyOtp}
            disabled={loading || code.length !== 6}
            style={{ marginTop: 16 }}
          >
            {loading ? "認証中…" : "ログイン"}
          </button>
        </>
      )}

      {error && (
        <p style={{ marginTop: 12, color: "red" }}>
          {error}
        </p>
      )}

      <p
        style={{
          marginTop: 24,
          fontSize: 12,
          color: "#6B7280",
        }}
      >
        ログイン後は {from} に戻ります
      </p>
    </div>
  );
}
